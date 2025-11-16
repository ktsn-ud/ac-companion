export type Interpreter = "cpython" | "pypy" | "codon";
export type RunCwdMode = "workspace" | "task";

export interface CompareSettings {
  mode: "exact";
  caseSensitive: boolean;
}

export interface AcCompanionPythonSettings {
  port: number;
  testCaseSaveDirName: string;
  templateFilePath: string;
  interpreter: Interpreter;
  pythonCommand: string;
  pypyCommand: string;
  codonCommand: string;
  codonBuildArgs: string[];
  codonOutputName: string;
  runCwdMode: RunCwdMode;
  timeoutMs: number | null;
  compare: CompareSettings;
}
