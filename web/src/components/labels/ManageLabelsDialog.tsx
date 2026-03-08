import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { createLabel, updateLabel, deleteLabel } from "@/lib/firestore";
import { LABEL_COLORS } from "@/lib/types";
import type { Label } from "@/lib/types";

interface ManageLabelsDialogProps {
  open: boolean;
  onClose: () => void;
  labels: Label[];
  workspaceId: string;
  projectId: string;
}

export default function ManageLabelsDialog({
  open, onClose, labels, workspaceId, projectId,
}: ManageLabelsDialogProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState(LABEL_COLORS[0]);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(LABEL_COLORS[0]);
  const [adding, setAdding] = useState(false);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await createLabel(workspaceId, projectId, newName.trim(), newColor);
      setNewName("");
      setNewColor(LABEL_COLORS[0]);
      setAdding(false);
      toast.success("Label created");
    } catch {
      toast.error("Failed to create label");
    }
  };

  const handleUpdate = async (labelId: string) => {
    if (!editName.trim()) return;
    try {
      await updateLabel(workspaceId, projectId, labelId, { name: editName.trim(), color: editColor });
      setEditingId(null);
      toast.success("Label updated");
    } catch {
      toast.error("Failed to update label");
    }
  };

  const handleDelete = async (labelId: string) => {
    try {
      await deleteLabel(workspaceId, projectId, labelId);
      toast.success("Label deleted");
    } catch {
      toast.error("Failed to delete label");
    }
  };

  const startEdit = (label: Label) => {
    setEditingId(label.id);
    setEditName(label.name);
    setEditColor(label.color);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Manage Labels</DialogTitle></DialogHeader>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {labels.length === 0 && !adding && (
            <p className="text-sm text-muted-foreground text-center py-4">No labels yet</p>
          )}
          {labels.map((label) =>
            editingId === label.id ? (
              <div key={label.id} className="space-y-2 rounded-md border p-3">
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Label name"
                  onKeyDown={(e) => e.key === "Enter" && handleUpdate(label.id)} autoFocus />
                <div className="flex flex-wrap gap-1.5">
                  {LABEL_COLORS.map((c) => (
                    <button key={c} type="button" onClick={() => setEditColor(c)}
                      className={cn("h-5 w-5 rounded-full border-2 transition-all",
                        editColor === c ? "border-foreground scale-110" : "border-transparent hover:border-muted-foreground")}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleUpdate(label.id)} disabled={!editName.trim()}>
                    <Check className="mr-1 h-3.5 w-3.5" />Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                    <X className="mr-1 h-3.5 w-3.5" />Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div key={label.id} className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 group">
                <div className="h-3.5 w-3.5 rounded-full shrink-0" style={{ backgroundColor: label.color }} />
                <span className="text-sm flex-1 truncate">{label.name}</span>
                <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => startEdit(label)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => handleDelete(label.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )
          )}
          {adding && (
            <div className="space-y-2 rounded-md border p-3">
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Label name"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()} autoFocus />
              <div className="flex flex-wrap gap-1.5">
                {LABEL_COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setNewColor(c)}
                    className={cn("h-5 w-5 rounded-full border-2 transition-all",
                      newColor === c ? "border-foreground scale-110" : "border-transparent hover:border-muted-foreground")}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleCreate} disabled={!newName.trim()}>
                  <Check className="mr-1 h-3.5 w-3.5" />Create
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setNewName(""); }}>
                  <X className="mr-1 h-3.5 w-3.5" />Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
        {!adding && (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />Add label
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
