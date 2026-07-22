import { useEffect, useMemo, useState } from "react";
import { CommandPalette, CommandPaletteInput } from "@astryxdesign/core/CommandPalette";
import { Badge } from "@astryxdesign/core/Badge";
import { Text } from "@astryxdesign/core/Text";
import { HStack } from "@astryxdesign/core/HStack";
import type { SearchSource, SearchableItem } from "@astryxdesign/core/Typeahead";
import { TASK_STATUS_LABELS } from "@/lib/types";
import PriorityIcon from "@/components/tasks/PriorityIcon";
import type { Task, TaskStatus } from "@/lib/types";

const STATUS_VARIANT: Record<TaskStatus, "neutral" | "info" | "warning" | "success"> = {
  backlog: "neutral",
  todo: "neutral",
  in_progress: "info",
  in_review: "warning",
  done: "success",
};

type TaskItem = SearchableItem<Record<string, never>>;

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

  const tasksById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const source = useMemo<SearchSource>(() => {
    const toItem = (t: Task): TaskItem => ({ id: t.id, label: t.title });
    return {
      search(query: string) {
        const q = query.toLowerCase();
        return tasks
          .filter((t) => `${t.title} ${t.description ?? ""}`.toLowerCase().includes(q))
          .slice(0, 50)
          .map(toItem);
      },
      bootstrap() {
        return tasks.slice(0, 20).map(toItem);
      },
    };
  }, [tasks]);

  const handleSelect = (taskId: string) => {
    setOpen(false);
    onSelect(taskId);
  };

  return (
    <CommandPalette
      isOpen={open}
      onOpenChange={setOpen}
      searchSource={source}
      onValueChange={handleSelect}
      input={<CommandPaletteInput placeholder="Search tasks by title or description..." />}
      emptyBootstrapText="Type to search tasks"
      emptySearchText="No tasks found"
      renderItem={(item) => {
        const task = tasksById.get(item.id);
        if (!task) return <Text type="body">{item.label}</Text>;
        return (
          <HStack gap={2} align="center" width="fill">
            <Badge variant={STATUS_VARIANT[task.status]} label={TASK_STATUS_LABELS[task.status]} />
            <HStack width="fill">
              <Text type="body" maxLines={1}>{task.title}</Text>
            </HStack>
            {task.priority !== "none" && <PriorityIcon priority={task.priority} />}
          </HStack>
        );
      }}
    />
  );
}
