import { useState } from "react";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Layout, LayoutContent, LayoutFooter } from "@astryxdesign/core/Layout";
import { HStack } from "@astryxdesign/core/HStack";
import { VStack } from "@astryxdesign/core/VStack";
import { Banner } from "@astryxdesign/core/Banner";
import { Selector } from "@astryxdesign/core/Selector";
import { Button } from "@astryxdesign/core/Button";
import { toast } from "@/components/system/toast";
import { completeSprint } from "@/lib/firestore";
import type { Sprint, Task } from "@/lib/types";

interface CompleteSprintDialogProps {
  open: boolean;
  sprint: Sprint;
  incompleteTasks: Task[];
  otherSprints: Sprint[];
  workspaceId: string;
  projectId: string;
  onCompleted: () => void;
  onClose: () => void;
}

export default function CompleteSprintDialog({
  open, sprint, incompleteTasks, otherSprints, workspaceId, projectId, onCompleted, onClose,
}: CompleteSprintDialogProps) {
  const [moveToSprintId, setMoveToSprintId] = useState<string>("backlog");
  const [loading, setLoading] = useState(false);

  const handleComplete = async () => {
    setLoading(true);
    try {
      await completeSprint(
        workspaceId,
        projectId,
        sprint.id,
        moveToSprintId === "backlog" ? null : moveToSprintId,
        incompleteTasks
      );
      toast.success("Sprint completed");
      onCompleted();
    } catch {
      toast.error("Failed to complete sprint");
    } finally {
      setLoading(false);
    }
  };

  const allDone = incompleteTasks.length === 0;
  const options = [
    { value: "backlog", label: "Backlog" },
    ...otherSprints.map((s) => ({ value: s.id, label: s.name })),
  ];

  return (
    <Dialog isOpen={open} onOpenChange={(v) => !v && onClose()} purpose="form" width={440}>
      <Layout
        header={<DialogHeader title={`Complete ${sprint.name}`} onOpenChange={(v) => !v && onClose()} />}
        content={
          <LayoutContent padding={4}>
            <VStack gap={4}>
              <Banner
                status={allDone ? "success" : "warning"}
                container="card"
                title={allDone ? "All tasks complete" : `${incompleteTasks.length} task${incompleteTasks.length > 1 ? "s" : ""} not completed`}
                description={allDone
                  ? "All tasks in this sprint are done."
                  : "Choose where to move the remaining tasks when this sprint closes."}
              />
              {!allDone && (
                <Selector
                  label="Move incomplete tasks to"
                  options={options}
                  value={moveToSprintId}
                  onChange={setMoveToSprintId}
                />
              )}
            </VStack>
          </LayoutContent>
        }
        footer={
          <LayoutFooter hasDivider>
            <HStack gap={2} hAlign="end">
              <Button label="Cancel" variant="secondary" onClick={onClose} />
              <Button label="Complete sprint" variant="primary" isLoading={loading} clickAction={handleComplete} />
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  );
}
