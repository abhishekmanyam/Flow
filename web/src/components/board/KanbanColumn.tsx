import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Card } from "@astryxdesign/core/Card";
import { Layout, LayoutHeader, LayoutContent, StackItem } from "@astryxdesign/core/Layout";
import { HStack } from "@astryxdesign/core/HStack";
import { VStack } from "@astryxdesign/core/VStack";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Icon } from "@astryxdesign/core/Icon";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Plus, Inbox } from "lucide-react";
import TaskCard from "./TaskCard";
import type { Task, TaskStatus, WorkspaceMember, Label, Epic, Sprint } from "@/lib/types";

type DotVariant = "success" | "warning" | "error" | "accent" | "neutral";

const STATUS_DOT_VARIANT: Record<TaskStatus, DotVariant> = {
  backlog: "neutral",
  todo: "neutral",
  in_progress: "accent",
  in_review: "warning",
  done: "success",
};

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

  // StackItem (static) keeps the column from shrinking so the board scrolls horizontally.
  return (
    <StackItem>
      <Card variant={isOver ? "blue" : "muted"} padding={0} width={300} height="100%">
        <Layout
          height="fill"
          header={
            <LayoutHeader hasDivider padding={3}>
              <HStack hAlign="between" vAlign="center">
                <HStack gap={2} vAlign="center">
                  <StatusDot variant={STATUS_DOT_VARIANT[status]} label={`${label} status`} />
                  <Heading level={4}>{label}</Heading>
                  <Text type="supporting" color="secondary" hasTabularNumbers>{tasks.length}</Text>
                </HStack>
                {canEdit && (
                  <IconButton
                    label="Add task"
                    size="sm"
                    variant="ghost"
                    icon={<Icon icon={Plus} size="sm" />}
                    onClick={onAddTask}
                  />
                )}
              </HStack>
            </LayoutHeader>
          }
          content={
            <LayoutContent ref={setNodeRef} padding={2} isScrollable>
              <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                {tasks.length === 0 ? (
                  <EmptyState
                    isCompact
                    icon={<Icon icon={Inbox} size="lg" color="secondary" />}
                    title="No tasks"
                    description="Cards you add or drag here will appear in this column."
                  />
                ) : (
                  <VStack gap={1.5}>
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
                  </VStack>
                )}
              </SortableContext>
            </LayoutContent>
          }
        />
      </Card>
    </StackItem>
  );
}
