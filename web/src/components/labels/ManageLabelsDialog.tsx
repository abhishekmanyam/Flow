import { useState } from "react";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Layout, LayoutContent, LayoutFooter } from "@astryxdesign/core/Layout";
import { HStack } from "@astryxdesign/core/HStack";
import { VStack } from "@astryxdesign/core/VStack";
import { Button } from "@astryxdesign/core/Button";
import { IconButton } from "@astryxdesign/core/IconButton";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Token } from "@astryxdesign/core/Token";
import { Icon } from "@astryxdesign/core/Icon";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Pencil, Trash2, Plus, Tags } from "lucide-react";
import { toast } from "@/components/system/toast";
import { createLabel, updateLabel, deleteLabel } from "@/lib/firestore";
import { LABEL_COLORS } from "@/lib/types";
import type { Label } from "@/lib/types";

/** Colored dot carrying a label's own hex color. */
function colorDot(color: string) {
  return (
    <svg viewBox="0 0 8 8" width={8} height={8} aria-hidden="true">
      <circle cx={4} cy={4} r={4} fill={color} />
    </svg>
  );
}

function ColorSwatches({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <HStack gap={1} wrap="wrap">
      {LABEL_COLORS.map((c) => (
        <Token
          key={c}
          label={c}
          isLabelHidden
          size="sm"
          icon={colorDot(c)}
          endContent={value === c ? <Icon icon="check" size="xsm" /> : undefined}
          onClick={() => onChange(c)}
        />
      ))}
    </HStack>
  );
}

interface ManageLabelsDialogProps {
  open: boolean;
  onClose: () => void;
  labels: Label[];
  workspaceId: string;
  projectId: string;
}

export default function ManageLabelsDialog({ open, onClose, labels, workspaceId, projectId }: ManageLabelsDialogProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState<string>(LABEL_COLORS[0]);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string>(LABEL_COLORS[0]);
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
    <Dialog isOpen={open} onOpenChange={(v) => !v && onClose()} purpose="form" width={480}>
      <Layout
        header={<DialogHeader title="Manage labels" onOpenChange={() => onClose()} />}
        content={
          <LayoutContent>
            <VStack gap={2}>
              {labels.length === 0 && !adding && (
                <EmptyState icon={<Tags />} title="No labels yet" description="Create labels to organize your tasks." isCompact />
              )}
              {labels.map((label) =>
                editingId === label.id ? (
                  <VStack key={label.id} gap={2} padding={3}>
                    <TextInput
                      label="Label name"
                      isLabelHidden
                      value={editName}
                      onChange={setEditName}
                      placeholder="Label name"
                      hasAutoFocus
                    />
                    <ColorSwatches value={editColor} onChange={setEditColor} />
                    <HStack gap={2}>
                      <Button label="Save" variant="primary" size="sm" isDisabled={!editName.trim()} onClick={() => handleUpdate(label.id)} />
                      <Button label="Cancel" variant="ghost" size="sm" onClick={() => setEditingId(null)} />
                    </HStack>
                  </VStack>
                ) : (
                  <HStack key={label.id} justify="between" align="center" gap={2}>
                    <Token label={label.name} size="sm" icon={colorDot(label.color)} />
                    <HStack gap={1}>
                      <IconButton label="Edit label" tooltip="Edit" variant="ghost" size="sm" icon={<Pencil />} onClick={() => startEdit(label)} />
                      <IconButton label="Delete label" tooltip="Delete" variant="destructive" size="sm" icon={<Trash2 />} onClick={() => handleDelete(label.id)} />
                    </HStack>
                  </HStack>
                )
              )}
              {adding && (
                <VStack gap={2} padding={3}>
                  <TextInput label="Label name" isLabelHidden value={newName} onChange={setNewName} placeholder="Label name" hasAutoFocus />
                  <ColorSwatches value={newColor} onChange={setNewColor} />
                  <HStack gap={2}>
                    <Button label="Create" variant="primary" size="sm" isDisabled={!newName.trim()} onClick={handleCreate} />
                    <Button label="Cancel" variant="ghost" size="sm" onClick={() => { setAdding(false); setNewName(""); }} />
                  </HStack>
                </VStack>
              )}
            </VStack>
          </LayoutContent>
        }
        footer={
          !adding ? (
            <LayoutFooter>
              <Button label="Add label" variant="secondary" size="sm" icon={<Plus />} onClick={() => setAdding(true)} />
            </LayoutFooter>
          ) : undefined
        }
      />
    </Dialog>
  );
}
