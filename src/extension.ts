import * as vscode from "vscode";
import * as http from "http";
import * as fs from "fs";
import * as path from "path";

import {
  TestCase,
  CompetitiveCompanionsResponse,
} from "./types/CompetitiveCompanions";
import {
  AcCompanionPythonSettings,
  Interpreter,
  RunCwdMode,
} from "./types/config";
import {
  collectTestCases,
  getNextTestIndex,
  normalizeLineEndings,
} from "./core/testCaseUtils";
import {
  buildCodonBinary,
  runCodonTestCase,
  runTestCase,
} from "./core/testRunner";
import { getCurrentProblem, setCurrentProblem } from "./core/problemState";
import { ProblemRecord } from "./types/problem";

import { WebviewProvider } from "./webview/webviewProvider";
import { RunResult, RunScope, RunSummary } from "./types/runner";

const TEMPLATE_FILE_DEFAULT = ".config/templates/main.py";
const PLACEHOLDER = "pass";

let server: http.Server | null = null;
let webviewProvider: WebviewProvider | null = null;
let outputChannel: vscode.OutputChannel | null = null;
let isRunning = false;

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel("AC Companion Python");
  context.subscriptions.push(outputChannel);

  const provider = new WebviewProvider(context.extensionUri);
  webviewProvider = provider;
  provider.onReady(() => {
    sendStateToWebview();
  });
  provider.onDidReceiveMessage(handleWebviewMessage);

  context.subscriptions.push(
    vscode.commands.registerCommand("ac-companion-python.start", startServer),
    vscode.commands.registerCommand("ac-companion-python.stop", stopServer),
    vscode.commands.registerCommand(
      "ac-companion-python.runAll",
      handleRunAllTests
    ),
    vscode.commands.registerCommand(
      "ac-companion-python.runOne",
      handleRunOneTest
    ),
    vscode.window.registerWebviewViewProvider(
      "ac-companion-python.view",
      provider
    )
  );

  startServer();
}

export function deactivate() {}

/**
 * Competitive Companion からの POST を受け取り、テストケースファイルを保存しテンプレートをコピーする HTTP サーバーを起動します。
 * すでに起動済みであれば情報メッセージを表示し、新しいサーバーは立ち上げません。
 */
