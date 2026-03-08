import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandSeparator } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Check, Plus, Tags } from "lucide-react";
import { cn } from "@/lib/utils";
import { createLabel } from "@/lib/firestore";
import { LABEL_COLORS } from "@/lib/types";
import { toast } from "sonner";
import LabelBadge from "./LabelBadge";
import type { Label } from "@/lib/types";

interface LabelPickerProps {
  labels: Label[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  workspaceId?: string;
  projectId?: string;
}

export default function LabelPicker({ labels, selectedIds, onChange, disabled, workspaceId, projectId }: LabelPickerProps) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(LABEL_COLORS[0]);
  const [saving, setSaving] = useState(false);

  const canCreate = !!workspaceId && !!projectId;

  const toggle = (id: string) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((lid) => lid !== id)
        : [...selectedIds, id]
    );
  };

  const handleCreate = async () => {
    if (!newName.trim() || !workspaceId || !projectId) return;
    setSaving(true);
    try {
      const label = await createLabel(workspaceId, projectId, newName.trim(), newColor);
      onChange([...selectedIds, label.id]);
      setNewName("");
      setNewColor(LABEL_COLORS[0]);
      setCreating(false);
      toast.success(`Label "${label.name}" created`);
    } catch {
      toast.error("Failed to create label");
    } finally {
      setSaving(false);
    }
  };

  const selected = labels.filter((l) => selectedIds.includes(l.id));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 justify-start text-sm font-normal" disabled={disabled}>
          {selected.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {selected.map((l) => (
                <LabelBadge key={l.id} name={l.name} color={l.color} className="text-[10px] px-1.5 py-0" />
              ))}
            </div>
          ) : (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Tags className="h-3.5 w-3.5" />Labels
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        {creating ? (
          <div className="p-3 space-y-3">
            <p className="text-sm font-medium">New label</p>
            <input
              className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="Label name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCreate(); } }}
              autoFocus
            />
            <div className="flex flex-wrap gap-1.5">
              {LABEL_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={cn(
                    "h-5 w-5 rounded-full border-2 transition-transform",
                    newColor === c ? "border-foreground scale-110" : "border-transparent"
                  )}
                  style={{ backgroundColor: c }}
                  onClick={() => setNewColor(c)}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="h-7 flex-1 text-xs" disabled={!newName.trim() || saving} onClick={handleCreate}>
                Create
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setCreating(false); setNewName(""); }}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Command>
            <CommandInput placeholder="Search labels..." />
            <CommandList>
              <CommandEmpty>No labels found.</CommandEmpty>
              <CommandGroup>
                {labels.map((label) => (
                  <CommandItem key={label.id} onSelect={() => toggle(label.id)} className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: label.color }} />
                    <span className="flex-1 truncate">{label.name}</span>
                    <Check className={cn("h-3.5 w-3.5", selectedIds.includes(label.id) ? "opacity-100" : "opacity-0")} />
                  </CommandItem>
                ))}
              </CommandGroup>
              {canCreate && (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem onSelect={() => setCreating(true)} className="flex items-center gap-2 text-muted-foreground">
                      <Plus className="h-3.5 w-3.5" />
                      <span>Create label</span>
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  );
}
