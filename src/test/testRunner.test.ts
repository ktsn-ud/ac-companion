import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { runPythonTestCase } from "../core/testRunner";
import {
  getCurrentProblem,
  setCurrentProblem,
  clearCurrentProblem,
} from "../core/problemState";
import { AcCompanionPythonSettings } from "../types/config";
import { ProblemRecord } from "../types/problem";

const DEFAULT_SETTINGS: AcCompanionPythonSettings = {
  port: 10043,
  contestsDirName: "contests",
  testCaseSaveDirName: "tests",
  templateFilePath: ".config/templates/main.py",
  templateFilePathCpp: ".config/templates/main.cpp",
  language: "python",
  interpreter: "cpython",
  pythonCommand: "python",
  pypyCommand: "pypy3",
  cppCompileCommand: "cpp_compile",
  cppRunCommand: "cpp_run",
  runCwdMode: "workspace",
  timeoutMs: null,
  compare: {
    mode: "exact",
    caseSensitive: true,
  },
};

function createWorkspaceFixture(
  script: string,
  input: string,
  expected: string
) {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "accp-runner-"));
  const contestId = "sample-contest";
  const taskId = "task-a";
  const taskDir = path.join(workspaceRoot, contestId, taskId);
  fs.mkdirSync(taskDir, { recursive: true });
  fs.writeFileSync(path.join(taskDir, "main.py"), script, "utf-8");

  const testsDir = path.join(taskDir, "tests");
  fs.mkdirSync(testsDir, { recursive: true });
  const inputPath = path.join(testsDir, "1.in");
  const outputPath = path.join(testsDir, "1.out");
  fs.writeFileSync(inputPath, input, "utf-8");
  fs.writeFileSync(outputPath, expected, "utf-8");

  const problem: ProblemRecord = {
    name: "Sample",
    group: "Group",
    url: "https://example.com",
    interactive: false,
    timeLimit: 2000,
    contestId,
    taskId,
    contestBaseDir: "contests",
    testsDir: "tests",
    cases: [
      {
        index: 1,
        inputPath,
        outputPath,
        inputContent: input,
        expectedContent: expected,
      },
    ],
  };
  return { workspaceRoot, problem };
}

suite("Runner & State", () => {
  test("runPythonTestCase succeeds when output matches main.py behavior", async () => {
    const { workspaceRoot, problem } = createWorkspaceFixture(
      `
import sys
data = sys.stdin.read()
print(data.strip())
`,
      "hello\n",
      "hello\n"
    );
    try {
      const result = await runPythonTestCase(
        problem,
        DEFAULT_SETTINGS,
        workspaceRoot,
        problem.cases[0]
      );
      assert.strictEqual(result.status, "AC");
      assert.strictEqual(result.actual, "hello\n");
      assert.strictEqual(result.console, "");
    } finally {
      fs.rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  test("runPythonTestCase returns fail when expected output differs", async () => {
    const { workspaceRoot, problem } = createWorkspaceFixture(
      `
import sys
print("mismatch")
`,
      "ignored\n",
      "correct\n"
    );
    try {
      const result = await runPythonTestCase(
        problem,
        DEFAULT_SETTINGS,
        workspaceRoot,
        problem.cases[0]
      );
      assert.strictEqual(result.status, "WA");
      assert.ok(result.actual.includes("mismatch"));
    } finally {
      fs.rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  test("problemState setters and getters behave correctly", () => {
    clearCurrentProblem();
    assert.strictEqual(getCurrentProblem(), null);

    const sample: ProblemRecord = {
      name: "Test",
      group: "G",
      url: "https://example.com",
      interactive: false,
      timeLimit: 1000,
      contestId: "c",
      taskId: "t",
      contestBaseDir: "contests",
      testsDir: "tests",
      cases: [],
    };
    setCurrentProblem(sample);
    assert.deepStrictEqual(getCurrentProblem(), sample);
    clearCurrentProblem();
    assert.strictEqual(getCurrentProblem(), null);
  });
});
