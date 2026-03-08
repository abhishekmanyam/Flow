import { useState, useMemo, useCallback } from "react";
import type { Task, TaskStatus, TaskPriority } from "@/lib/types";

export interface TaskFilters {
  status: TaskStatus[];
  priority: TaskPriority[];
  assigneeIds: string[];
  labelIds: string[];
  epicId: string | null;
  sprintId: string | null;
  dueDateRange: "overdue" | "today" | "this_week" | "no_date" | null;
}

const EMPTY_FILTERS: TaskFilters = {
  status: [],
  priority: [],
  assigneeIds: [],
  labelIds: [],
  epicId: null,
  sprintId: null,
  dueDateRange: null,
};

function isOverdue(ts: unknown): boolean {
  if (!ts) return false;
  const d = typeof (ts as { toDate?: () => Date }).toDate === "function"
    ? (ts as { toDate: () => Date }).toDate()
    : new Date(ts as string);
  return d < new Date(new Date().toDateString());
}

function isToday(ts: unknown): boolean {
  if (!ts) return false;
  const d = typeof (ts as { toDate?: () => Date }).toDate === "function"
    ? (ts as { toDate: () => Date }).toDate()
    : new Date(ts as string);
  const today = new Date();
  return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
}

function isThisWeek(ts: unknown): boolean {
  if (!ts) return false;
  const d = typeof (ts as { toDate?: () => Date }).toDate === "function"
    ? (ts as { toDate: () => Date }).toDate()
    : new Date(ts as string);
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);
  return d >= startOfWeek && d < endOfWeek;
}

export function useTaskFilters(tasks: Task[]) {
  const [filters, setFilters] = useState<TaskFilters>(EMPTY_FILTERS);

  const hasActiveFilters = useMemo(() => {
    return (
      filters.status.length > 0 ||
      filters.priority.length > 0 ||
      filters.assigneeIds.length > 0 ||
      filters.labelIds.length > 0 ||
      filters.epicId !== null ||
      filters.sprintId !== null ||
      filters.dueDateRange !== null
    );
  }, [filters]);

  const filteredTasks = useMemo(() => {
    if (!hasActiveFilters) return tasks;
    return tasks.filter((task) => {
      if (filters.status.length > 0 && !filters.status.includes(task.status)) return false;
      if (filters.priority.length > 0 && !filters.priority.includes(task.priority)) return false;
      if (filters.assigneeIds.length > 0) {
        if (!task.assigneeId || !filters.assigneeIds.includes(task.assigneeId)) return false;
      }
      if (filters.labelIds.length > 0) {
        if (!task.labelIds?.some((id) => filters.labelIds.includes(id))) return false;
      }
      if (filters.epicId !== null && task.epicId !== filters.epicId) return false;
      if (filters.sprintId !== null && task.sprintId !== filters.sprintId) return false;
      if (filters.dueDateRange !== null) {
        switch (filters.dueDateRange) {
          case "overdue": if (!isOverdue(task.dueDate) || task.status === "done") return false; break;
          case "today": if (!isToday(task.dueDate)) return false; break;
          case "this_week": if (!isThisWeek(task.dueDate)) return false; break;
          case "no_date": if (task.dueDate != null) return false; break;
        }
      }
      return true;
    });
  }, [tasks, filters, hasActiveFilters]);

  const updateFilter = useCallback(<K extends keyof TaskFilters>(key: K, value: TaskFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS);
  }, []);

  return { filters, filteredTasks, hasActiveFilters, updateFilter, clearFilters };
}
