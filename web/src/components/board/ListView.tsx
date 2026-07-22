import { useState, useMemo } from "react";
import { List, ListItem } from "@astryxdesign/core/List";
import { Badge } from "@astryxdesign/core/Badge";
import { Token } from "@astryxdesign/core/Token";
import { Avatar } from "@astryxdesign/core/Avatar";
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Toolbar } from "@astryxdesign/core/Toolbar";
import { Selector } from "@astryxdesign/core/Selector";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Icon } from "@astryxdesign/core/Icon";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { StackItem } from "@astryxdesign/core/Layout";
import { Divider } from "@astryxdesign/core/Divider";
import { Text } from "@astryxdesign/core/Text";
import { ClipboardList } from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import LabelBadge from "@/components/labels/LabelBadge";
import EpicBadge from "@/components/epics/EpicBadge";
import PriorityIcon from "@/components/tasks/PriorityIcon";
import { TASK_STATUS_LABELS } from "@/lib/types";
import type { Task, WorkspaceMember, Label, Epic, Sprint, TaskStatus, TaskPriority } from "@/lib/types";

type DotVariant = "success" | "warning" | "error" | "accent" | "neutral";

const STATUS_DOT_VARIANT: Record<TaskStatus, DotVariant> = {
  backlog: "neutral",
  todo: "neutral",
  in_progress: "accent",
  in_review: "warning",
  done: "success",
};

function tsToDate(ts: unknown): Date | null {
  if (!ts) return null;
  if (typeof (ts as { toDate?: () => Date }).toDate === "function") return (ts as { toDate: () => Date }).toDate();
  return new Date(ts as string);
}

type SortKey = "title" | "status" | "priority" | "assignee" | "dueDate" | "storyPoints";
type SortDir = "asc" | "desc";

const STATUS_ORDER: TaskStatus[] = ["backlog", "todo", "in_progress", "in_review", "done"];
const PRIORITY_ORDER: TaskPriority[] = ["none", "low", "medium", "high", "urgent"];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "status", label: "Status" },
  { value: "title", label: "Title" },
  { value: "priority", label: "Priority" },
  { value: "assignee", label: "Assignee" },
  { value: "dueDate", label: "Due date" },
  { value: "storyPoints", label: "Story points" },
];

interface ListViewProps {
  tasks: Task[];
  members: WorkspaceMember[];
  labels: Label[];
  epics?: Epic[];
  sprints?: Sprint[];
  taskIdentifiers?: Map<string, string>;
  onSelectTask: (id: string) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}