async function startServer() {
  if (server) {
    vscode.window.showInformationMessage(
      "AC Companion Python server is already running."
    );
    return;
  }

  const initialSettings = loadSettings();
  const port = initialSettings.port;

  server = http.createServer(
    async (req: http.IncomingMessage, res: http.ServerResponse) => {
      try {
        if (req.method === "POST" && req.url === "/") {
          const body = await readBody(req);
          const data: CompetitiveCompanionsResponse = JSON.parse(
            body.toString("utf-8")
          );
          const tests: TestCase[] = Array.isArray(data?.tests)
            ? data.tests
            : [];
          const url =
            typeof data?.url === "string" && /^https?:\/\//.test(data.url)
              ? new URL(data.url)
              : null;
          if (!url) {
            res.writeHead(400);
            res.end("Invalid or missing URL.");
            return;
          }

          const workspaceFolders = vscode.workspace.workspaceFolders?.[0];
          if (!workspaceFolders) {
            res.writeHead(500);
            res.end("No workspace folder found.");
            return;
          }

          const settings = loadSettings();

          const contestId = getContestIdFromUrl(url);
          const taskId = getTaskIdFromUrl(url);
          if (!contestId || !taskId) {
            res.writeHead(400);
            res.end("Could not extract contest or task ID from URL.");
            return;
          }

          // 保存ディレクトリの作成
          const dirRelative = settings.testCaseSaveDirName;
          const saveDir = path.join(
            workspaceFolders.uri.fsPath,
            contestId,
            taskId,
            dirRelative
          );
          fs.mkdirSync(saveDir, { recursive: true });

          const existingCases = collectTestCases(saveDir);

          let savedCount = 0;
          if (existingCases.length === 0 && tests.length > 0) {
            const nextIndex = getNextTestIndex(saveDir);
            tests.forEach((test, index) => {
              const idx = nextIndex + index;
              fs.writeFileSync(
                path.join(saveDir, `${idx}.in`),
                normalizeLineEndings(test?.input ?? ""),
                "utf-8"
              );
              fs.writeFileSync(
                path.join(saveDir, `${idx}.out`),
                normalizeLineEndings(test?.output ?? ""),
                "utf-8"
              );
            });
            savedCount = tests.length;
            vscode.window.showInformationMessage(
              `Saved ${savedCount} test case(s) to ${saveDir}.`
            );
          } else if (existingCases.length > 0) {
            vscode.window.showInformationMessage(
              `Tests already exist in ${saveDir}; skipping addition.`
            );
          } else {
            vscode.window.showInformationMessage(
              `No new test cases to save for ${saveDir}.`
            );
          }
          const collectedCases = collectTestCases(saveDir);

          const problemRecord: ProblemRecord = {
            name: data.name ?? "",
            group: data.group ?? "",
            url: data.url ?? "",
            interactive: Boolean(data.interactive),
            timeLimit:
              typeof data.timeLimit === "number" ? data.timeLimit : 2000,
            contestId,
            taskId,
            testsDir: dirRelative,
            cases: collectedCases,
          };
          setCurrentProblem(problemRecord);
          sendStateToWebview();

          // テンプレートファイルのコピー
          const templateRelativePath =
            settings.templateFilePath || TEMPLATE_FILE_DEFAULT;
          const templatePath = path.join(
            workspaceFolders.uri.fsPath,
            templateRelativePath
          );

          const solutionDir = path.join(
            workspaceFolders.uri.fsPath,
            contestId,
            taskId
          );
          fs.mkdirSync(solutionDir, { recursive: true });
          const solutionPath = path.join(solutionDir, "main.py");
          if (!fs.existsSync(solutionPath)) {
            if (fs.existsSync(templatePath)) {
              fs.copyFileSync(templatePath, solutionPath);
            } else {
              vscode.window.showWarningMessage(
                `Template file not found at ${templatePath}. Skipping template copy.`
              );
            }
          }

          // ソリューションファイルをエディタで開く
          if (fs.existsSync(solutionPath)) {
            const codeUri = vscode.Uri.file(solutionPath);
            openCodeFileAndSetCursor(codeUri);
          }

          res.writeHead(200);
          res.end("ok");
          return;
        }
        res.writeHead(404);
        res.end("Not Found");
      } catch (e: any) {
        res.writeHead(500);
        res.end(String(e?.message ?? e));
      }
    }
  );

  await new Promise<void>((resolve, reject) => {
    const onError = (err: Error) => {
      server?.off("error", onError);
      reject(err);
    };
    server!.on("error", onError);
    server!.listen(port, "127.0.0.1", () => {
      server?.off("error", onError);
      resolve();
    });
  });

  vscode.window.showInformationMessage(
    `AC Companion Python server started on port ${port}.`
  );

  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    0
  );
  statusBarItem.text = `ACCP: Running`;
  statusBarItem.command = "ac-companion-python.stop";
  statusBarItem.show();
}

function stopServer() {
  if (!server) {
    return;
  }
  server.close();
  server = null;
  vscode.window.showInformationMessage("AC Companion Python server stopped.");
}

/**
 * 現在の ProblemRecord に含まれるすべてのケースを順番に実行し、実行状況や結果を UI に通知する。
 */
