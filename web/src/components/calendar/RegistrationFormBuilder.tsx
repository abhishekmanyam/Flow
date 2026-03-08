import type { RegistrationField } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
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
    <div className="space-y-3">
      {fields.map((field, index) => (
        <RegistrationFieldEditor
          key={field.name}
          field={field}
          onChange={(updated) => handleFieldChange(index, updated)}
          onDelete={() => handleFieldDelete(index)}
        />
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleAddField}
        className="w-full"
      >
        <Plus className="mr-2 h-4 w-4" />
        Add field
      </Button>
    </div>
  );
}
