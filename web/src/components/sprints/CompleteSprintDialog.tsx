import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
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

  const doneCount = incompleteTasks.length === 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Complete {sprint.name}</DialogTitle>
          <DialogDescription>
            {doneCount
              ? "All tasks in this sprint are done."
              : `${incompleteTasks.length} task${incompleteTasks.length > 1 ? "s" : ""} are not completed.`}
          </DialogDescription>
        </DialogHeader>
        {!doneCount && (
          <div className="space-y-2">
            <Label>Move incomplete tasks to</Label>
            <Select value={moveToSprintId} onValueChange={setMoveToSprintId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="backlog">Backlog</SelectItem>
                {otherSprints.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex gap-2 pt-2">
          <Button onClick={handleComplete} disabled={loading} className="flex-1">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Complete sprint
          </Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
