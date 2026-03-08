import type { RegistrationField, RegistrationFieldType } from "@/lib/types";
import { REGISTRATION_FIELD_TYPE_LABELS } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2 } from "lucide-react";

interface RegistrationFieldEditorProps {
  field: RegistrationField;
  onChange: (updated: RegistrationField) => void;
  onDelete: () => void;
}

export default function RegistrationFieldEditor({
  field,
  onChange,
  onDelete,
}: RegistrationFieldEditorProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Input
          value={field.label}
          onChange={(e) => onChange({ ...field, label: e.target.value })}
          placeholder="Field label"
          className="flex-1"
        />
        <Select
          value={field.type}
          onValueChange={(v) =>
            onChange({
              ...field,
              type: v as RegistrationFieldType,
              options: v === "select" ? field.options ?? [] : undefined,
            })
          }
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(
              Object.entries(REGISTRATION_FIELD_TYPE_LABELS) as [
                RegistrationFieldType,
                string,
              ][]
            ).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1.5">
          <Checkbox
            id={`required-${field.name}`}
            checked={field.required}
            onCheckedChange={(checked) =>
              onChange({ ...field, required: checked === true })
            }
          />
          <label
            htmlFor={`required-${field.name}`}
            className="text-sm text-muted-foreground whitespace-nowrap"
          >
            Required
          </label>
        </div>
        <Button variant="ghost" size="icon" onClick={onDelete}>
          <Trash2 className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>
      {field.type === "select" && (
        <Input
          value={field.options?.join(", ") ?? ""}
          onChange={(e) =>
            onChange({
              ...field,
              options: e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
          placeholder="Option 1, Option 2, ..."
          className="ml-0"
        />
      )}
    </div>
  );
}
