import type { Task, Project } from "./types";

/**
 * Extract a short prefix from a project name.
 * "Frontend App" → "FA", "backend" → "BAC", "My Cool Project" → "MCP"
 */
export function getProjectPrefix(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].slice(0, 3).toUpperCase();
  }
  return words
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 4);
}

/**
 * Build a map of taskId → human-readable identifier (e.g. "FA-12").
 * Tasks are numbered by creation order within the project.
 */
export function buildTaskIdentifiers(
  project: Project,
  tasks: Task[]
): Map<string, string> {
  const prefix = getProjectPrefix(project.name);
  const sorted = [...tasks].sort((a, b) => {
    const aTime = a.createdAt
      ? ((a.createdAt as unknown as { toDate?: () => Date }).toDate?.()?.getTime() ?? 0)
      : 0;
    const bTime = b.createdAt
      ? ((b.createdAt as unknown as { toDate?: () => Date }).toDate?.()?.getTime() ?? 0)
      : 0;
    return aTime - bTime;
  });
  const map = new Map<string, string>();
  sorted.forEach((task, i) => {
    map.set(task.id, `${prefix}-${i + 1}`);
  });
  return map;
}