async function handleRunAllTests() {
  const problem = getCurrentProblem();
  if (!problem) {
    vscode.window.showWarningMessage(
      "No problem loaded for AC Companion Python."
    );
    return;
  }
  if (problem.interactive) {
    vscode.window.showWarningMessage(
      "Interactive problems are not supported yet."
    );
    return;
  }

  if (problem.cases.length === 0) {
    vscode.window.showWarningMessage("No test cases available to run.");
    return;
  }

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    vscode.window.showErrorMessage(
      "Workspace folder is required to run tests."
    );
    return;
  }

  if (isRunning) {
    vscode.window.showWarningMessage("Already running tests.");
    return;
  }

  const settings = loadSettings();
  isRunning = true;
  const startAt = Date.now();
  sendRunProgress("all", true);
  outputChannel?.clear();
  outputChannel?.show(true);
  outputChannel?.appendLine(
    `[Run All] ${problem.name} (${problem.contestId}/${problem.taskId})`
  );

  const results: RunResult[] = [];
  try {
    let codonBinaryPath: string | null = null;
    let runStartAt = startAt;
    if (settings.interpreter === "codon") {
      outputChannel?.appendLine("[Codon] Building binary...");
      codonBinaryPath = await buildCodonBinary(
        problem,
        settings,
        workspaceRoot
      );
      outputChannel?.appendLine(`[Codon] Build succeeded: ${codonBinaryPath}`);
      runStartAt = Date.now();
    }
    for (const testCase of problem.cases) {
      sendRunProgress("all", true, testCase.index);
      const result =
        settings.interpreter === "codon"
          ? await runCodonTestCase(
              problem,
              settings,
              workspaceRoot,
              testCase,
              codonBinaryPath ?? undefined
            )
          : await runTestCase(
              problem,
              settings,
              workspaceRoot,
              testCase
            );
      results.push(result);
      outputChannel?.appendLine(
        `#${result.index} ${result.status.toUpperCase()} (${result.durationMs}ms)`
      );
      logResultToOutput(result);
      sendRunResult("all", result);
    }
    sendRunComplete("all", results, Date.now() - runStartAt);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to run tests.";
    outputChannel?.appendLine(`Error: ${message}`);
    sendNotice("error", message);
    vscode.window.showErrorMessage(message);
  } finally {
    sendRunProgress("all", false);
    isRunning = false;
  }
}

/**
 * 入力されたインデックスのテストケースだけを実行し、Webview の `run/result` などを発行する。
 */
async function handleRunOneTest() {
  const problem = getCurrentProblem();
  if (!problem) {
    vscode.window.showWarningMessage(
      "No problem loaded for AC Companion Python."
    );
    return;
  }

  if (problem.interactive) {
    vscode.window.showWarningMessage(
      "Interactive problems are not supported yet."
    );
    return;
  }

  if (problem.cases.length === 0) {
    vscode.window.showWarningMessage("No test cases available to run.");
    return;
  }

  const indexInput = await vscode.window.showInputBox({
    prompt: "Test index (#)",
    validateInput: (value: string) => {
      const parsed = Number(value);
      if (!value) {
        return "Test index is required.";
      }
      if (!Number.isInteger(parsed) || parsed < 1) {
        return "Enter a valid 1-based test index.";
      }
      return null;
    },
    value: "1",
  });
  if (!indexInput) {
    return;
  }

  const index = Number.parseInt(indexInput, 10);
  await runSingleTestByIndex(index);
}

/**
 * Webview のインデックス指定に応じて単一テストを実行し、通知をまとめて送信する。
 */
async function runSingleTestByIndex(index: number) {
  const problem = getCurrentProblem();
  if (!problem) {
    vscode.window.showWarningMessage(
      "No problem loaded for AC Companion Python."
    );
    return;
  }

  if (isRunning) {
    vscode.window.showWarningMessage("Already running tests.");
    return;
  }

  if (problem.interactive) {
    vscode.window.showWarningMessage(
      "Interactive problems are not supported yet."
    );
    return;
  }

  if (problem.cases.length === 0) {
    vscode.window.showWarningMessage("No test cases available to run.");
    return;
  }

  const testCase = problem.cases.find((t) => t.index === index);
  if (!testCase) {
    vscode.window.showErrorMessage(`Test case #${index} not found.`);
    return;
  }

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    vscode.window.showErrorMessage(
      "Workspace folder is required to run tests."
    );
    return;
  }

  const settings = loadSettings();
  isRunning = true;
  const startAt = Date.now();
  sendRunProgress("one", true, index);
  outputChannel?.show(true);
  outputChannel?.appendLine(`[Run #${index}] ${problem.name}`);

  try {
    let codonBinaryPath: string | null = null;
    let runStartAt = startAt;
    if (settings.interpreter === "codon") {
      outputChannel?.appendLine("[Codon] Building binary...");
      codonBinaryPath = await buildCodonBinary(
        problem,
        settings,
        workspaceRoot
      );
      outputChannel?.appendLine(`[Codon] Build succeeded: ${codonBinaryPath}`);
      runStartAt = Date.now();
    }
    const result =
      settings.interpreter === "codon"
        ? await runCodonTestCase(
            problem,
            settings,
            workspaceRoot,
            testCase,
            codonBinaryPath ?? undefined
          )
        : await runTestCase(
            problem,
            settings,
            workspaceRoot,
            testCase
          );
    outputChannel?.appendLine(
      `#${index} ${result.status.toUpperCase()} (${result.durationMs}ms)`
    );
    logResultToOutput(result);
    sendRunResult("one", result);
    sendRunComplete("one", [result], Date.now() - runStartAt);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to run the test.";
    outputChannel?.appendLine(`Error: ${message}`);
    outputChannel?.appendLine("Execution aborted.");
    outputChannel?.show(true);
    sendNotice("error", message);
    vscode.window.showErrorMessage(message);
  } finally {
    sendRunProgress("one", false);
    isRunning = false;
  }
}

