import React from "react";
import { RunSettings } from "../webviewTypes";

const runtimeOrder: Array<Pick<RunSettings, "language" | "interpreter">> = [
  { language: "python", interpreter: "cpython" },
  { language: "python", interpreter: "pypy" },
  { language: "cpp", interpreter: "cpython" },
];

const runtimeLabel: Record<string, string> = {
  "python:cpython": "Python (CPython)",
  "python:pypy": "Python (PyPy)",
  "cpp:cpython": "C++",
  "cpp:pypy": "C++",
};

export interface HeaderControlsProps {
  settings: RunSettings | null;
  running: boolean;
  statusText: string;
  timeoutLabel: string;
  onRunAll: () => void;
  onToggleInterpreter: () => void;
}

export const HeaderControls: React.FC<HeaderControlsProps> = ({
  settings,
  running,
  statusText,
  timeoutLabel,
  onRunAll,
  onToggleInterpreter,
}) => {
  const runtimeKey = settings
    ? `${settings.language}:${settings.interpreter}`
    : null;
  const currentIndex = runtimeKey
    ? runtimeOrder.findIndex(
        (item) =>
          item.language === settings?.language &&
          item.interpreter === settings?.interpreter
      )
    : -1;
  const safeIndex = currentIndex >= 0 ? currentIndex : 0;
  const nextRuntime = runtimeOrder[(safeIndex + 1) % runtimeOrder.length];
  const nextLabel =
    runtimeLabel[`${nextRuntime.language}:${nextRuntime.interpreter}`];
  const buttonLabel = settings
    ? `Switch to ${nextLabel}`
    : "Switch Runtime";
  const currentLabel = runtimeKey ? runtimeLabel[runtimeKey] : null;

  return (
    <header>
      <h1>AC Companion Python</h1>
      <div className="text-muted-foreground my-2">
        {settings
          ? `Runtime: ${currentLabel} | Timeout: ${timeoutLabel}`
          : "Nothing loaded yet."}
      </div>
      <button
        disabled={!settings || running}
        onClick={onToggleInterpreter}
        className="block my-2 bg-secondary text-secondary-foreground rounded px-3 py-1"
      >
        {buttonLabel}
      </button>
      <div className="bg-muted-foreground h-px my-4"></div>
      <div className="flex gap-3 mb-2 items-center">
        <button
          disabled={!settings || running}
          onClick={onRunAll}
          className="bg-primary hover:bg-primary-hover text-primary-foreground rounded px-3 py-1"
        >
          Run All Tests
        </button>
        <span className="text-muted-foreground">{statusText}</span>
      </div>
    </header>
  );
};