export default function ListView({ tasks, members, labels, epics = [], sprints = [], taskIdentifiers, onSelectTask, selectedIds, onToggleSelect }: ListViewProps) {
  const [sortKey, setSortKey] = useState<SortKey>("status");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const showCheckboxes = !!onToggleSelect;

  const memberMap = useMemo(() => {
    const m = new Map<string, string>();
    members.forEach((mem) => m.set(mem.userId, mem.profile?.name ?? "Unknown"));
    return m;
  }, [members]);

  const avatarMap = useMemo(() => {
    const m = new Map<string, string | null>();
    members.forEach((mem) => m.set(mem.userId, mem.profile?.avatarUrl ?? null));
    return m;
  }, [members]);

  const labelMap = useMemo(() => {
    const m = new Map<string, Label>();
    labels.forEach((l) => m.set(l.id, l));
    return m;
  }, [labels]);

  const epicMap = useMemo(() => {
    const m = new Map<string, Epic>();
    epics.forEach((e) => m.set(e.id, e));
    return m;
  }, [epics]);

  const sprintMap = useMemo(() => {
    const m = new Map<string, Sprint>();
    sprints.forEach((s) => m.set(s.id, s));
    return m;
  }, [sprints]);

  const sorted = useMemo(() => {
    const arr = [...tasks];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      switch (sortKey) {
        case "title":
          return dir * a.title.localeCompare(b.title);
        case "status":
          return dir * (STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));
        case "priority":
          return dir * (PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority));
        case "assignee": {
          const aName = a.assigneeId ? memberMap.get(a.assigneeId) ?? "" : "";
          const bName = b.assigneeId ? memberMap.get(b.assigneeId) ?? "" : "";
          return dir * aName.localeCompare(bName);
        }
        case "dueDate": {
          const aDate = tsToDate(a.dueDate)?.getTime() ?? Infinity;
          const bDate = tsToDate(b.dueDate)?.getTime() ?? Infinity;
          return dir * (aDate - bDate);
        }
        case "storyPoints":
          return dir * ((a.storyPoints ?? -1) - (b.storyPoints ?? -1));
        default:
          return 0;
      }
    });
    return arr;
  }, [tasks, sortKey, sortDir, memberMap]);

  return (
    <VStack height="100%">
      <Toolbar
        label="Sort tasks"
        size="sm"
        startContent={
          <Selector
            label="Sort by"
            isLabelHidden
            size="sm"
            value={sortKey}
            onChange={(v) => setSortKey(v as SortKey)}
            options={SORT_OPTIONS}
          />
        }
        endContent={
          <IconButton
            label={sortDir === "asc" ? "Sort ascending" : "Sort descending"}
            size="sm"
            variant="ghost"
            tooltip="Toggle sort direction"
            icon={<Icon icon="arrowsUpDown" size="sm" />}
            onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
          />
        }
      />
      <Divider />
      <StackItem size="fill" isScrollable>
        {sorted.length === 0 ? (
          <EmptyState
            icon={<Icon icon={ClipboardList} size="lg" color="secondary" />}
            title="No tasks yet"
            description="Tasks in this project will appear here."
          />
        ) : (
          <List hasDividers density="compact">
            {sorted.map((task) => {
              const dueDate = tsToDate(task.dueDate);
              const isOverdue = dueDate && isPast(dueDate) && task.status !== "done";
              const isDueToday = dueDate && isToday(dueDate);
              const dueColor = isOverdue ? "red" : isDueToday ? "yellow" : "gray";
              const assigneeName = task.assigneeId ? memberMap.get(task.assigneeId) : null;
              const taskLabels = task.labelIds?.length
                ? (task.labelIds.map((id) => labelMap.get(id)).filter(Boolean) as Label[])
                : [];
              const isSelected = selectedIds?.has(task.id) ?? false;
              const epic = task.epicId ? epicMap.get(task.epicId) : null;
              const sprint = task.sprintId ? sprintMap.get(task.sprintId) : null;
              const identifier = taskIdentifiers?.get(task.id);

              return (
                <ListItem
                  key={task.id}
                  label={task.title}
                  isSelected={isSelected}
                  onClick={() => onSelectTask(task.id)}
                  startContent={
                    <HStack gap={2} vAlign="center">
                      {showCheckboxes && (
                        <CheckboxInput
                          label={`Select ${task.title}`}
                          isLabelHidden
                          size="sm"
                          value={isSelected}
                          onChange={() => onToggleSelect!(task.id)}
                        />
                      )}
                      <StatusDot
                        variant={STATUS_DOT_VARIANT[task.status]}
                        label={TASK_STATUS_LABELS[task.status]}
                        tooltip={TASK_STATUS_LABELS[task.status]}
                      />
                      {task.priority !== "none" && <PriorityIcon priority={task.priority} />}
                    </HStack>
                  }
                  description={
                    <HStack gap={1.5} vAlign="center" wrap="wrap">
                      {identifier && <Text type="code" size="2xs" color="secondary">{identifier}</Text>}
                      {taskLabels.map((l) => <LabelBadge key={l.id} name={l.name} color={l.color} />)}
                      {epic && <EpicBadge title={epic.title} color={epic.color} />}
                      {sprint && <Token label={sprint.name} color="purple" size="sm" />}
                    </HStack>
                  }
                  endContent={
                    <HStack gap={2} vAlign="center">
                      {dueDate && <Token label={format(dueDate, "MMM d")} color={dueColor} size="sm" />}
                      {task.storyPoints != null && task.storyPoints > 0 && (
                        <Badge label={String(task.storyPoints)} variant="neutral" />
                      )}
                      {assigneeName && (
                        <Avatar size="xsmall" name={assigneeName} src={avatarMap.get(task.assigneeId!) ?? undefined} />
                      )}
                    </HStack>
                  }
                />
              );
            })}
          </List>
        )}
      </StackItem>
    </VStack>
  );
}
