# Contributing Guide (Docs-First Phase)

This repository is currently in a documentation-only planning phase for the AC Companion extension. No implementation changes should be made until explicitly approved.

## Workflow

1. Create a feature branch
   - Base: `main`
   - Suggested name: `feat/runner-and-sidebar`
2. Make small, focused commits
   - Keep builds passing; do not mix unrelated changes
   - Commit message style: short imperative summary; body if needed
3. Open a PR early
   - Push regularly for visibility and feedback
4. Documentation-first
   - Update `docs/SPEC.md`, `docs/PLAN.md`, `docs/PROTOCOL.md`, `docs/CONFIG.md`, `docs/TESTING.md`, `docs/UI.md`, `docs/MERGE_POLICY.md` as needed
5. No implementation yet
   - Do not modify `src/` or `media/` until the plan is approved

## Coding Style & Comments

- Modularity
  - Split by responsibility: receiver, persistence, runner, compare, stderr filter, settings, webview messaging, state, UI
  - Prefer small files/components; keep functions focused and testable
- TypeScript
  - Use explicit types and interfaces; avoid `any`
  - Keep pure helpers side-effect free where possible
- Comments & JSDoc（日本語推奨）
  - Add concise Japanese comments for non-obvious logic and intent
  - Public modules/classes/functions must have JSDoc
  - Recommended tags: `@param`, `@returns`, `@throws`, `@example`
  - Keep line length reasonable; avoid repeating obvious code
- Naming
  - Avoid one-letter variable names; prefer descriptive identifiers
  - File names reflect role (e.g., `runner.ts`, `comparator.ts`, `pypyFilter.ts`)

### JSDoc Example

```ts
/**
 * 指定したテストケースを実行し、結果を返します。
 * タイムアウトや実行時例外はステータスで表現します。
 * @param index 実行するテストケースの 1 始まりインデックス
 * @returns 実行結果（ステータス、所要時間、Actual、Console）
 */
export async function runOne(index: number): Promise<RunResult> {
  /* ... */
}
```

## Commit Examples

- docs(plan): add protocol payload examples and UI states
- docs(spec): link merge policy and testing checklist
- docs(test): add manual verification for PyPy stderr filtering

## Reviews

- Reviewers should check consistency across docs, clarity of acceptance criteria, and feasibility on devcontainer Ubuntu
