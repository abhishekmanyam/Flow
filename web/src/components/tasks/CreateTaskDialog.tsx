import { useState } from "react";
import { createTask } from "@/lib/firestore";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Layout, LayoutContent, LayoutFooter } from "@astryxdesign/core/Layout";
import { FormLayout } from "@astryxdesign/core/FormLayout";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { Button } from "@astryxdesign/core/Button";
import { TextInput } from "@astryxdesign/core/TextInput";
import { TextArea } from "@astryxdesign/core/TextArea";
import { Selector } from "@astryxdesign/core/Selector";
import { DateInput } from "@astryxdesign/core/DateInput";
import { toast } from "@/components/system/toast";
import { parseLocalDate } from "@/lib/date-utils";
import LabelPicker from "@/components/labels/LabelPicker";
import EpicPicker from "@/components/epics/EpicPicker";
import SprintPicker from "@/components/sprints/SprintPicker";
import { TASK_STATUS_LABELS, TASK_PRIORITY_LABELS, STORY_POINT_OPTIONS } from "@/lib/types";
import type { Task, Project, WorkspaceMember, TaskStatus, TaskPriority, Label as LabelType, Epic, Sprint } from "@/lib/types";
import type { ISODateString } from "@astryxdesign/core/Calendar";

interface CreateTaskDialogProps {
  open: boolean;
  defaultStatus: TaskStatus;
  project: Project;
  members: WorkspaceMember[];
  labels: LabelType[];
  epics?: Epic[];
  sprints?: Sprint[];
  defaultSprintId?: string | null;
  currentUserId: string;
  workspaceId: string;
  onCreated: (task: Task) => void;
  onClose: () => void;
}

function LabeledField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <VStack gap={1}>
      <Text type="label">{label}</Text>
      {children}
    </VStack>
  );
}

export default function CreateTaskDialog({
  open, defaultStatus, project, members, labels, epics = [], sprints = [], defaultSprintId, currentUserId, workspaceId, onCreated, onClose,
}: CreateTaskDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>(defaultStatus);
  const [priority, setPriority] = useState<TaskPriority>("none");
  const [assigneeId, setAssigneeId] = useState("unassigned");
  const [dueDate, setDueDate] = useState("");
  const [labelIds, setLabelIds] = useState<string[]>([]);
  const [storyPoints, setStoryPoints] = useState<string>("none");
  const [epicId, setEpicId] = useState<string | null>(null);
  const [sprintId, setSprintId] = useState<string | null>(defaultSprintId ?? null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    try {
      const task = await createTask(workspaceId, project.id, {
        projectId: project.id,
        workspaceId,
        title: title.trim(),
        description: description.trim(),
        status,
        priority,
        assigneeId: assigneeId !== "unassigned" ? assigneeId : null,
        dueDate: dueDate ? parseLocalDate(dueDate) as unknown as import("firebase/firestore").Timestamp : null,
        position: 9999,
        labelIds,
        storyPoints: storyPoints !== "none" ? Number(storyPoints) : null,
        epicId,
        sprintId,
        createdBy: currentUserId,
        deletedAt: null,
      });
      toast.success("Task created");
      onCreated(task);
      setTitle(""); setDescription(""); setDueDate(""); setAssigneeId("unassigned");
      setLabelIds([]); setStoryPoints("none"); setEpicId(null); setSprintId(null);
    } catch {
      toast.error("Failed to create task");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog isOpen={open} onOpenChange={(v) => !v && onClose()} purpose="form" width={560}>
      <Layout
        header={<DialogHeader title="Create task" onOpenChange={() => onClose()} />}
        content={
          <LayoutContent>
            <form id="create-task-form" onSubmit={handleSubmit}>
              <FormLayout>
                <TextInput label="Title" isRequired placeholder="What needs to be done?" value={title} onChange={setTitle} hasAutoFocus />
                <TextArea label="Description" placeholder="Add more context..." value={description} onChange={setDescription} rows={3} />
                <FormLayout direction="horizontal">
                  <Selector
                    label="Status"
                    value={status}
                    onChange={(v) => setStatus(v as TaskStatus)}
                    options={(Object.entries(TASK_STATUS_LABELS) as [TaskStatus, string][]).map(([v, l]) => ({ value: v, label: l }))}
                  />
                  <Selector
                    label="Priority"
                    value={priority}
                    onChange={(v) => setPriority(v as TaskPriority)}
                    options={(Object.entries(TASK_PRIORITY_LABELS) as [TaskPriority, string][]).map(([v, l]) => ({ value: v, label: l }))}
                  />
                </FormLayout>
                <FormLayout direction="horizontal">
                  <Selector
                    label="Assignee"
                    placeholder="Unassigned"
                    value={assigneeId}
                    onChange={setAssigneeId}
                    options={[
                      { value: "unassigned", label: "Unassigned" },
                      ...members.map((m) => ({ value: m.userId, label: m.profile?.name ?? "Unknown" })),
                    ]}
                  />
                  <DateInput
                    label="Due date"
                    value={dueDate ? (dueDate as ISODateString) : undefined}
                    onChange={(v) => setDueDate(v ?? "")}
                    hasClear
                  />
                </FormLayout>
                <Selector
                  label="Story points"
                  placeholder="None"
                  value={storyPoints}
                  onChange={setStoryPoints}
                  options={[{ value: "none", label: "None" }, ...STORY_POINT_OPTIONS.map((v) => ({ value: String(v), label: String(v) }))]}
                />
                <LabeledField label="Labels">
                  <LabelPicker labels={labels} selectedIds={labelIds} onChange={setLabelIds} workspaceId={workspaceId} projectId={project.id} />
                </LabeledField>
                {epics.length > 0 && (
                  <LabeledField label="Epic">
                    <EpicPicker epics={epics} selectedId={epicId} onChange={setEpicId} />
                  </LabeledField>
                )}
                {sprints.length > 0 && (
                  <LabeledField label="Sprint">
                    <SprintPicker sprints={sprints} selectedId={sprintId} onChange={setSprintId} />
                  </LabeledField>
                )}
              </FormLayout>
            </form>
          </LayoutContent>
        }
        footer={
          <LayoutFooter>
            <HStack gap={2} hAlign="end">
              <Button label="Cancel" variant="secondary" onClick={onClose} />
              <Button label="Create task" variant="primary" type="submit" form="create-task-form" isDisabled={loading || !title.trim()} isLoading={loading} />
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  );
}
