# Configuration Schema

This document enumerates user-facing settings for AC Companion and their semantics. It serves as the source of truth for `package.json` contributes.

## Settings

- `ac-companion.port`

  - type: number, default: 10043
  - Description: Port number for Competitive Companion POST endpoint

- `ac-companion.testCaseSaveDirName`

  - type: string, default: "tests"
  - Description: Directory name to store `.in/.out` files under the task folder

- `ac-companion.templateFilePath`

  - type: string, default: ".config/templates/main.py"
  - Description: Path to the Python template copied to `main.py` if missing

- `ac-companion.templateFilePathCpp`

  - type: string, default: ".config/templates/main.cpp"
  - Description: Path to the C++ template copied to `main.cpp` if missing

- `ac-companion.language`

  - type: string enum: ["python", "cpp"], default: "python"
  - Description: Selects runtime language for local runs. When `cpp`, the extension uses external compile/run commands instead of Python interpreters.

- `ac-companion.interpreter`

  - type: string enum: ["cpython", "pypy"], default: "cpython"
  - Description: Selects interpreter for Python runs (ignored when `language = "cpp"`)

- `ac-companion.pythonCommand`

  - type: string, default: "python"
  - Description: Executable name/path for CPython

- `ac-companion.pypyCommand`

  - type: string, default: "pypy3"
  - Description: Executable name/path for PyPy

- `ac-companion.cppCompileCommand`

  - type: string, default: "cpp_compile"
  - Description: Command to compile C++ solutions. Called as `cpp_compile <contestId> <taskId>` with `WORKSPACE_DIR` set to workspace root. If empty, falls back to the default name.

- `ac-companion.cppRunCommand`

  - type: string, default: "cpp_run"
  - Description: Command to run compiled C++ binaries. Called as `cpp_run <contestId> <taskId> <inputFile>` with `WORKSPACE_DIR` set to workspace root. If empty, falls back to the default name.

- `ac-companion.runCwdMode`

  - type: string enum: ["workspace", "task"], default: "workspace"
  - Description: Working directory during execution (initial implementation uses workspace)

- `ac-companion.timeoutMs`

  - type: number | null, default: null
  - Description: Per-test timeout override in milliseconds; if null, use `ceil(timeLimit * 1.2)`

- `ac-companion.compare.mode`

  - type: string enum: ["exact" /* future: "trim", "tokens" */], default: "exact"
  - Description: Output comparison mode

- `ac-companion.compare.caseSensitive`
  - type: boolean, default: true
  - Description: Case sensitivity for comparison

## package.json contributes (illustrative)

```jsonc
{
  "contributes": {
    "configuration": {
      "title": "AC Companion",
      "properties": {
        "ac-companion.port": { "type": "number", "default": 10043 },
        "ac-companion.testCaseSaveDirName": {
          "type": "string",
          "default": "tests"
        },
        "ac-companion.templateFilePath": {
          "type": "string",
          "default": ".config/templates/main.py"
        },
        "ac-companion.templateFilePathCpp": {
          "type": "string",
          "default": ".config/templates/main.cpp"
        },
        "ac-companion.language": {
          "type": "string",
          "enum": ["python", "cpp"],
          "default": "python"
        },
        "ac-companion.interpreter": {
          "type": "string",
          "enum": ["cpython", "pypy"],
          "default": "cpython"
        },
        "ac-companion.pythonCommand": {
          "type": "string",
          "default": "python"
        },
        "ac-companion.pypyCommand": {
          "type": "string",
          "default": "pypy3"
        },
        "ac-companion.cppCompileCommand": {
          "type": "string",
          "default": "cpp_compile"
        },
        "ac-companion.cppRunCommand": {
          "type": "string",
          "default": "cpp_run"
        },
        "ac-companion.runCwdMode": {
          "type": "string",
          "enum": ["workspace", "task"],
          "default": "workspace"
        },
        "ac-companion.timeoutMs": {
          "type": ["number", "null"],
          "default": null
        },
        "ac-companion.compare.mode": {
          "type": "string",
          "enum": ["exact"],
          "default": "exact"
        },
        "ac-companion.compare.caseSensitive": {
          "type": "boolean",
          "default": true
        }
      }
    }
  }
}
```
