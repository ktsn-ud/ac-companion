import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";

import { AcCompanionPythonSettings } from "../types/config";
import { ProblemRecord, TestCaseFile } from "../types/problem";
import { RunResult, RunStatus } from "../types/runner";
import { normalizeLineEndings } from "./testCaseUtils";

const PYPY_CACHE_WARNING = "Warning: cannot find your CPU L2 & L3 cache size";

function getSolutionDir(workspaceRoot: string, problem: ProblemRecord) {
  return path.join(workspaceRoot, problem.contestId, problem.taskId);
}

function ensureSolutionFile(
  workspaceRoot: string,
  problem: ProblemRecord,
  language: "python" | "cpp"
) {
  const solutionDir = getSolutionDir(workspaceRoot, problem);
  const filename = language === "cpp" ? "main.cpp" : "main.py";
  const solutionPath = path.join(solutionDir, filename);
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
 * Python の単一ケース実行と stdout/stderr のキャプチャ、比較結果の判定を行います。
 */
export async function runPythonTestCase(
  problem: ProblemRecord,
  settings: AcCompanionPythonSettings,
  workspaceRoot: string,
  testCase: TestCaseFile
): Promise<RunResult> {
  const { solutionPath } = ensureSolutionFile(workspaceRoot, problem, "python");

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

async function compileCppBinary(
  problem: ProblemRecord,
  settings: AcCompanionPythonSettings,
  workspaceRoot: string
): Promise<string> {
  const { solutionDir } = ensureSolutionFile(workspaceRoot, problem, "cpp");

  const args = [problem.contestId, problem.taskId];
  return new Promise<string>((resolve, reject) => {
    const child = spawn(settings.cppCompileCommand, args, {
      cwd: workspaceRoot,
      env: {
        ...process.env,
        WORKSPACE_DIR: workspaceRoot,
      },
    });

    const stderrChunks: Buffer[] = [];
    child.stderr?.on("data", (chunk) => stderrChunks.push(Buffer.from(chunk)));
    child.stdout?.on("data", () => {});

    child.on("error", reject);
    child.on("close", (code) => {
      const stderr = Buffer.concat(stderrChunks).toString("utf-8").trim();
      const binaryPath = path.join(solutionDir, "a.out");
      if (code !== 0) {
        const messageParts = ["C++ compilation failed."];
        if (stderr) {
          messageParts.push(stderr);
        }
        reject(new Error(messageParts.join("\n")));
        return;
      }
      if (!fs.existsSync(binaryPath)) {
        reject(new Error(`C++ binary not found at ${binaryPath}`));
        return;
      }
      resolve(binaryPath);
    });
  });
}

/**
 * C++ の単一ケースを実行し、stdout/stderr を収集して比較判定する。
 * 事前に compileCppBinary を呼び出しておくこと。
 */
export async function runCppTestCase(
  problem: ProblemRecord,
  settings: AcCompanionPythonSettings,
  workspaceRoot: string,
  testCase: TestCaseFile,
  binaryPath?: string
): Promise<RunResult> {
  const { solutionDir } = ensureSolutionFile(workspaceRoot, problem, "cpp");
  const resolvedBinaryPath = binaryPath ?? path.join(solutionDir, "a.out");
  if (!fs.existsSync(resolvedBinaryPath)) {
    throw new Error(`C++ binary not found at ${resolvedBinaryPath}`);
  }
  const { expected } = readTestCaseIO(testCase);
  const timeoutMs = computeTimeout(problem, settings);

  const taskDir = path.join(workspaceRoot, problem.contestId, problem.taskId);
  const relativeInput = path.relative(taskDir, testCase.inputPath);
  const args = [problem.contestId, problem.taskId, relativeInput];
  const runCommand = settings.cppRunCommand || "cpp_run";
  const startAt = Date.now();

  return new Promise<RunResult>((resolve, reject) => {
    const child = spawn(runCommand, args, {
      cwd: taskDir,
      env: {
        ...process.env,
        WORKSPACE_DIR: workspaceRoot,
      },
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
      const consoleOutput = normalizeLineEndings(
        Buffer.concat(stderrChunks).toString("utf-8")
      ).trim();

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
 * language=cpp の場合はコンパイルを 1 度だけ行う。
 */
export async function runAllTests(
  problem: ProblemRecord,
  settings: AcCompanionPythonSettings,
  workspaceRoot: string
): Promise<RunResult[]> {
  const results: RunResult[] = [];
  if (settings.language === "cpp") {
    const binaryPath = await compileCppBinary(problem, settings, workspaceRoot);
    for (const testCase of problem.cases) {
      const result = await runCppTestCase(
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
    const result = await runPythonTestCase(
      problem,
      settings,
      workspaceRoot,
      testCase
    );
    results.push(result);
  }
  return results;
}

export { compileCppBinary };
