# Messaging & Data Flow Protocol

This document defines the message schema and data flow between the VS Code extension backend and the Sidebar Webview for AC Companion Python. It complements SPEC.md and PLAN.md and is implementation-agnostic (no code included).

## Overview

Actors:
- Backend (Extension Host, Node/TS)
- Webview (Sidebar React app)
- Competitive Companion (external, sends HTTP POST)

High-level flows:
1) Receive problem → Persist tests → Update UI state
2) Run tests (single/all) → Stream/provide results → Update UI
3) Switch runtime → Update setting → Re-run as requested

## Entities

TestCaseFile
- index: number (1-based)
- inputPath: string (absolute)
- outputPath: string (absolute)

Problem
- name: string
- group: string
- url: string
- interactive: boolean
- timeLimit: number (ms)
- contestId: string
- taskId: string
- testsDir: string (relative)
- cases: TestCaseFile[]

RunSettings
- language: 'python' | 'cpp'
- interpreter: 'cpython' | 'pypy' (Python only)
- pythonCommand: string
- pypyCommand: string
- runCwdMode: 'workspace' | 'task' (initial impl: 'workspace')
- timeoutMs?: number
- compare: { mode: 'exact' /* future: 'trim'|'tokens' */; caseSensitive: boolean }

RunResult
- index: number
- status: 'pass' | 'fail' | 'timeout' | 're'
- durationMs: number
- actual: string
- console: string (stderr, filtered)
- diffSummary?: string (optional short summary when fail)

## Webview ← Backend messages

type: 'state/init'
- problem?: Problem (undefined if none loaded)
- settings: RunSettings

Example:
```json
{
  "type": "state/init",
  "problem": {
    "name": "A - ABC",
    "group": "AtCoder Beginner Contest 999",
    "url": "https://atcoder.jp/contests/abc999/tasks/abc999_a",
    "interactive": false,
    "timeLimit": 2000,
    "contestId": "abc999",
    "taskId": "abc999_a",
    "testsDir": "tests",
    "cases": [{"index":1,"inputPath":"/w/abc999/abc999_a/tests/1.in","outputPath":"/w/abc999/abc999_a/tests/1.out"}]
  },
  "settings": {
    "interpreter":"cpython",
    "pythonCommand":"python",
    "pypyCommand":"pypy3",
    "runCwdMode":"workspace",
    "timeoutMs": null,
    "compare":{"mode":"exact","caseSensitive":true}
  }
}
```

type: 'state/update'
- problem: Problem

type: 'run/progress'
- scope: 'one' | 'all'
- running: boolean
- currentIndex?: number

type: 'run/result'
- scope: 'one' | 'all'
- result: RunResult

Example (fail):
```json
{
  "type":"run/result",
  "scope":"one",
  "result":{
    "index":2,
    "status":"fail",
    "durationMs":37,
    "actual":"3\n",
    "console":"",
    "diffSummary":"line 1: expected '4' got '3'"
  }
}
```

type: 'run/complete'
- scope: 'one' | 'all'
- summary: {
  total: number; passed: number; failed: number; timeouts: number; res: number;
  durationMs: number;
}

Example:
```json
{
  "type":"run/complete",
  "scope":"all",
  "summary": { "total":3, "passed":2, "failed":1, "timeouts":0, "res":0, "durationMs":120 }
}
```

type: 'notice'
- level: 'info' | 'warn' | 'error'
- message: string

## Webview → Backend messages

type: 'ui/runOne'
- index: number

```json
{"type":"ui/runOne","index":1}
```

type: 'ui/runAll'
- indices?: number[] (if omitted, run all known cases)

```json
{"type":"ui/runAll"}
```

type: 'ui/switchRuntime'
- language: 'python' | 'cpp'
- interpreter: 'cpython' | 'pypy' (ignored when language = 'cpp')

type: 'ui/requestInit'
- none (webview requests current state on load)

## HTTP Receive (Competitive Companion → Extension)

Endpoint: `POST /` JSON body = Competitive Companion schema

Persist policy:
- Create `/<contestId>/<taskId>/<testsDir>/`
- Append new tests after the highest existing index (merge, do not overwrite)
- Write files as `N.in` and `N.out`
- Copy template to `/<contestId>/<taskId>/main.py` only if not exists

State update:
- Refresh Problem entity and cases, then send 'state/update' to Webview

## Stderr Filtering

- Suppress known PyPy CPU cache warnings (exact message varies). Use safe regex, e.g.:
  - `/Warning: cannot find your CPU .* cache size/i`
- Do not truncate Python stack traces; preserve stderr otherwise

## Diff Summary

- When a comparison fails, include a short `diffSummary` string in `run/result`
- Recommended format: `"line <n>: expected '<E>' got '<A>'"` where `<E>` and `<A>` are first differing line contents trimmed to a safe length (e.g., 120 chars)
- Do not include full unified diffs in v1 to keep payloads small; UI may later add an expand-to-diff feature

## Comparison

- Newline normalization: `\r\n` → `\n` before compare
- Default mode: `exact`
- Case sensitivity: true
