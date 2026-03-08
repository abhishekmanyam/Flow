import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseLocalDate } from "@/lib/date-utils";
import { format } from "date-fns";
import { TASK_PRIORITY_LABELS } from "@/lib/types";
import type { Subtask, WorkspaceMember, TaskPriority } from "@/lib/types";

function tsToDate(ts: unknown): Date | null {
  if (!ts) return null;
  if (typeof (ts as { toDate?: () => Date }).toDate === "function") return (ts as { toDate: () => Date }).toDate();
  return new Date(ts as string);
}

interface SubtaskRowProps {
  subtask: Subtask;
  members: WorkspaceMember[];
  canEdit: boolean;
  onToggle: () => void;
  onUpdate: (changes: Partial<Subtask>) => void;
  onDelete: () => void;
}

export default function SubtaskRow({ subtask, members, canEdit, onToggle, onUpdate, onDelete }: SubtaskRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(subtask.title);

  const handleTitleSave = () => {
    if (!titleDraft.trim() || titleDraft === subtask.title) { setEditingTitle(false); return; }
    onUpdate({ title: titleDraft.trim() });
    setEditingTitle(false);
  };

  const dueDate = tsToDate(subtask.dueDate);

  return (
    <div className="rounded-md hover:bg-muted/50">
      <div className="flex items-center gap-2 py-1.5 px-2">
        {canEdit && (
          <button onClick={() => setExpanded(!expanded)} className="shrink-0 text-muted-foreground hover:text-foreground">
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        )}
        <button onClick={onToggle}
          className={cn("h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors",
            subtask.status === "closed" ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground hover:border-primary")}>
          {subtask.status === "closed" && <Check className="h-2.5 w-2.5" />}
        </button>
        {editingTitle && canEdit ? (
          <Input value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={handleTitleSave} onKeyDown={(e) => e.key === "Enter" && handleTitleSave()}
            className="h-6 text-sm flex-1 py-0" autoFocus />
        ) : (
          <span className={cn("text-sm flex-1 truncate", subtask.status === "closed" && "line-through text-muted-foreground",
            canEdit && "cursor-pointer")}
            onClick={() => canEdit && setEditingTitle(true)}>
            {subtask.title}
          </span>
        )}
        {subtask.priority !== "none" && (
          <span className="text-[10px] text-muted-foreground">{TASK_PRIORITY_LABELS[subtask.priority]}</span>
        )}
        {dueDate && (
          <span className="text-[10px] text-muted-foreground">{format(dueDate, "MMM d")}</span>
        )}
        {canEdit && (
          <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0" onClick={onDelete}>
            <Trash2 className="h-3 w-3 text-destructive" />
          </Button>
        )}
      </div>
      {expanded && canEdit && (
        <div className="pl-10 pr-2 pb-2 grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground font-medium">Priority</p>
            <Select value={subtask.priority} onValueChange={(v) => onUpdate({ priority: v as TaskPriority })}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.entries(TASK_PRIORITY_LABELS) as [TaskPriority, string][]).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground font-medium">Assignee</p>
            <Select value={subtask.assigneeId ?? "unassigned"} onValueChange={(v) => onUpdate({ assigneeId: v === "unassigned" ? null : v })}>
              <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.userId} value={m.userId}>{m.profile?.name ?? "Unknown"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground font-medium">Due date</p>
            <Input type="date" className="h-7 text-xs"
              value={dueDate ? format(dueDate, "yyyy-MM-dd") : ""}
              onChange={(e) => onUpdate({ dueDate: e.target.value ? parseLocalDate(e.target.value) as unknown as import("firebase/firestore").Timestamp : null })} />
          </div>
        </div>
      )}
    </div>
  );
}
