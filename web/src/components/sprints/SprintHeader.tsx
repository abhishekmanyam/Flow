import { HStack } from "@astryxdesign/core/HStack";
import { VStack } from "@astryxdesign/core/VStack";
import { Text } from "@astryxdesign/core/Text";
import { Badge } from "@astryxdesign/core/Badge";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { Timestamp } from "@astryxdesign/core/Timestamp";
import { SPRINT_STATUS_LABELS } from "@/lib/types";
import type { Sprint, Task } from "@/lib/types";

function tsToDate(ts: unknown): Date | null {
  if (!ts) return null;
  if (typeof (ts as { toDate?: () => Date }).toDate === "function") return (ts as { toDate: () => Date }).toDate();
  return new Date(ts as string);
}

interface SprintHeaderProps {
  sprint: Sprint;
  tasks: Task[];
}

const SPRINT_STATUS_VARIANT: Record<Sprint["status"], "neutral" | "success" | "info"> = {
  planning: "neutral",
  active: "info",
  completed: "success",
};

export default function SprintHeader({ sprint, tasks }: SprintHeaderProps) {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "done").length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const totalPoints = tasks.reduce((acc, t) => acc + (t.storyPoints ?? 0), 0);
  const donePoints = tasks.filter((t) => t.status === "done").reduce((acc, t) => acc + (t.storyPoints ?? 0), 0);

  const startDate = tsToDate(sprint.startDate);
  const endDate = tsToDate(sprint.endDate);

  return (
    <VStack gap={2}>
      <HStack gap={2} align="center" wrap="wrap">
        <Text type="body" weight="semibold">{sprint.name}</Text>
        <Badge variant={SPRINT_STATUS_VARIANT[sprint.status]} label={SPRINT_STATUS_LABELS[sprint.status]} />
        {startDate && endDate && (
          <HStack gap={1} align="center">
            <Timestamp value={startDate.toISOString()} format="date" type="supporting" />
            <Text type="supporting" color="secondary">–</Text>
            <Timestamp value={endDate.toISOString()} format="date" type="supporting" />
          </HStack>
        )}
      </HStack>
      {sprint.goal && (
        <Text type="supporting" color="secondary" maxLines={2}>{sprint.goal}</Text>
      )}
      <VStack gap={1}>
        <HStack justify="between" align="center">
          <Text type="supporting" color="secondary">{done}/{total} tasks</Text>
          {totalPoints > 0 && (
            <Text type="supporting" color="secondary">{donePoints}/{totalPoints} pts</Text>
          )}
        </HStack>
        <ProgressBar
          label={`${sprint.name} progress`}
          value={pct}
          variant={pct === 100 ? "success" : "accent"}
          isLabelHidden
        />
      </VStack>
    </VStack>
  );
}
