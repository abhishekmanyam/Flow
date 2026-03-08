import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{isEditing ? "Edit sprint" : "Create sprint"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input placeholder="Sprint 1" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </div>
          <div className="space-y-2">
            <Label>Goal</Label>
            <Textarea placeholder="What should be accomplished?" value={goal} onChange={(e) => setGoal(e.target.value)} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Start date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>End date</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={loading || !name.trim()} className="flex-1">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{isEditing ? "Save" : "Create sprint"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