function readBody(req: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (d: Buffer | string) =>
      chunks.push(Buffer.isBuffer(d) ? d : Buffer.from(d))
    );
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function getContestIdFromUrl(url: URL): string | null {
  const parts = url.pathname.split("/");
  const index = parts.indexOf("contests");
  if (index !== -1 && parts.length > index + 1) {
    return parts[index + 1];
  }
  return null;
}

function getTaskIdFromUrl(url: URL): string | null {
  const parts = url.pathname.split("/");
  const index = parts.indexOf("tasks");
  if (index !== -1 && parts.length > index + 1) {
    return parts[index + 1];
  }
  return null;
}

/**
 * VS Code の拡張設定から AC Companion Python の構成を読み取ります。
 */
function loadSettings(): AcCompanionPythonSettings {
  const config = vscode.workspace.getConfiguration("ac-companion-python");
  const interpreter = config.get<Interpreter>("interpreter", "cpython");
  const runCwdMode = config.get<RunCwdMode>("runCwdMode", "workspace");
  const compareMode = config.get<string>("compare.mode", "exact");
  const mode: AcCompanionPythonSettings["compare"]["mode"] =
    compareMode === "exact" ? "exact" : "exact";
  const compareCaseSensitive = config.get<boolean>(
    "compare.caseSensitive",
    true
  );

  const timeoutMs = config.get<number | null>("timeoutMs");
  const codonBuildArgsValue = config.get<unknown>("codonBuildArgs");
  const codonBuildArgs =
    Array.isArray(codonBuildArgsValue) &&
    codonBuildArgsValue.every((item) => typeof item === "string")
      ? (codonBuildArgsValue as string[])
      : ["build", "-release"];

  return {
    port: config.get<number>("port", 10043),
    testCaseSaveDirName: config.get<string>("testCaseSaveDirName", "tests"),
    templateFilePath: config.get<string>(
      "templateFilePath",
      TEMPLATE_FILE_DEFAULT
    ),
    interpreter,
    pythonCommand: config.get<string>("pythonCommand", "python"),
    pypyCommand: config.get<string>("pypyCommand", "pypy3"),
    codonCommand: config.get<string>("codonCommand", "codon"),
    codonBuildArgs,
    codonOutputName: config.get<string>("codonOutputName", "a.out"),
    runCwdMode,
    timeoutMs: typeof timeoutMs === "number" ? timeoutMs : null,
    compare: {
      mode,
      caseSensitive: compareCaseSensitive ?? true,
    },
  };
}

function postToWebview(message: any) {
  webviewProvider?.postMessage(message);
}

function buildRunSettingsPayload(settings: AcCompanionPythonSettings) {
  return {
    interpreter: settings.interpreter,
    pythonCommand: settings.pythonCommand,
    pypyCommand: settings.pypyCommand,
    runCwdMode: settings.runCwdMode,
    timeoutMs: settings.timeoutMs,
    compare: settings.compare,
  };
}

/**
 * 現在の問題状態と設定を Webview に送信するためのユーティリティ。
 */
function sendStateToWebview() {
  const settings = loadSettings();
  const problem = getCurrentProblem();
  postToWebview({
    type: "state/init",
    problem: problem ?? undefined,
    settings: buildRunSettingsPayload(settings),
  });
}

