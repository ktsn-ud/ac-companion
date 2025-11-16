import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";

import { AcCompanionPythonSettings } from "../types/config";
import { ProblemRecord, TestCaseFile } from "../types/problem";
import { RunResult, RunStatus } from "../types/runner";
import { normalizeLineEndings } from "./testCaseUtils";

const PYPY_CACHE_WARNING = "Warning: cannot find your CPU L2 & L3 cache size";
const DEFAULT_CODON_BUILD_ARGS = ["build", "-release"];
const DEFAULT_CODON_OUTPUT_NAME = "a.out";

function getSolutionDir(workspaceRoot: string, problem: ProblemRecord) {
  return path.join(workspaceRoot, problem.contestId, problem.taskId);
}

function ensureSolutionFile(
  workspaceRoot: string,
  problem: ProblemRecord
) {
  const solutionDir = getSolutionDir(workspaceRoot, problem);
  const solutionPath = path.join(solutionDir, "main.py");
  if (!fs.existsSync(solutionPath)) {
    throw new Error(`Solution file not found at ${solutionPath}`);
  }
  return { solutionDir, solutionPath };
}

function readTestCaseIO(testCase: TestCaseFile) {
  const input = fs.readFileSync(testCase.inputPath, "utf-8");
  const expected =
    fs.existsSync(testCase.outputPath) &&
    fs.statSync(testCase.outputPath).isFile()
      ? fs.readFileSync(testCase.outputPath, "utf-8")
      : "";
  return { input, expected };
}

function getCodonBinaryPath(
  workspaceRoot: string,
  problem: ProblemRecord,
  settings: AcCompanionPythonSettings
) {
  const outputName = settings.codonOutputName || DEFAULT_CODON_OUTPUT_NAME;
  return path.join(getSolutionDir(workspaceRoot, problem), outputName);
}

/**
 * PyPy の L2/L3 キャッシュ警告などを削除し、不要な stderr を抑制する。
 */
function filterConsoleOutput(value: string): string {
  return value
    .split("\n")
    .filter((line) => !line.includes(PYPY_CACHE_WARNING))
    .join("\n")
    .trim();
}

/**
 * 設定に基づき、出力結果を比較する。大文字小文字の差を許容するかどうかも here.
 */
function compareOutputs(
  expected: string,
  actual: string,
  caseSensitive: boolean
): boolean {
  if (caseSensitive) {
    return actual === expected;
  }
  return actual.toLowerCase() === expected.toLowerCase();
}

/**
 * CLI 設定または問題の timeLimit から適切なタイムアウトを算出します。
 */
function computeTimeout(
  problem: ProblemRecord,
  settings: AcCompanionPythonSettings
) {
  if (typeof settings.timeoutMs === "number") {
    return Math.max(1, settings.timeoutMs);
  }
  return Math.max(1, Math.ceil(problem.timeLimit * 1.2));
}

/**
 * ワークスペースまたは問題のディレクトリを runCwdMode に応じて返します。
 */
function resolveCwd(
  settings: AcCompanionPythonSettings,
  workspaceRoot: string,
  problem: ProblemRecord
): string {
  if (settings.runCwdMode === "task") {
    return path.join(workspaceRoot, problem.contestId, problem.taskId);
  }
  return workspaceRoot;
}

/**
 * 指定した単一ケースの実行と stdout/stderr のキャプチャ、比較結果の判定を行います。
 */
export async function runTestCase(
  problem: ProblemRecord,
  settings: AcCompanionPythonSettings,
  workspaceRoot: string,
  testCase: TestCaseFile
): Promise<RunResult> {
  if (settings.interpreter === "codon") {
    throw new Error("runTestCase() cannot be used with the Codon interpreter.");
  }

  const { solutionPath } = ensureSolutionFile(workspaceRoot, problem);

  const { input, expected } = readTestCaseIO(testCase);

  const command =
    settings.interpreter === "pypy"
      ? settings.pypyCommand
      : settings.pythonCommand;
  const cwd = resolveCwd(settings, workspaceRoot, problem);
  const timeoutMs = computeTimeout(problem, settings);

  const startAt = Date.now();
  return new Promise<RunResult>((resolve, reject) => {
    const child = spawn(command, [solutionPath], {
      cwd,
      env: process.env,
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.stdout?.on("data", (chunk) => stdoutChunks.push(Buffer.from(chunk)));
    child.stderr?.on("data", (chunk) => stderrChunks.push(Buffer.from(chunk)));

    child.stdin.end(input);

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      const durationMs = Date.now() - startAt;
      const actual = normalizeLineEndings(
        Buffer.concat(stdoutChunks).toString("utf-8")
      );
      const consoleOutput = filterConsoleOutput(
        normalizeLineEndings(Buffer.concat(stderrChunks).toString("utf-8"))
      );
      let status: RunStatus;

      if (timedOut) {
        status = "TLE";
      } else if (code !== 0) {
        status = "RE";
      } else {
        const normalizedExpected = normalizeLineEndings(expected);
        const passed = compareOutputs(
          normalizedExpected,
          actual,
          settings.compare.caseSensitive
        );
        status = passed ? "AC" : "WA";
      }

      resolve({
        index: testCase.index,
        status,
        durationMs,
        actual,
        console: consoleOutput,
      });
    });
  });
}

