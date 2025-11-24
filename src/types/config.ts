export type Language = "python" | "cpp";
export type Interpreter = "cpython" | "pypy";
export type RunCwdMode = "workspace" | "task";

export interface CompareSettings {
  mode: "exact";
  caseSensitive: boolean;
}

export interface AcCompanionPythonSettings {
  port: number;
  testCaseSaveDirName: string;
  templateFilePath: string;
  templateFilePathCpp: string;
  language: Language;
  interpreter: Interpreter;
  pythonCommand: string;
  pypyCommand: string;
  cppCompileCommand: string;
  cppRunCommand: string;
  runCwdMode: RunCwdMode;
  timeoutMs: number | null;
  compare: CompareSettings;
}
