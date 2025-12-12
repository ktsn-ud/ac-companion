import * as path from "path";

/**
 * Compute absolute path to the contest root from workspace and config value.
 */
export function resolveContestBasePath(
  workspaceRoot: string,
  contestBaseDir: string
): string {
  const normalized = contestBaseDir.trim();
  if (path.isAbsolute(normalized)) {
    return normalized;
  }
  if (!normalized || normalized === ".") {
    return workspaceRoot;
  }
  return path.join(workspaceRoot, normalized);
}

export function resolveTaskDir(
  workspaceRoot: string,
  contestBaseDir: string,
  contestId: string,
  taskId: string
): string {
  const contestRoot = resolveContestBasePath(workspaceRoot, contestBaseDir);
  return path.join(contestRoot, contestId, taskId);
}

export function resolveTestsDir(
  workspaceRoot: string,
  contestBaseDir: string,
  contestId: string,
  taskId: string,
  testsDir: string
): string {
  const taskDir = resolveTaskDir(
    workspaceRoot,
    contestBaseDir,
    contestId,
    taskId
  );
  return path.join(taskDir, testsDir);
}
