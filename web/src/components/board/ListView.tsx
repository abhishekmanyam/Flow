import { useState, useMemo } from "react";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, isPast, isToday } from "date-fns";
import { cn } from "@/lib/utils";
import LabelBadge from "@/components/labels/LabelBadge";
import EpicBadge from "@/components/epics/EpicBadge";
import PriorityIcon from "@/components/tasks/PriorityIcon";
import { TASK_STATUS_LABELS, STATUS_DOT_COLORS } from "@/lib/types";
import type { Task, WorkspaceMember, Label, Epic, Sprint, TaskStatus, TaskPriority } from "@/lib/types";

function tsToDate(ts: unknown): Date | null {
  if (!ts) return null;
  if (typeof (ts as { toDate?: () => Date }).toDate === "function") return (ts as { toDate: () => Date }).toDate();
  return new Date(ts as string);
}

function getInitials(name: string | null | undefined) {
  if (!name) return "?";
  return name.split(/\s/).map((s) => s[0]?.toUpperCase()).slice(0, 2).join("");
}

type SortKey = "title" | "status" | "priority" | "assignee" | "dueDate" | "storyPoints";
type SortDir = "asc" | "desc";

const STATUS_ORDER: TaskStatus[] = ["backlog", "todo", "in_progress", "in_review", "done"];
const PRIORITY_ORDER: TaskPriority[] = ["none", "low", "medium", "high", "urgent"];

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

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

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

  const SortButton = ({ label, sortKeyVal }: { label: string; sortKeyVal: SortKey }) => (
    <Button variant="ghost" size="sm" className="h-auto p-0 font-medium hover:bg-transparent"
      onClick={() => toggleSort(sortKeyVal)}>
      {label}
      <ArrowUpDown className={cn("ml-1 h-3 w-3", sortKey === sortKeyVal ? "opacity-100" : "opacity-30")} />
    </Button>
  );

  const colSpan = showCheckboxes ? 11 : 10;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {showCheckboxes && <TableHead className="w-8" />}
          <TableHead className="w-20">ID</TableHead>
          <TableHead><SortButton label="Title" sortKeyVal="title" /></TableHead>
          <TableHead className="w-28"><SortButton label="Status" sortKeyVal="status" /></TableHead>
          <TableHead className="w-24"><SortButton label="Priority" sortKeyVal="priority" /></TableHead>
          <TableHead className="w-32"><SortButton label="Assignee" sortKeyVal="assignee" /></TableHead>
          <TableHead className="w-24">Labels</TableHead>
          <TableHead className="w-28">Epic</TableHead>
          <TableHead className="w-28">Sprint</TableHead>
          <TableHead className="w-28"><SortButton label="Due Date" sortKeyVal="dueDate" /></TableHead>
          <TableHead className="w-16"><SortButton label="SP" sortKeyVal="storyPoints" /></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.length === 0 ? (
          <TableRow>
            <TableCell colSpan={colSpan} className="text-center text-muted-foreground py-12">No tasks yet</TableCell>
          </TableRow>
        ) : (
          sorted.map((task) => {
            const dueDate = tsToDate(task.dueDate);
            const isOverdue = dueDate && isPast(dueDate) && task.status !== "done";
            const isDueToday = dueDate && isToday(dueDate);
            const assigneeName = task.assigneeId ? memberMap.get(task.assigneeId) : null;
            const taskLabels = task.labelIds?.length
              ? task.labelIds.map((id) => labelMap.get(id)).filter(Boolean) as Label[]
              : [];
            const isSelected = selectedIds?.has(task.id) ?? false;
            const sprint = task.sprintId ? sprintMap.get(task.sprintId) : null;
            const identifier = taskIdentifiers?.get(task.id);

            return (
              <TableRow key={task.id} className={cn(
                "cursor-pointer h-10",
                isSelected && "bg-accent",
                isOverdue && "border-l-2 border-l-destructive",
              )} onClick={() => onSelectTask(task.id)}>
                {showCheckboxes && (
                  <TableCell className="pr-0" onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={isSelected} onCheckedChange={() => onToggleSelect!(task.id)} />
                  </TableCell>
                )}
                <TableCell className="font-mono text-[11px] text-muted-foreground">{identifier ?? "—"}</TableCell>
                <TableCell className="font-medium max-w-xs truncate">{task.title}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <span className={cn("h-2 w-2 rounded-full shrink-0", STATUS_DOT_COLORS[task.status])} />
                    <span className="text-xs">{TASK_STATUS_LABELS[task.status]}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <PriorityIcon priority={task.priority} className="h-3.5 w-3.5" />
                  </div>
                </TableCell>
                <TableCell>
                  {assigneeName ? (
                    <div className="flex items-center gap-1.5">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={avatarMap.get(task.assigneeId!) ?? undefined} />
                        <AvatarFallback className="text-[9px]">{getInitials(assigneeName)}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm truncate">{assigneeName}</span>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {taskLabels.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {taskLabels.map((l) => (
                        <LabelBadge key={l.id} name={l.name} color={l.color} className="text-[10px] px-1.5 py-0" />
                      ))}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {task.epicId && epicMap.get(task.epicId) ? (
                    <EpicBadge title={epicMap.get(task.epicId)!.title} color={epicMap.get(task.epicId)!.color} className="text-[10px] px-1.5 py-0" />
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {sprint ? (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">{sprint.name}</Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {dueDate ? (
                    <span className={cn("text-xs px-1.5 py-0.5 rounded",
                      isOverdue ? "bg-destructive/10 text-destructive" : isDueToday ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" : "text-muted-foreground")}>
                      {format(dueDate, "MMM d")}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {task.storyPoints != null && task.storyPoints > 0 ? (
                    <span className="font-mono text-xs text-muted-foreground">{task.storyPoints}</span>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}
