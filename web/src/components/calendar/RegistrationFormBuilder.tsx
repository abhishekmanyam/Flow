import { Plus } from "lucide-react";
import type { RegistrationField } from "@/lib/types";
import { VStack } from "@astryxdesign/core/VStack";
import { Button } from "@astryxdesign/core/Button";
import RegistrationFieldEditor from "./RegistrationFieldEditor";

interface RegistrationFormBuilderProps {
  fields: RegistrationField[];
  onChange: (fields: RegistrationField[]) => void;
}

export default function RegistrationFormBuilder({
  fields,
  onChange,
}: RegistrationFormBuilderProps) {
  const handleFieldChange = (index: number, updated: RegistrationField) => {
    const next = [...fields];
    next[index] = updated;
    onChange(next);
  };

  const handleFieldDelete = (index: number) => {
    onChange(fields.filter((_, i) => i !== index));
  };

  const handleMove = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= fields.length) return;
    const next = [...fields];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const handleAddField = () => {
    const newField: RegistrationField = {
      name: `field_${Date.now()}`,
      label: "",
      type: "text",
      required: false,
    };
    onChange([...fields, newField]);
  };

  return (
    <VStack gap={3}>
      {fields.map((field, index) => (
        <RegistrationFieldEditor
          key={field.name}
          field={field}
          onChange={(updated) => handleFieldChange(index, updated)}
          onDelete={() => handleFieldDelete(index)}
          onMoveUp={() => handleMove(index, -1)}
          onMoveDown={() => handleMove(index, 1)}
          isFirst={index === 0}
          isLast={index === fields.length - 1}
        />
      ))}
      <Button
        label="Add field"
        variant="secondary"
        size="sm"
        icon={<Plus size={16} />}
        onClick={handleAddField}
      />
    </VStack>
  );
}
