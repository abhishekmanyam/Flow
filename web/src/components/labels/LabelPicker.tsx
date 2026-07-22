import { useState } from "react";
import { Popover } from "@astryxdesign/core/Popover";
import { Button } from "@astryxdesign/core/Button";
import { TextInput } from "@astryxdesign/core/TextInput";
import { List, ListItem } from "@astryxdesign/core/List";
import { Token } from "@astryxdesign/core/Token";
import { Icon } from "@astryxdesign/core/Icon";
import { HStack } from "@astryxdesign/core/HStack";
import { VStack } from "@astryxdesign/core/VStack";
import { Text } from "@astryxdesign/core/Text";
import { Divider } from "@astryxdesign/core/Divider";
import { Plus, Tags } from "lucide-react";
import { createLabel } from "@/lib/firestore";
import { LABEL_COLORS } from "@/lib/types";
import { toast } from "@/components/system/toast";
import LabelBadge from "./LabelBadge";
import type { Label } from "@/lib/types";

/** Colored dot carrying a label's own hex color. */
function colorDot(color: string) {
  return (
    <svg viewBox="0 0 8 8" width={8} height={8} aria-hidden="true">
      <circle cx={4} cy={4} r={4} fill={color} />
    </svg>
  );
}

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
  const [newColor, setNewColor] = useState<string>(LABEL_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");

  const canCreate = !!workspaceId && !!projectId;

  const toggle = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter((lid) => lid !== id) : [...selectedIds, id]);
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
  const filtered = labels.filter((l) => l.name.toLowerCase().includes(query.trim().toLowerCase()));

  const trigger =
    selected.length > 0 ? (
      <Button label="Edit labels" variant="secondary" size="sm" isDisabled={disabled}>
        <HStack gap={1} wrap="wrap">
          {selected.map((l) => (
            <LabelBadge key={l.id} name={l.name} color={l.color} />
          ))}
        </HStack>
      </Button>
    ) : (
      <Button label="Labels" variant="secondary" size="sm" icon={<Tags />} isDisabled={disabled} />
    );

  const content = creating ? (
    <VStack gap={3} padding={3} width={260}>
      <Text type="label">New label</Text>
      <TextInput
        label="Label name"
        isLabelHidden
        placeholder="Label name"
        value={newName}
        onChange={setNewName}
        hasAutoFocus
      />
      <HStack gap={1} wrap="wrap">
        {LABEL_COLORS.map((c) => (
          <Token
            key={c}
            label={c}
            isLabelHidden
            size="sm"
            icon={colorDot(c)}
            endContent={newColor === c ? <Icon icon="check" size="xsm" /> : undefined}
            onClick={() => setNewColor(c)}
          />
        ))}
      </HStack>
      <HStack gap={2}>
        <Button
          label="Create"
          variant="primary"
          size="sm"
          isDisabled={!newName.trim() || saving}
          isLoading={saving}
          onClick={handleCreate}
        />
        <Button label="Cancel" variant="ghost" size="sm" onClick={() => { setCreating(false); setNewName(""); }} />
      </HStack>
    </VStack>
  ) : (
    <VStack gap={2} padding={2} width={260}>
      <TextInput label="Search labels" isLabelHidden placeholder="Search labels..." value={query} onChange={setQuery} size="sm" />
      {filtered.length === 0 ? (
        <VStack padding={3} align="center">
          <Text type="supporting">No labels found.</Text>
        </VStack>
      ) : (
        <List hasDividers density="compact">
          {filtered.map((label) => (
            <ListItem
              key={label.id}
              label={label.name}
              isSelected={selectedIds.includes(label.id)}
              startContent={<Token label={label.name} isLabelHidden size="sm" icon={colorDot(label.color)} />}
              endContent={selectedIds.includes(label.id) ? <Icon icon="check" size="sm" /> : undefined}
              onClick={() => toggle(label.id)}
            />
          ))}
        </List>
      )}
      {canCreate && (
        <>
          <Divider />
          <Button label="Create label" variant="ghost" size="sm" icon={<Plus />} onClick={() => setCreating(true)} />
        </>
      )}
    </VStack>
  );

  return (
    <Popover
      content={content}
      isOpen={open}
      onOpenChange={(v) => { setOpen(v); if (!v) setCreating(false); }}
      placement="below"
      alignment="start"
      width="auto"
    >
      {trigger}
    </Popover>
  );
}
