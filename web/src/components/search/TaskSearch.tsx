import { useEffect, useState } from "react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { STATUS_COLORS, TASK_STATUS_LABELS, PRIORITY_COLORS, TASK_PRIORITY_LABELS } from "@/lib/types";
import type { Task } from "@/lib/types";

interface TaskSearchProps {
  tasks: Task[];
  onSelect: (taskId: string) => void;
}

export default function TaskSearch({ tasks, onSelect }: TaskSearchProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSelect = (taskId: string) => {
    setOpen(false);
    onSelect(taskId);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search tasks by title or description..." />
      <CommandList>
        <CommandEmpty>No tasks found</CommandEmpty>
        <CommandGroup heading="Tasks">
          {tasks.map((task) => (
            <CommandItem key={task.id} value={`${task.title} ${task.description ?? ""}`} onSelect={() => handleSelect(task.id)}>
              <div className="flex items-center gap-2 w-full min-w-0">
                <Badge variant="secondary" className={cn("text-[9px] shrink-0", STATUS_COLORS[task.status])}>
                  {TASK_STATUS_LABELS[task.status]}
                </Badge>
                <span className="truncate flex-1 text-sm">{task.title}</span>
                <span className={cn("text-[10px] shrink-0", PRIORITY_COLORS[task.priority])}>
                  {TASK_PRIORITY_LABELS[task.priority]}
                </span>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
