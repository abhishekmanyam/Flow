import { memo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@astryxdesign/core/Card";
import { Badge } from "@astryxdesign/core/Badge";
import { Token } from "@astryxdesign/core/Token";
import { Avatar } from "@astryxdesign/core/Avatar";
import { Icon } from "@astryxdesign/core/Icon";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { StackItem } from "@astryxdesign/core/Layout";
import { Text } from "@astryxdesign/core/Text";
import { Calendar } from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import PriorityIcon from "@/components/tasks/PriorityIcon";
import EpicBadge from "@/components/epics/EpicBadge";
import LabelBadge from "@/components/labels/LabelBadge";
import type { Task, WorkspaceMember, Label, Epic, Sprint } from "@/lib/types";

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
  task, onSelect, members, labels = [], epics = [], sprints = [], taskIdentifier,
}: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition } =
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
  const dueColor = isOverdue ? "red" : isDueToday ? "yellow" : "gray";

  const hasMetaRow2 = epic || sprint;

  return (
    <Card
      ref={setNodeRef}
      padding={3}
      variant={isOverdue ? "red" : "default"}
      // dnd-kit functional-library exception: the library-computed transform/transition
      // must ride as an inline style on the draggable node — nothing else here.
      style={{ transform: CSS.Transform.toString(transform) ?? undefined, transition }}
      onClick={onSelect}
      {...attributes}
      {...listeners}
    >
      <VStack gap={2}>
        <HStack gap={1.5} vAlign="start">
          {taskIdentifier && (
            <Text type="code" size="2xs" color="secondary">{taskIdentifier}</Text>
          )}
          <StackItem size="fill">
            <Text type="label" weight="medium" maxLines={2}>{task.title}</Text>
          </StackItem>
        </HStack>

        {task.description && (
          <Text type="supporting" color="secondary" maxLines={2}>{task.description}</Text>
        )}

        {hasMetaRow2 && (
          <HStack gap={1.5} vAlign="center" wrap="wrap">
            {epic && <EpicBadge title={epic.title} color={epic.color} />}
            {sprint && <Token label={sprint.name} color="purple" size="sm" />}
          </HStack>
        )}

        <HStack gap={1.5} vAlign="center" hAlign="between">
          <HStack gap={1.5} vAlign="center" wrap="wrap">
            {task.priority !== "none" && <PriorityIcon priority={task.priority} />}
            {taskLabels.slice(0, 3).map((l) => (
              <LabelBadge key={l.id} name={l.name} color={l.color} />
            ))}
            {taskLabels.length > 3 && (
              <Text type="supporting" color="secondary">+{taskLabels.length - 3}</Text>
            )}
            {dueDate && (
              <Token
                label={format(dueDate, "MMM d")}
                color={dueColor}
                size="sm"
                icon={<Icon icon={Calendar} size="xsm" />}
                description={isOverdue ? "Overdue" : isDueToday ? "Due today" : `Due ${format(dueDate, "MMM d, yyyy")}`}
              />
            )}
            {task.storyPoints != null && task.storyPoints > 0 && (
              <Badge label={String(task.storyPoints)} variant="neutral" />
            )}
          </HStack>
          {assignee && (
            <Avatar size="xsmall" name={assignee.name ?? undefined} src={assignee.avatarUrl ?? undefined} />
          )}
        </HStack>
      </VStack>
    </Card>
  );
});
