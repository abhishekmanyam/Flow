import { Trash2 } from "lucide-react";
import type { RegistrationField, RegistrationFieldType } from "@/lib/types";
import { REGISTRATION_FIELD_TYPE_LABELS } from "@/lib/types";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Selector } from "@astryxdesign/core/Selector";
import { Switch } from "@astryxdesign/core/Switch";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Icon } from "@astryxdesign/core/Icon";

interface RegistrationFieldEditorProps {
  field: RegistrationField;
  onChange: (updated: RegistrationField) => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}

const TYPE_OPTIONS = (
  Object.entries(REGISTRATION_FIELD_TYPE_LABELS) as [
    RegistrationFieldType,
    string,
  ][]
).map(([value, label]) => ({ value, label }));

export default function RegistrationFieldEditor({
  field,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst = false,
  isLast = false,
}: RegistrationFieldEditorProps) {
  return (
    <VStack gap={2}>
      <HStack gap={2} align="end">
        <HStack gap={0.5} align="center">
          <IconButton
            label="Move field up"
            size="sm"
            variant="ghost"
            icon={<Icon icon="arrowUp" size="sm" />}
            isDisabled={isFirst || !onMoveUp}
            onClick={() => onMoveUp?.()}
          />
          <IconButton
            label="Move field down"
            size="sm"
            variant="ghost"
            icon={<Icon icon="arrowDown" size="sm" />}
            isDisabled={isLast || !onMoveDown}
            onClick={() => onMoveDown?.()}
          />
        </HStack>

        <TextInput
          label="Field label"
          isLabelHidden
          size="sm"
          placeholder="Field label"
          value={field.label}
          onChange={(value) => onChange({ ...field, label: value })}
        />

        <Selector
          label="Field type"
          isLabelHidden
          size="sm"
          options={TYPE_OPTIONS}
          value={field.type}
          onChange={(value) =>
            onChange({
              ...field,
              type: value as RegistrationFieldType,
              options:
                value === "select" ? (field.options ?? []) : undefined,
            })
          }
        />

        <Switch
          label="Required"
          value={field.required}
          onChange={(checked) => onChange({ ...field, required: checked })}
        />

        <IconButton
          label="Delete field"
          size="sm"
          variant="ghost"
          icon={<Trash2 size={16} />}
          onClick={onDelete}
        />
      </HStack>

      {field.type === "select" && (
        <TextInput
          label="Dropdown options"
          isLabelHidden
          size="sm"
          placeholder="Option 1; Option 2; Option 3"
          value={field.options?.join("; ") ?? ""}
          onChange={(value) =>
            onChange({
              ...field,
              options: value
                .split(";")
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
        />
      )}
    </VStack>
  );
}
