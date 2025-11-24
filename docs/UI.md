# Sidebar UI Specification

This document defines the Sidebar UI for AC Companion, covering layout, states, and behaviors. No implementation is included.

## Layout

Header

- Title: Problem name (primary) and group (secondary)
- Controls: Interpreter toggle [CPython | PyPy], Run All button

Body

- Test List (collapsible by default if > 10 tests)
  - Row per test: `#<index>` + status badge + per-test Run button
  - Sections inside each row (expandable):
    - Expected (read-only, monospace)
    - Actual (after run, monospace)
    - Console (stderr on failure only, monospace)

Footer

- Runtime info: interpreter, timeout ms, cwd mode

## States

1. Idle (no problem loaded)

- Empty state message: "No tests yet. Send from Competitive Companion."
- Disabled controls except interpreter toggle

2. Problem loaded (not run)

- Render header with name/group
- Show test list with Expected sections collapsed
- Enable Run All and per-test Run

3. Running

- Global spinner near Run All when running all
- Per-test spinner on running row when running one
- Disable conflicting actions (prevent duplicate runs)

4. Results (post-run)

- Status badge values: Pass (green), Fail (red), Timeout (orange), RE (purple)
- Actual visible by default for failed tests; collapsed for passed tests
- Console visible only for failed tests; suppress known PyPy warning lines

## Behavior

- Interpreter toggle updates setting and optionally offers to re-run last scope
- Run All executes tests serially (v1)
- Run One executes only selected index
- Keyboard focus order respects accessibility; buttons are reachable by tab
- Monospace sections support copy; limit very long content with collapsible containers

## Status Badge Tokens

- pass: background `#2EA043`, fg `#FFFFFF`
- fail: background `#D1242F`, fg `#FFFFFF`
- timeout: background `#DAAA3F`, fg `#000000`
- re: background `#8957E5`, fg `#FFFFFF`

## Empty & Unsupported Cases

- Interactive problems: show inline banner "Interactive problems are not supported" and disable run controls
- Missing interpreters: show warning notice with remediation steps

## Wireframe (Text)

```
[AC Companion]            [CPython ▾] [Run All]
Problem: <name>
Group:   <group>

Tests (N)
  #1  [Status] [Run]
    Expected  ▸
    Actual    ▸
    Console   ▸
  #2  [Status] [Run]
    ...

Runtime: interp=CPython  timeout=1800ms  cwd=workspace
```
