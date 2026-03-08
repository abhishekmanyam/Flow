import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";
import { Paperclip, Plus, X, ExternalLink, HardDrive, Link2 } from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { addAttachment, removeAttachment } from "@/lib/firestore";
import { toast } from "sonner";
import GoogleDrivePicker from "@/components/integrations/GoogleDrivePicker";
import type { TaskAttachment } from "@/lib/types";

function tsToDate(ts: unknown): Date {
  if (!ts) return new Date();
  if (typeof (ts as { toDate?: () => Date }).toDate === "function") return (ts as { toDate: () => Date }).toDate();
  return new Date(ts as string);
}

const TYPE_ICONS: Record<string, typeof HardDrive> = {
  google_drive: HardDrive,
  link: Link2,
};

interface TaskAttachmentsProps {
  attachments: TaskAttachment[];
  workspaceId: string;
  projectId: string;
  taskId: string;
  currentUserId: string;
  canEdit: boolean;
  onAttachmentsChange: (attachments: TaskAttachment[]) => void;
}

export default function TaskAttachments({
  attachments,
  workspaceId,
  projectId,
  taskId,
  currentUserId,
  canEdit,
  onAttachmentsChange,
}: TaskAttachmentsProps) {
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkName, setLinkName] = useState("");

  const handleFilePicked = useCallback(
    async (partial: Omit<TaskAttachment, "id" | "addedBy" | "addedAt">) => {
      const attachment: TaskAttachment = {
        ...partial,
        id: crypto.randomUUID(),
        addedBy: currentUserId,
        addedAt: Timestamp.now(),
      };
      try {
        await addAttachment(workspaceId, projectId, taskId, attachment, currentUserId);
        onAttachmentsChange([...attachments, attachment]);
        toast.success(`Attached "${attachment.name}"`);
      } catch {
        toast.error("Failed to add attachment");
      }
    },
    [workspaceId, projectId, taskId, currentUserId, attachments, onAttachmentsChange]
  );

  const handleRemove = useCallback(
    async (attachment: TaskAttachment) => {
      try {
        await removeAttachment(workspaceId, projectId, taskId, attachment, currentUserId);
        onAttachmentsChange(attachments.filter((a) => a.id !== attachment.id));
        toast.success(`Removed "${attachment.name}"`);
      } catch {
        toast.error("Failed to remove attachment");
      }
    },
    [workspaceId, projectId, taskId, currentUserId, attachments, onAttachmentsChange]
  );

  const handleLinkSubmit = () => {
    if (!linkUrl.trim()) return;
    const name = linkName.trim() || new URL(linkUrl.trim()).hostname;
    handleFilePicked({ type: "link", name, url: linkUrl.trim() });
    setLinkUrl("");
    setLinkName("");
    setLinkDialogOpen(false);
  };

  return (
    <div className="py-3 space-y-3">
      {attachments.length === 0 ? (
        <EmptyState icon={Paperclip} title="No attachments" description="Attach files from Google Drive or paste a link" className="py-6" />
      ) : (
        <div className="space-y-2">
          {attachments.map((a) => {
            const Icon = TYPE_ICONS[a.type] ?? Paperclip;
            return (
              <div key={a.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm group">
                {a.iconUrl ? (
                  <img src={a.iconUrl} alt="" className="h-4 w-4 shrink-0" />
                ) : (
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 min-w-0 truncate text-primary hover:underline"
                >
                  {a.name}
                </a>
                <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">
                  {tsToDate(a.addedAt).toLocaleDateString()}
                </span>
                <a href={a.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                </a>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleRemove(a)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <GoogleDrivePicker onFilePicked={handleFilePicked} disabled={!canEdit} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                More
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => setLinkDialogOpen(true)}>
                <Link2 className="mr-2 h-4 w-4" />
                Paste a link
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a link</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>URL</Label>
              <Input
                placeholder="https://..."
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLinkSubmit()}
              />
            </div>
            <div className="space-y-2">
              <Label>Display name (optional)</Label>
              <Input
                placeholder="e.g. Design spec"
                value={linkName}
                onChange={(e) => setLinkName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLinkSubmit()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleLinkSubmit} disabled={!linkUrl.trim()}>Add link</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
