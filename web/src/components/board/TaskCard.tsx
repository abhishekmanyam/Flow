import { memo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Calendar } from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import PriorityIcon from "@/components/tasks/PriorityIcon";
import EpicBadge from "@/components/epics/EpicBadge";
import type { Task, WorkspaceMember, Label, Epic, Sprint } from "@/lib/types";

function getInitials(name: string | null | undefined) {
  if (!name) return "?";
  return name.split(/\s/).map((s) => s[0]?.toUpperCase()).slice(0, 2).join("");
}

interface TaskCardProps {
  task: Task;
  isDragging?: boolean;
  onSelect: () => void;
  members: WorkspaceMember[];
  labels?: Label[];
  epics?: Epic[];
  sprints?: Sprint[];
  taskIdentifier?: string;
}

// rerender-memo: TaskCard is rendered many times, memoize it
export default memo(function TaskCard({
  task, isDragging, onSelect, members, labels = [], epics = [], sprints = [], taskIdentifier,
}: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSorting } =
    useSortable({ id: task.id });

  const assignee = task.assigneeId ? members.find((m) => m.userId === task.assigneeId)?.profile : undefined;
  const taskLabels = task.labelIds?.length ? labels.filter((l) => task.labelIds.includes(l.id)) : [];
  const epic = task.epicId ? epics.find((e) => e.id === task.epicId) : null;
  const sprint = task.sprintId ? sprints.find((s) => s.id === task.sprintId) : null;

  const dueDate = task.dueDate
    ? (task.dueDate as unknown as { toDate(): Date }).toDate?.() ?? new Date(task.dueDate as unknown as string)
    : null;
  const isOverdue = dueDate && isPast(dueDate) && task.status !== "done";
  const isDueToday = dueDate && isToday(dueDate);

  const hasMetaRow2 = epic || sprint;

  return (
    <Card
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={onSelect}
      className={cn(
        "p-3 cursor-pointer select-none transition-all border",
        "hover:shadow-md hover:-translate-y-0.5",
        isOverdue && "border-destructive/40 bg-destructive/5",
        (isDragging || isSorting) && "opacity-50 rotate-2 shadow-lg",
      )}
    >
      {/* Row 1: Identifier + Title */}
      <div className="flex items-start gap-1.5">
        {taskIdentifier && (
          <span className="text-[11px] font-mono text-muted-foreground shrink-0 pt-px">
            {taskIdentifier}
          </span>
        )}
        <p className="text-sm font-medium leading-snug line-clamp-2 flex-1">{task.title}</p>
      </div>

      {/* Description */}
      {task.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{task.description}</p>
      )}

      {/* Row 2: Epic + Sprint (conditional) */}
      {hasMetaRow2 && (
        <div className="flex items-center gap-1.5 mt-1.5">
          {epic && (
            <EpicBadge title={epic.title} color={epic.color} className="text-[10px] px-1.5 py-0 h-4 max-w-[120px] truncate" />
          )}
          {sprint && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 max-w-[100px] truncate">
              {sprint.name}
            </Badge>
          )}
        </div>
      )}

      {/* Row 3: Metadata bar */}
      <div className="flex items-center gap-1.5 mt-2">
        {task.priority !== "none" && <PriorityIcon priority={task.priority} />}

        {/* Label dots with tooltips */}
        {taskLabels.length > 0 && (
          <div className="flex items-center gap-0.5">
            {taskLabels.slice(0, 3).map((l) => (
              <Tooltip key={l.id}>
                <TooltipTrigger asChild>
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: l.color }}
                  />
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">{l.name}</TooltipContent>
              </Tooltip>
            ))}
            {taskLabels.length > 3 && (
              <span className="text-[10px] text-muted-foreground">+{taskLabels.length - 3}</span>
            )}
          </div>
        )}

        {/* Due date with urgency styling */}
        {dueDate && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={cn(
                "flex items-center gap-0.5 text-[11px] rounded-sm px-1 py-0.5",
                isOverdue && "bg-destructive/10 text-destructive font-medium",
                isDueToday && !isOverdue && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 font-medium",
                !isOverdue && !isDueToday && "text-muted-foreground",
              )}>
                <Calendar className="h-3 w-3" />
                {format(dueDate, "MMM d")}
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {isOverdue ? "Overdue" : isDueToday ? "Due today" : `Due ${format(dueDate, "MMM d, yyyy")}`}
            </TooltipContent>
          </Tooltip>
        )}

        {/* Story points */}
        {task.storyPoints != null && task.storyPoints > 0 && (
          <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 font-mono">
            {task.storyPoints}
          </Badge>
        )}

        {/* Assignee avatar */}
        <div className="ml-auto">
          {assignee && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Avatar className="h-5 w-5">
                  <AvatarImage src={assignee.avatarUrl ?? undefined} />
                  <AvatarFallback className="text-[9px]">{getInitials(assignee.name)}</AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">{assignee.name}</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </Card>
  );
});
