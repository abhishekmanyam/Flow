import { useState } from "react";
import { createTask } from "@/lib/firestore";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { parseLocalDate } from "@/lib/date-utils";
import LabelPicker from "@/components/labels/LabelPicker";
import EpicPicker from "@/components/epics/EpicPicker";
import SprintPicker from "@/components/sprints/SprintPicker";
import { TASK_STATUS_LABELS, TASK_PRIORITY_LABELS, STORY_POINT_OPTIONS } from "@/lib/types";
import type { Task, Project, WorkspaceMember, TaskStatus, TaskPriority, Label as LabelType, Epic, Sprint } from "@/lib/types";

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
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Create task</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Title *</Label>
            <Input placeholder="What needs to be done?" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea placeholder="Add more context..." value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(TASK_STATUS_LABELS) as [TaskStatus, string][]).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(TASK_PRIORITY_LABELS) as [TaskPriority, string][]).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Assignee</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.userId} value={m.userId}>{m.profile?.name ?? "Unknown"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Due date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Story Points</Label>
              <Select value={storyPoints} onValueChange={setStoryPoints}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {STORY_POINT_OPTIONS.map((v) => (
                    <SelectItem key={v} value={String(v)}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="space-y-2">
              <Label>Labels</Label>
              <LabelPicker labels={labels} selectedIds={labelIds} onChange={setLabelIds} workspaceId={workspaceId} projectId={project.id} />
            </div>
            {epics.length > 0 && (
              <div className="space-y-2">
                <Label>Epic</Label>
                <EpicPicker epics={epics} selectedId={epicId} onChange={setEpicId} />
              </div>
            )}
            {sprints.length > 0 && (
              <div className="space-y-2">
                <Label>Sprint</Label>
                <SprintPicker sprints={sprints} selectedId={sprintId} onChange={setSprintId} />
              </div>
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={loading || !title.trim()} className="flex-1">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create task
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
