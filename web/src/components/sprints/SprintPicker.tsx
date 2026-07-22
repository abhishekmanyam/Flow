import { Selector, SelectorOption } from "@astryxdesign/core/Selector";
import { Badge } from "@astryxdesign/core/Badge";
import { SPRINT_STATUS_LABELS } from "@/lib/types";
import type { Sprint, SprintStatus } from "@/lib/types";

const STATUS_VARIANT: Record<SprintStatus, "neutral" | "info" | "green"> = {
  planning: "neutral",
  active: "info",
  completed: "green",
};

interface SprintPickerProps {
  sprints: Sprint[];
  selectedId: string | null;
  onChange: (id: string | null) => void;
  disabled?: boolean;
}

export default function SprintPicker({ sprints, selectedId, onChange, disabled }: SprintPickerProps) {
  const byId = new Map(sprints.map((s) => [s.id, s]));

  return (
    <Selector
      label="Sprint"
      isLabelHidden
      placeholder="No sprint"
      value={selectedId}
      onChange={(v) => onChange(v || null)}
      isDisabled={disabled}
      hasClear
      hasSearch={sprints.length > 8}
      searchPlaceholder="Search sprints..."
      options={sprints.map((s) => ({ value: s.id, label: s.name }))}
      renderOption={(option) => {
        const sprint = byId.get(option.value);
        return (
          <SelectorOption
            label={option.label}
            endContent={
              sprint ? (
                <Badge variant={STATUS_VARIANT[sprint.status]} label={SPRINT_STATUS_LABELS[sprint.status]} />
              ) : undefined
            }
          />
        );
      }}
    />
  );
}
