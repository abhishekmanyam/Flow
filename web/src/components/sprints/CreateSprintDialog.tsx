import { useState } from "react";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Layout, LayoutContent, LayoutFooter } from "@astryxdesign/core/Layout";
import { HStack } from "@astryxdesign/core/HStack";
import { FormLayout } from "@astryxdesign/core/FormLayout";
import { TextInput } from "@astryxdesign/core/TextInput";
import { TextArea } from "@astryxdesign/core/TextArea";
import { DateInput } from "@astryxdesign/core/DateInput";
import type { ISODateString } from "@astryxdesign/core/Calendar";
import { Button } from "@astryxdesign/core/Button";
import { toast } from "@/components/system/toast";
import { createSprint, updateSprint } from "@/lib/firestore";
import { parseLocalDate } from "@/lib/date-utils";
import { format } from "date-fns";
import type { Sprint } from "@/lib/types";

function tsToDateStr(ts: unknown): string {
  if (!ts) return "";
  if (typeof (ts as { toDate?: () => Date }).toDate === "function") return format((ts as { toDate: () => Date }).toDate(), "yyyy-MM-dd");
  const d = new Date(ts as string | number);
  return isNaN(d.getTime()) ? "" : format(d, "yyyy-MM-dd");
}

interface CreateSprintDialogProps {
  open: boolean;
  workspaceId: string;
  projectId: string;
  currentUserId: string;
  nextPosition: number;
  sprint?: Sprint;
  onCreated: (sprint: Sprint) => void;
  onClose: () => void;
}

export default function CreateSprintDialog({
  open, workspaceId, projectId, currentUserId, nextPosition, sprint, onCreated, onClose,
}: CreateSprintDialogProps) {
  const isEditing = !!sprint;
  const [name, setName] = useState(sprint?.name ?? "");
  const [goal, setGoal] = useState(sprint?.goal ?? "");
  const [startDate, setStartDate] = useState(sprint ? tsToDateStr(sprint.startDate) : "");
  const [endDate, setEndDate] = useState(sprint ? tsToDateStr(sprint.endDate) : "");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      if (isEditing) {
        const changes: Partial<Sprint> = {
          name: name.trim(),
          goal: goal.trim(),
        };
        if (startDate) {
          (changes as Record<string, unknown>).startDate = parseLocalDate(startDate);
        } else {
          changes.startDate = null;
        }
        if (endDate) {
          (changes as Record<string, unknown>).endDate = parseLocalDate(endDate);
        } else {
          changes.endDate = null;
        }
        await updateSprint(workspaceId, projectId, sprint!.id, changes);
        toast.success("Sprint updated");
        onCreated({ ...sprint!, ...changes });
      } else {
        const s = await createSprint(workspaceId, projectId, {
          projectId,
          name: name.trim(),
          goal: goal.trim(),
          status: "planning",
          startDate: (startDate ? parseLocalDate(startDate) : null) as unknown as Sprint["startDate"],
          endDate: (endDate ? parseLocalDate(endDate) : null) as unknown as Sprint["endDate"],
          position: nextPosition,
          createdBy: currentUserId,
          completedAt: null,
        });
        toast.success("Sprint created");
        onCreated(s);
      }
      setName("");
      setGoal("");
    } catch {
      toast.error(isEditing ? "Failed to update sprint" : "Failed to create sprint");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog isOpen={open} onOpenChange={(v) => !v && onClose()} purpose="form" width={480}>
      <Layout
        header={<DialogHeader title={isEditing ? "Edit sprint" : "Create sprint"} onOpenChange={(v) => !v && onClose()} />}
        content={
          <LayoutContent padding={4}>
            <FormLayout>
              <TextInput label="Name" isRequired value={name} onChange={setName} placeholder="Sprint 1" hasAutoFocus />
              <TextArea label="Goal" value={goal} onChange={setGoal} placeholder="What should be accomplished?" rows={3} isOptional />
              <FormLayout direction="horizontal">
                <DateInput label="Start date" value={(startDate || undefined) as ISODateString | undefined} onChange={(v) => setStartDate(v ?? "")} hasClear isOptional />
                <DateInput label="End date" value={(endDate || undefined) as ISODateString | undefined} onChange={(v) => setEndDate(v ?? "")} hasClear isOptional />
              </FormLayout>
            </FormLayout>
          </LayoutContent>
        }
        footer={
          <LayoutFooter hasDivider>
            <HStack gap={2} hAlign="end">
              <Button label="Cancel" variant="secondary" onClick={onClose} />
              <Button
                label={isEditing ? "Save" : "Create sprint"}
                variant="primary"
                isLoading={loading}
                isDisabled={!name.trim()}
                clickAction={handleSubmit}
              />
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  );
}