/**
 * 実行中フラグや現在のケース番号を Webview に通知します。
 */
function sendRunProgress(
  scope: RunScope,
  running: boolean,
  currentIndex?: number
) {
  postToWebview({ type: "run/progress", scope, running, currentIndex });
}

/**
 * テスト結果群を集計し、summary オブジェクトを構築します。
 */
function buildRunSummary(results: RunResult[], durationMs: number): RunSummary {
  const passed = results.filter((r) => r.status === "AC").length;
  const failed = results.filter((r) => r.status === "WA").length;
  const timeouts = results.filter((r) => r.status === "TLE").length;
  const res = results.filter((r) => r.status === "RE").length;
  return {
    total: results.length,
    passed,
    failed,
    timeouts,
    res,
    durationMs,
  };
}

/**
 * 単一テストの結果を Webview に送信します。
 */
function sendRunResult(scope: "one" | "all", result: RunResult) {
  postToWebview({ type: "run/result", scope, result });
}

/**
 * 全体の実行結果を集計し、完了イベントを通知します。
 */
function sendRunComplete(
  scope: RunScope,
  results: RunResult[],
  durationMs: number
) {
  postToWebview({
    type: "run/complete",
    scope,
    summary: buildRunSummary(results, durationMs),
  });
}

/**
 * ユーザー向け通知メッセージを Webview に伝搬します。
 */
function sendNotice(level: "info" | "warn" | "error", message: string) {
  postToWebview({ type: "notice", level, message });
}

async function switchInterpreter(interpreter: Interpreter) {
  try {
    const config = vscode.workspace.getConfiguration("ac-companion-python");
    await config.update(
      "interpreter",
      interpreter,
      vscode.ConfigurationTarget.Workspace
    );
    const labelMap: Record<Interpreter, string> = {
      cpython: "CPython",
      pypy: "PyPy",
      codon: "Codon",
    };
    sendNotice("info", `${labelMap[interpreter]} interpreter selected.`);
    sendStateToWebview();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to switch interpreter.";
    sendNotice("error", message);
  }
}

function handleWebviewMessage(message: any) {
  if (!message || typeof message !== "object") {
    return;
  }
  switch (message.type) {
    case "ui/requestInit":
      sendStateToWebview();
      break;
    case "ui/runAll":
      void handleRunAllTests();
      break;
    case "ui/runOne":
      if (typeof message.index === "number") {
        void runSingleTestByIndex(message.index);
      }
      break;
    case "ui/switchInterpreter":
      if (
        message.interpreter === "cpython" ||
        message.interpreter === "pypy" ||
        message.interpreter === "codon"
      ) {
        void switchInterpreter(message.interpreter);
      }
      break;
  }
}

function logResultToOutput(result: RunResult) {
  if (result.status === "AC") {
    return;
  }
  if (result.actual) {
    outputChannel?.appendLine("  Actual:");
    outputChannel?.appendLine(result.actual);
  }
  if (result.console) {
    outputChannel?.appendLine("  Console:");
    outputChannel?.appendLine(result.console);
  }
}

/**
 * 保存先ディレクトリ内の既存テストケース番号を確認し、
 * 末尾のインデックス（＋1）を返します。
 * @param dir テストケースディレクトリ
 */
async function openCodeFileAndSetCursor(fileUrl: vscode.Uri) {
  try {
    const document = await vscode.workspace.openTextDocument(fileUrl);

    // プレースホルダーを探して選択状態にする
    const text = document.getText();
    const index = text.indexOf(PLACEHOLDER);

    // エディタで開く
    const editor = await vscode.window.showTextDocument(document, {
      preview: false,
    });

    if (index === -1) {
      return;
    }

    const start = document.positionAt(index);
    const end = document.positionAt(index + PLACEHOLDER.length);

    editor.selection = new vscode.Selection(start, end);
    editor.revealRange(
      new vscode.Range(start, end),
      vscode.TextEditorRevealType.InCenter
    );
  } catch (err) {
    vscode.window.showErrorMessage(
      `Failed to open code file: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}
