import { Toolbar } from "@astryxdesign/core/Toolbar";
import { MultiSelector } from "@astryxdesign/core/MultiSelector";
import { Selector } from "@astryxdesign/core/Selector";
import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { HStack } from "@astryxdesign/core/HStack";
import { TASK_STATUS_LABELS, TASK_PRIORITY_LABELS } from "@/lib/types";
import type { TaskFilters } from "@/hooks/useTaskFilters";
import type { WorkspaceMember, Label, Epic, Sprint, TaskStatus, TaskPriority } from "@/lib/types";

interface TaskFilterBarProps {
  filters: TaskFilters;
  hasActiveFilters: boolean;
  members: WorkspaceMember[];
  labels: Label[];
  epics: Epic[];
  sprints: Sprint[];
  onUpdateFilter: <K extends keyof TaskFilters>(key: K, value: TaskFilters[K]) => void;
  onClear: () => void;
}

export default function TaskFilterBar({
  filters, hasActiveFilters, members, labels, epics, sprints, onUpdateFilter, onClear,
}: TaskFilterBarProps) {
  const statusOptions = (Object.entries(TASK_STATUS_LABELS) as [TaskStatus, string][]).map(([value, label]) => ({ value, label }));
  const priorityOptions = (Object.entries(TASK_PRIORITY_LABELS) as [TaskPriority, string][]).map(([value, label]) => ({ value, label }));
  const assigneeOptions = members.map((m) => ({ value: m.userId, label: m.profile?.name ?? "Unknown" }));
  const labelOptions = labels.map((l) => ({ value: l.id, label: l.name }));
  const epicOptions = epics.map((e) => ({ value: e.id, label: e.title }));
  const sprintOptions = sprints.map((s) => ({ value: s.id, label: s.name }));
  const dueDateOptions = [
    { value: "overdue", label: "Overdue" },
    { value: "today", label: "Due today" },
    { value: "this_week", label: "This week" },
    { value: "no_date", label: "No date" },
  ];

  return (
    <Toolbar
      label="Task filters"
      size="sm"
      gap={1.5}
      startContent={
        <HStack gap={1.5} vAlign="center" wrap="wrap">
          <Icon icon="funnel" size="sm" color="secondary" />
          <MultiSelector
            label="Status"
            placeholder="Status"
            size="sm"
            options={statusOptions}
            value={filters.status}
            onChange={(v) => onUpdateFilter("status", v as TaskStatus[])}
          />
          <MultiSelector
            label="Priority"
            placeholder="Priority"
            size="sm"
            options={priorityOptions}
            value={filters.priority}
            onChange={(v) => onUpdateFilter("priority", v as TaskPriority[])}
          />
          {assigneeOptions.length > 0 && (
            <MultiSelector
              label="Assignee"
              placeholder="Assignee"
              size="sm"
              hasSearch
              options={assigneeOptions}
              value={filters.assigneeIds}
              onChange={(v) => onUpdateFilter("assigneeIds", v)}
            />
          )}
          {labelOptions.length > 0 && (
            <MultiSelector
              label="Labels"
              placeholder="Labels"
              size="sm"
              hasSearch
              options={labelOptions}
              value={filters.labelIds}
              onChange={(v) => onUpdateFilter("labelIds", v)}
            />
          )}
          {epicOptions.length > 0 && (
            <Selector
              label="Epic"
              placeholder="Epic"
              size="sm"
              hasClear
              options={epicOptions}
              value={filters.epicId}
              onChange={(v) => onUpdateFilter("epicId", v ?? null)}
            />
          )}
          {sprintOptions.length > 0 && (
            <Selector
              label="Sprint"
              placeholder="Sprint"
              size="sm"
              hasClear
              options={sprintOptions}
              value={filters.sprintId}
              onChange={(v) => onUpdateFilter("sprintId", v ?? null)}
            />
          )}
          <Selector
            label="Due date"
            placeholder="Due date"
            size="sm"
            hasClear
            options={dueDateOptions}
            value={filters.dueDateRange}
            onChange={(v) => onUpdateFilter("dueDateRange", (v ?? null) as TaskFilters["dueDateRange"])}
          />
        </HStack>
      }
      endContent={
        hasActiveFilters ? (
          <Button
            label="Clear"
            variant="ghost"
            size="sm"
            icon={<Icon icon="close" size="sm" />}
            onClick={onClear}
          />
        ) : undefined
      }
    />
  );
}
