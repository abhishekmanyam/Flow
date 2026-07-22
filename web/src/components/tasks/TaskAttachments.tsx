import { useState, useCallback } from "react";
import { Button } from "@astryxdesign/core/Button";
import { IconButton } from "@astryxdesign/core/IconButton";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Layout, LayoutContent, LayoutFooter } from "@astryxdesign/core/Layout";
import { TextInput } from "@astryxdesign/core/TextInput";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Link } from "@astryxdesign/core/Link";
import { Timestamp as TimestampText } from "@astryxdesign/core/Timestamp";
import { Divider } from "@astryxdesign/core/Divider";
import { Paperclip, Plus, X, HardDrive, Link2 } from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { addAttachment, removeAttachment } from "@/lib/firestore";
import { toast } from "@/components/system/toast";
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
    <VStack gap={3}>
      {attachments.length === 0 ? (
        <EmptyState icon={<Paperclip />} title="No attachments" description="Attach files from Google Drive or paste a link" isCompact />
      ) : (
        <VStack gap={0}>
          {attachments.map((a, i) => {
            const TypeIcon = TYPE_ICONS[a.type] ?? Paperclip;
            return (
              <VStack key={a.id} gap={0}>
                {i > 0 && <Divider />}
                <HStack gap={2} align="center" paddingBlock={2}>
                  <Icon icon={TypeIcon} size="sm" color="secondary" />
                  <HStack gap={2} align="center" width="fill">
                    <Link href={a.url} target="_blank" isExternalLink>
                      {a.name}
                    </Link>
                  </HStack>
                  <TimestampText value={tsToDate(a.addedAt).toISOString()} format="date" />
                  {canEdit && (
                    <IconButton label="Remove attachment" tooltip="Remove" variant="ghost" size="sm" icon={<X />} onClick={() => handleRemove(a)} />
                  )}
                </HStack>
              </VStack>
            );
          })}
        </VStack>
      )}

      {canEdit && (
        <HStack gap={2} wrap="wrap">
          <GoogleDrivePicker onFilePicked={handleFilePicked} disabled={!canEdit} />
          <DropdownMenu
            button={{ label: "More", variant: "secondary", size: "sm", icon: <Plus /> }}
            hasChevron={false}
            items={[{ label: "Paste a link", icon: Link2, onClick: () => setLinkDialogOpen(true) }]}
          />
        </HStack>
      )}

      <Dialog isOpen={linkDialogOpen} onOpenChange={setLinkDialogOpen} purpose="form" width={440}>
        <Layout
          header={<DialogHeader title="Add a link" onOpenChange={() => setLinkDialogOpen(false)} />}
          content={
            <LayoutContent>
              <VStack gap={4}>
                <TextInput
                  label="URL"
                  placeholder="https://..."
                  value={linkUrl}
                  onChange={setLinkUrl}
                  hasAutoFocus
                />
                <TextInput
                  label="Display name"
                  isOptional
                  placeholder="e.g. Design spec"
                  value={linkName}
                  onChange={setLinkName}
                />
              </VStack>
            </LayoutContent>
          }
          footer={
            <LayoutFooter>
              <HStack gap={2} hAlign="end">
                <Button label="Cancel" variant="secondary" onClick={() => setLinkDialogOpen(false)} />
                <Button label="Add link" variant="primary" isDisabled={!linkUrl.trim()} onClick={handleLinkSubmit} />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>
    </VStack>
  );
}