/**
 * ProblemRecord に含まれる全ケースを順番に実行し、結果を配列で返します。
 */
export async function runAllTests(
  problem: ProblemRecord,
  settings: AcCompanionPythonSettings,
  workspaceRoot: string
): Promise<RunResult[]> {
  const results: RunResult[] = [];
  if (settings.interpreter === "codon") {
    const binaryPath = await buildCodonBinary(problem, settings, workspaceRoot);
    for (const testCase of problem.cases) {
      const result = await runCodonTestCase(
        problem,
        settings,
        workspaceRoot,
        testCase,
        binaryPath
      );
      results.push(result);
    }
    return results;
  }
  for (const testCase of problem.cases) {
    const result = await runTestCase(
      problem,
      settings,
      workspaceRoot,
      testCase
    );
    results.push(result);
  }
  return results;
}

export async function buildCodonBinary(
  problem: ProblemRecord,
  settings: AcCompanionPythonSettings,
  workspaceRoot: string
): Promise<string> {
  const { solutionDir } = ensureSolutionFile(workspaceRoot, problem);
  const binaryPath = getCodonBinaryPath(workspaceRoot, problem, settings);
  const buildArgs = Array.isArray(settings.codonBuildArgs)
    ? settings.codonBuildArgs
    : DEFAULT_CODON_BUILD_ARGS;
  const args = [...(buildArgs.length ? buildArgs : DEFAULT_CODON_BUILD_ARGS), "main.py"];

  return new Promise<string>((resolve, reject) => {
    const child = spawn(settings.codonCommand, args, {
      cwd: solutionDir,
      env: process.env,
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    child.stdout?.on("data", (chunk) => stdoutChunks.push(Buffer.from(chunk)));
    child.stderr?.on("data", (chunk) => stderrChunks.push(Buffer.from(chunk)));

    child.on("error", reject);
    child.on("close", (code) => {
      const stdout = Buffer.concat(stdoutChunks).toString("utf-8").trim();
      const stderr = Buffer.concat(stderrChunks).toString("utf-8").trim();
      if (code !== 0) {
        const messageParts = ["Codon build failed."];
        if (stderr) {
          messageParts.push(stderr);
        } else if (stdout) {
          messageParts.push(stdout);
        }
        reject(new Error(messageParts.join("\n")));
        return;
      }

      if (!fs.existsSync(binaryPath)) {
        reject(
          new Error(`Codon build succeeded but output not found at ${binaryPath}`)
        );
        return;
      }
      resolve(binaryPath);
    });
  });
}

export async function runCodonTestCase(
  problem: ProblemRecord,
  settings: AcCompanionPythonSettings,
  workspaceRoot: string,
  testCase: TestCaseFile,
  binaryPath?: string
): Promise<RunResult> {
  const resolvedBinaryPath =
    binaryPath ?? getCodonBinaryPath(workspaceRoot, problem, settings);
  if (!fs.existsSync(resolvedBinaryPath)) {
    throw new Error(`Codon binary not found at ${resolvedBinaryPath}`);
  }

  const { input, expected } = readTestCaseIO(testCase);

  const cwd = resolveCwd(settings, workspaceRoot, problem);
  const timeoutMs = computeTimeout(problem, settings);

  const startAt = Date.now();
  return new Promise<RunResult>((resolve, reject) => {
    const child = spawn(resolvedBinaryPath, [], {
      cwd,
      env: process.env,
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.stdout?.on("data", (chunk) => stdoutChunks.push(Buffer.from(chunk)));
    child.stderr?.on("data", (chunk) => stderrChunks.push(Buffer.from(chunk)));
    child.stdin.end(input);

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      const durationMs = Date.now() - startAt;
      const actual = normalizeLineEndings(
        Buffer.concat(stdoutChunks).toString("utf-8")
      );
      const consoleOutput = filterConsoleOutput(
        normalizeLineEndings(Buffer.concat(stderrChunks).toString("utf-8"))
      );
      let status: RunStatus;

      if (timedOut) {
        status = "TLE";
      } else if (code !== 0) {
        status = "RE";
      } else {
        const normalizedExpected = normalizeLineEndings(expected);
        const passed = compareOutputs(
          normalizedExpected,
          actual,
          settings.compare.caseSensitive
        );
        status = passed ? "AC" : "WA";
      }

      resolve({
        index: testCase.index,
        status,
        durationMs,
        actual,
        console: consoleOutput,
      });
    });
  });
}
