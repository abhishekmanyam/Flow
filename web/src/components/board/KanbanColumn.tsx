import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import TaskCard from "./TaskCard";
import { STATUS_DOT_COLORS } from "@/lib/types";
import type { Task, TaskStatus, WorkspaceMember, Label, Epic, Sprint } from "@/lib/types";

interface KanbanColumnProps {
  status: TaskStatus;
  label: string;
  tasks: Task[];
  canEdit: boolean;
  onAddTask: () => void;
  onSelectTask: (id: string) => void;
  members?: WorkspaceMember[];
  labels?: Label[];
  epics?: Epic[];
  sprints?: Sprint[];
  taskIdentifiers?: Map<string, string>;
}

export default function KanbanColumn({
  status, label, tasks, canEdit, onAddTask, onSelectTask,
  members = [], labels = [], epics = [], sprints = [], taskIdentifiers,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div className={cn(
      "group/column flex flex-col w-72 rounded-xl bg-muted/30 border transition-colors",
      isOver && "bg-muted/60 border-primary/40 ring-1 ring-primary/20",
    )}>
      <div className="relative z-10 flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full shrink-0", STATUS_DOT_COLORS[status])} />
          <span className="text-sm font-medium">{label}</span>
          <span className="text-xs text-muted-foreground tabular-nums">{tasks.length}</span>
        </div>
        {canEdit && (
          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover/column:opacity-100 transition-opacity" onClick={onAddTask}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      <div ref={setNodeRef} className="flex-1 overflow-y-auto overflow-x-hidden px-2 pt-0.5 pb-2 space-y-1.5 min-h-[200px]">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onSelect={() => onSelectTask(task.id)}
              members={members}
              labels={labels}
              epics={epics}
              sprints={sprints}
              taskIdentifier={taskIdentifiers?.get(task.id)}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
