import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { X, Loader2, Trash2 } from "lucide-react";
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

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-background border rounded-lg shadow-lg px-4 py-2.5 flex items-center gap-3">
      <span className="text-sm font-medium whitespace-nowrap">{count} selected</span>
      <Select onValueChange={(v) => bulkUpdate({ status: v as TaskStatus })} disabled={loading}>
        <SelectTrigger className="h-7 text-xs w-28"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          {(Object.entries(TASK_STATUS_LABELS) as [TaskStatus, string][]).map(([v, l]) => (
            <SelectItem key={v} value={v}>{l}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select onValueChange={(v) => bulkUpdate({ priority: v as TaskPriority })} disabled={loading}>
        <SelectTrigger className="h-7 text-xs w-28"><SelectValue placeholder="Priority" /></SelectTrigger>
        <SelectContent>
          {(Object.entries(TASK_PRIORITY_LABELS) as [TaskPriority, string][]).map(([v, l]) => (
            <SelectItem key={v} value={v}>{l}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select onValueChange={(v) => bulkUpdate({ assigneeId: v === "unassigned" ? null : v })} disabled={loading}>
        <SelectTrigger className="h-7 text-xs w-28"><SelectValue placeholder="Assignee" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="unassigned">Unassigned</SelectItem>
          {members.map((m) => (
            <SelectItem key={m.userId} value={m.userId}>{m.profile?.name ?? "Unknown"}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isProjectAdmin && (
        <Button
          variant="destructive"
          size="sm"
          className="h-7 text-xs"
          disabled={loading}
          onClick={() => bulkUpdate({ deletedAt: serverTimestamp() } as Partial<Task>)}
        >
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />Delete
        </Button>
      )}
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClearSelection}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
