# Configuration Schema

This document enumerates user-facing settings for AC Companion Python and their semantics. It serves as the source of truth for `package.json` contributes.

## Settings

- `ac-companion-python.port`
  - type: number, default: 10043
  - Description: Port number for Competitive Companion POST endpoint

- `ac-companion-python.testCaseSaveDirName`
  - type: string, default: "tests"
  - Description: Directory name to store `.in/.out` files under the task folder

- `ac-companion-python.templateFilePath`
  - type: string, default: ".config/templates/main.py"
  - Description: Path to the Python template copied to `main.py` if missing

- `ac-companion-python.templateFilePathCpp`
  - type: string, default: ".config/templates/main.cpp"
  - Description: Path to the C++ template copied to `main.cpp` if missing

- `ac-companion-python.language`
  - type: string enum: ["python", "cpp"], default: "python"
  - Description: Selects runtime language for local runs. When `cpp`, the extension uses external compile/run commands instead of Python interpreters.

- `ac-companion-python.interpreter`
  - type: string enum: ["cpython", "pypy"], default: "cpython"
  - Description: Selects interpreter for Python runs (ignored when `language = "cpp"`)

- `ac-companion-python.pythonCommand`
  - type: string, default: "python"
  - Description: Executable name/path for CPython

- `ac-companion-python.pypyCommand`
  - type: string, default: "pypy3"
  - Description: Executable name/path for PyPy

- `ac-companion-python.cppCompileCommand`
  - type: string, default: "cpp_compile"
  - Description: Command to compile C++ solutions. Called as `cpp_compile <contestId> <taskId>` with `WORKSPACE_DIR` set to workspace root. If empty, falls back to the default name.

- `ac-companion-python.cppRunCommand`
  - type: string, default: "cpp_run"
  - Description: Command to run compiled C++ binaries. Called as `cpp_run <contestId> <taskId> <inputFile>` with `WORKSPACE_DIR` set to workspace root. If empty, falls back to the default name.

- `ac-companion-python.runCwdMode`
  - type: string enum: ["workspace", "task"], default: "workspace"
  - Description: Working directory during execution (initial implementation uses workspace)

- `ac-companion-python.timeoutMs`
  - type: number | null, default: null
  - Description: Per-test timeout override in milliseconds; if null, use `ceil(timeLimit * 1.2)`

- `ac-companion-python.compare.mode`
  - type: string enum: ["exact" /* future: "trim", "tokens" */], default: "exact"
  - Description: Output comparison mode

- `ac-companion-python.compare.caseSensitive`
  - type: boolean, default: true
  - Description: Case sensitivity for comparison

## package.json contributes (illustrative)

```jsonc
{
  "contributes": {
    "configuration": {
      "title": "AC Companion Python",
      "properties": {
        "ac-companion-python.port": { "type": "number", "default": 10043 },
        "ac-companion-python.testCaseSaveDirName": { "type": "string", "default": "tests" },
        "ac-companion-python.templateFilePath": { "type": "string", "default": ".config/templates/main.py" },
        "ac-companion-python.templateFilePathCpp": { "type": "string", "default": ".config/templates/main.cpp" },
        "ac-companion-python.language": { "type": "string", "enum": ["python", "cpp"], "default": "python" },
        "ac-companion-python.interpreter": { "type": "string", "enum": ["cpython", "pypy"], "default": "cpython" },
        "ac-companion-python.pythonCommand": { "type": "string", "default": "python" },
        "ac-companion-python.pypyCommand": { "type": "string", "default": "pypy3" },
        "ac-companion-python.cppCompileCommand": { "type": "string", "default": "cpp_compile" },
        "ac-companion-python.cppRunCommand": { "type": "string", "default": "cpp_run" },
        "ac-companion-python.runCwdMode": { "type": "string", "enum": ["workspace", "task"], "default": "workspace" },
        "ac-companion-python.timeoutMs": { "type": ["number", "null"], "default": null },
        "ac-companion-python.compare.mode": { "type": "string", "enum": ["exact"], "default": "exact" },
        "ac-companion-python.compare.caseSensitive": { "type": "boolean", "default": true }
      }
    }
  }
}
```
