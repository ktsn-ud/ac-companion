import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Message, Problem, RunResult, RunSettings } from "./webviewTypes";
import { HeaderControls } from "./components/HeaderControls";
import { TestList } from "./components/TestList";
import { clsx } from "clsx";

declare const acquireVsCodeApi: () => {
  postMessage: (message: unknown) => void;
  getState: () => unknown;
};

const vscode = acquireVsCodeApi();

const App = () => {
  const [problem, setProblem] = useState<Problem | null>(null);
  const [settings, setSettings] = useState<RunSettings | null>(null);
  const [results, setResults] = useState<Record<number, RunResult>>({});
  const [running, setRunning] = useState(false);
  const [statusText, setStatusText] = useState("No problem loaded.");
  const [notice, setNotice] = useState<string | null>(null);
  const runStateRef = useRef(false);

  useEffect(() => {
    const handler = (event: MessageEvent<Message>) => {
      const message = event.data;
      switch (message.type) {
        case "state/init":
        case "state/update": {
          setProblem(message.problem ?? null);
          setSettings(message.settings);
          setResults({});
          setStatusText(
            message.problem
              ? `Ready: ${message.problem.cases.length} test(s)`
              : "No problem loaded."
          );
          setRunning(false);
          setNotice(null);
          break;
        }
        case "run/progress": {
          const runStarted = message.running && !runStateRef.current;
          runStateRef.current = message.running;
          setRunning(message.running);
          setStatusText(
            message.running
              ? message.currentIndex
                ? `Running #${message.currentIndex}`
                : "Running tests..."
              : "Idle"
          );
          // テスト実行開始時に結果をリセット
          if (runStarted) {
            setResults({});
          }
          break;
        }
        case "run/result": {
          setResults((prev) => ({
            ...prev,
            [message.result.index]: message.result,
          }));
          break;
        }
        case "run/complete": {
          setRunning(false);
          setStatusText(
            `${message.summary.passed}/${message.summary.total} passed (${message.summary.durationMs}ms)`
          );
          break;
        }
        case "notice": {
          setNotice(message.message);
          break;
        }
      }
    };

    window.addEventListener("message", handler);
    vscode.postMessage({ type: "ui/requestInit" });
    return () => window.removeEventListener("message", handler);
  }, []);

  const runAll = () => {
    vscode.postMessage({ type: "ui/runAll" });
  };

  const runOne = (index: number) => {
    vscode.postMessage({ type: "ui/runOne", index });
  };

  const toggleInterpreter = () => {
    if (!settings) {
      return;
    }
    const order: Array<Pick<RunSettings, "language" | "interpreter">> = [
      { language: "python", interpreter: "cpython" },
      { language: "python", interpreter: "pypy" },
      { language: "cpp", interpreter: "cpython" },
    ];
    const currentIndex = order.findIndex(
      (item) =>
        item.language === settings.language &&
        item.interpreter === settings.interpreter
    );
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % order.length : 0;
    const next = order[nextIndex];
    vscode.postMessage({
      type: "ui/switchRuntime",
      language: next.language,
      interpreter: next.interpreter,
    });
  };

  const computedTimeoutMs = useMemo(() => {
    if (settings?.timeoutMs != null) {
      return Math.max(1, settings.timeoutMs);
    }
    if (problem) {
      return Math.max(1, Math.ceil(problem.timeLimit * 1.2));
    }
    return null;
  }, [problem, settings]);

  const timeoutLabel =
    computedTimeoutMs != null ? `${computedTimeoutMs}ms` : "auto";

  const renderTextBlock = (
    label: string,
    content: string,
    background: string = "bg-gray-800"
  ) => (
    <div className="mt-1.5">
      <div className="text-sm text-muted-foreground">{label}</div>
      <pre
        className={clsx(
          "p-2 rounded-sm my-1 whitespace-pre-wrap break-all",
          background
        )}
      >
        {content || "(empty)"}
      </pre>
    </div>
  );

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: "12px" }}>
      <HeaderControls
        settings={settings}
        running={running}
        statusText={statusText}
        timeoutLabel={timeoutLabel}
        onRunAll={runAll}
        onToggleInterpreter={toggleInterpreter}
      />

      {notice && (
        <div
          style={{
            padding: "8px",
            border: "1px solid #f8bbd0",
            background: "#ffeef5",
            color: "#6f1c2e",
            marginBottom: "12px",
          }}
        >
          {notice}
        </div>
      )}

      {problem ? (
        <TestList
          problem={problem}
          results={results}
          running={running}
          onRunOne={runOne}
          renderTextBlock={renderTextBlock}
        />
      ) : (
        <div>No tests yet. Send from Competitive Companion.</div>
      )}
    </div>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
