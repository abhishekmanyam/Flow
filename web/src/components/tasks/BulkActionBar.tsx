import { useState } from "react";
import { Toolbar } from "@astryxdesign/core/Toolbar";
import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/VStack";
import { Selector } from "@astryxdesign/core/Selector";
import { Button } from "@astryxdesign/core/Button";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Icon } from "@astryxdesign/core/Icon";
import { Spinner } from "@astryxdesign/core/Spinner";
import { Text } from "@astryxdesign/core/Text";
import { HStack } from "@astryxdesign/core/HStack";
import { Trash2 } from "lucide-react";
import { toast } from "@/components/system/toast";
import { writeBatch, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { taskDoc } from "@/lib/firestore";
import { TASK_STATUS_LABELS, TASK_PRIORITY_LABELS } from "@/lib/types";
import type { Task, TaskStatus, TaskPriority, WorkspaceMember } from "@/lib/types";

interface BulkActionBarProps {
  selectedIds: Set<string>;
  members: WorkspaceMember[];
  workspaceId: string;
  projectId: string;
  isProjectAdmin?: boolean;
  onClearSelection: () => void;
  onTasksUpdated: (ids: string[], changes: Partial<Task>) => void;
}

export default function BulkActionBar({
  selectedIds, members, workspaceId, projectId, isProjectAdmin = false, onClearSelection, onTasksUpdated,
}: BulkActionBarProps) {
  const [loading, setLoading] = useState(false);
  const count = selectedIds.size;

  if (count === 0) return null;

  const bulkUpdate = async (changes: Partial<Task>) => {
    setLoading(true);
    try {
      const ids = Array.from(selectedIds);
      // Batch in chunks of 250 (Firestore limit is 500)
      for (let i = 0; i < ids.length; i += 250) {
        const chunk = ids.slice(i, i + 250);
        const batch = writeBatch(db);
        for (const id of chunk) {
          batch.update(taskDoc(workspaceId, projectId, id), { ...changes, updatedAt: serverTimestamp() });
        }
        await batch.commit();
      }
      onTasksUpdated(ids, changes);
      toast.success(`Updated ${ids.length} task${ids.length > 1 ? "s" : ""}`);
      onClearSelection();
    } catch {
      toast.error("Failed to update tasks");
    } finally {
      setLoading(false);
    }
  };

  const statusOptions = (Object.entries(TASK_STATUS_LABELS) as [TaskStatus, string][]).map(([value, label]) => ({ value, label }));
  const priorityOptions = (Object.entries(TASK_PRIORITY_LABELS) as [TaskPriority, string][]).map(([value, label]) => ({ value, label }));
  const assigneeOptions = [
    { value: "unassigned", label: "Unassigned" },
    ...members.map((m) => ({ value: m.userId, label: m.profile?.name ?? "Unknown" })),
  ];

  return (
    // Geometry-only inline style on the outer wrapper (fixed centering); the visible
    // surface is the Astryx Card + Toolbar below.
    <VStack style={{ position: "fixed", insetBlockEnd: 24, insetInlineStart: "50%", transform: "translateX(-50%)", zIndex: 50 }}>
      <Card padding={2}>
        <Toolbar
          label="Bulk task actions"
          size="sm"
          startContent={<Text type="label" weight="medium">{count} selected</Text>}
          endContent={
            <HStack gap={2} vAlign="center">
              <Selector
                label="Set status"
                placeholder="Status"
                size="sm"
                isDisabled={loading}
                options={statusOptions}
                onChange={(v) => bulkUpdate({ status: v as TaskStatus })}
              />
              <Selector
                label="Set priority"
                placeholder="Priority"
                size="sm"
                isDisabled={loading}
                options={priorityOptions}
                onChange={(v) => bulkUpdate({ priority: v as TaskPriority })}
              />
              <Selector
                label="Set assignee"
                placeholder="Assignee"
                size="sm"
                isDisabled={loading}
                options={assigneeOptions}
                onChange={(v) => bulkUpdate({ assigneeId: v === "unassigned" ? null : v })}
              />
              {isProjectAdmin && (
                <Button
                  label="Delete"
                  variant="destructive"
                  size="sm"
                  isDisabled={loading}
                  icon={<Icon icon={Trash2} size="sm" />}
                  onClick={() => bulkUpdate({ deletedAt: serverTimestamp() } as Partial<Task>)}
                />
              )}
              {loading && <Spinner size="sm" label="Updating tasks" />}
              <IconButton
                label="Clear selection"
                size="sm"
                variant="ghost"
                icon={<Icon icon="close" size="sm" />}
                onClick={onClearSelection}
              />
            </HStack>
          }
        />
      </Card>
    </VStack>
  );
}
