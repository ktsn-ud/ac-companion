# AC Companion Implementation Plan

This plan translates the agreed specification into actionable milestones. No implementation is performed in this commit; it only documents the approach, branch strategy, commit plan, and acceptance criteria.

## Branching & Commit Strategy

- Create a feature branch for this effort: `feat/runner-and-sidebar`
- Commit frequently with focused scope:
  - One commit per logical unit (config schema, runner, UI wiring, etc.)
  - Keep commits buildable; avoid mixing unrelated changes
  - Follow sequence below; open a PR early and push regularly

## Milestones

### M0 — Baseline

- Create branch `feat/runner-and-sidebar`
- Verify compile and extension activation on devcontainer Ubuntu

### M1 — Settings & Types

- Add new settings (without behavior yet):
  - `ac-companion.interpreter` (default: `cpython`)
  - `ac-companion.pythonCommand` (default: `python`)
  - `ac-companion.pypyCommand` (default: `pypy3`)
  - `ac-companion.runCwdMode` (default: `workspace`)
  - `ac-companion.timeoutMs` (optional)
  - `ac-companion.compare.mode` (default: `exact`)
  - `ac-companion.compare.caseSensitive` (default: `true`)
- Define TS types for settings and runner results
- Update README/SPEC with the settings list and defaults
- Deliverables: CONFIG.md finalized, package.json contributes snippet ready (no code changes)

### M2 — Test Case Persistence (Merge Policy)

- Implement merge on receive:
  - Read existing `n.in/out` files
  - Determine next index `n+1, ...` for new tests
  - Append new `.in/.out` pairs without overwriting existing files
- Ensure idempotent directory creation
- Keep template copy behavior: skip if `main.py` exists
- Deliverables: documented algorithm and edge cases in SPEC/PROTOCOL; `docs/MERGE_POLICY.md` added (no implementation)

### M3 — Runner Service (Backend)

- Implement a Node/TS runner that:
  - Resolves interpreter command based on settings (`cpython` → `python`, `pypy` → `pypy3`)
  - Launches child process with stdin from `.in` content
  - Captures stdout (Actual), stderr (Console)
  - Applies timeout: `timeoutMs ?? ceil(timeLimit * 1.2)`
  - Normalizes newlines to `\n` for comparison
  - Comparison mode: `exact` (default)
  - Filters known PyPy noise in Console: CPU cache warning lines
  - Sets working directory per `runCwdMode` (initially `workspace` only)
- Define return envelope: status (`pass|fail|timeout|re`), duration, actual, console, diff summary
- Deliverables: PROTOCOL.md message shapes, stderr filter regex, comparison rules locked

### M4 — Commands & Contribution Points

- Add commands:
  - `ac-companion.runAll`
  - `ac-companion.runOne` (accepts test index)
  - `ac-companion.switchInterpreter`
- Wire commands to runner service and webview messaging
- Update `package.json` contributes section and command titles
- Deliverables: command IDs/names documented; keybindings out of scope for v1

### M5 — Sidebar UI (Webview)

- Render header: `name`, `group`, interpreter toggle (CPython/PyPy), Run All button
- Render test list: index, Expected (collapsible), Actual after run, status badge
- Per-test Run button; in-flight indicator; cancel if feasible (stretch)
- Show Console on failure only; suppress known PyPy warning lines
- Deliverables: UI states and message handling flows documented (wireframe-level) in `docs/UI.md`, no assets added

### M6 — Messaging & State

- Implement state store in extension (in-memory only)
- Webview ↔ Extension message protocol:
  - `loadProblem`, `runAll`, `runOne`, `switchInterpreter`, `results`
- Update view on new test reception and run completion
- Deliverables: PROTOCOL.md complete; in-memory state model diagram (logical)

### M7 — Manual Verification (Devcontainer Ubuntu)

- Seed a sample problem directory with tests
- Verify both interpreters run
- Validate timeout behavior and exact comparison
- Validate merge policy on re-import
- Deliverables: TESTING.md checklist (added)

### M8 — Parallelization (Follow-up)

- Introduce concurrency setting and a simple task queue
- Ensure UI progress remains responsive
- Keep per-case outputs isolated
- Deliverables: design note for worker pool and concurrency cap

### M9 — Polish & Docs

- Update README and SPEC to reflect implemented behavior
- Add troubleshooting (interpreter not found, permission issues)
- Finalize command palette entries and icons (optional)
- Deliverables: SPEC.md/CONFIG.md/PROTOCOL.md/TESTING.md/UI.md/MERGE_POLICY.md consistent and up to date

## Acceptance Criteria

- Test cases are appended without overwriting existing files
- `main.py` is not overwritten if it already exists
- Run All and Run One execute tests with exact comparison and timeout rules
- Interpreter toggle switches between `python` and `pypy3`
- Sidebar displays Expected/Actual and shows Console only on failure (with PyPy noise filtered)
- Working directory is the workspace root
- Interactive problems are marked unsupported and not runnable
- No persistent storage of results; state is in-memory
- Documentation is sufficient for another contributor to implement without ambiguity
- Code organization emphasizes maintainable modular splits per responsibility
- Public APIs and non-trivial logic include Japanese comments/JSDoc where helpful

## Risks & Mitigations

- Interpreter resolution differences across environments → Lock to devcontainer Ubuntu; document assumptions
- Large outputs causing UI slowness → Collapse Actual by default on pass; limit rendering size if needed (future)
- PyPy warnings variability → Use conservative regex; allow future opt-out setting

## Commit Plan (Granular)

1. M0: create branch and baseline commit
2. M1: add settings schema and types (docs only)
3. M2: define merge policy (docs only)
4. M3: define runner behavior & envelopes (docs only)
5. M4: document commands and contribution points (docs only)
6. M5: sidebar UI design and flows (docs only)
7. M6: messaging/state protocol (docs only)
8. M7: add TESTING.md checklist
9. M8: parallelization design note
10. M9: polish and finalize docs

## Notes

- Do not implement yet; this file is planning only
- Use small commits; keep PR progress visible
