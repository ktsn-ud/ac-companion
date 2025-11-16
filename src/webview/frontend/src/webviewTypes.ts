export type RunStatus = "AC" | "WA" | "TLE" | "RE";

export interface ProblemCase {
  index: number;
  inputPath: string;
  outputPath: string;
  inputContent: string;
  expectedContent: string;
}

export interface Problem {
  name: string;
  group: string;
  url: string;
  interactive: boolean;
  timeLimit: number;
  contestId: string;
  taskId: string;
  testsDir: string;
  cases: ProblemCase[];
}

export interface RunSettings {
  interpreter: "cpython" | "pypy" | "codon";
  pythonCommand: string;
  pypyCommand: string;
  runCwdMode: "workspace" | "task";
  timeoutMs: number | null;
  compare: {
    mode: "exact";
    caseSensitive: boolean;
  };
}

export interface RunResult {
  index: number;
  status: RunStatus;
  durationMs: number;
  actual: string;
  console: string;
  diffSummary?: string;
}

export type Message =
  | {
      type: "state/init" | "state/update";
      problem?: Problem;
      settings: RunSettings;
    }
  | {
      type: "run/progress";
      scope: "one" | "all";
      running: boolean;
      currentIndex?: number;
    }
  | {
      type: "run/result";
      scope: "one" | "all";
      result: RunResult;
    }
  | {
      type: "run/complete";
      scope: "one" | "all";
      summary: {
        total: number;
        passed: number;
        failed: number;
        timeouts: number;
        res: number;
        durationMs: number;
      };
    }
  | {
      type: "notice";
      level: "info" | "warn" | "error";
      message: string;
    }
  | {
      type: "ui/requestInit";
    }
  | {
      type: "ui/runAll";
    }
  | {
      type: "ui/runOne";
      index: number;
    }
  | {
      type: "ui/switchInterpreter";
      interpreter: "cpython" | "pypy" | "codon";
    };
