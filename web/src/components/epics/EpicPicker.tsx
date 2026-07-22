import { Selector } from "@astryxdesign/core/Selector";
import type { Epic } from "@/lib/types";

/** Colored dot carrying the epic's own hex color, used as an option/left icon. */
function colorDot(color: string) {
  return (
    <svg viewBox="0 0 8 8" width={8} height={8} aria-hidden="true">
      <circle cx={4} cy={4} r={4} fill={color} />
    </svg>
  );
}

interface EpicPickerProps {
  epics: Epic[];
  selectedId: string | null;
  onChange: (id: string | null) => void;
  disabled?: boolean;
}

export default function EpicPicker({ epics, selectedId, onChange, disabled }: EpicPickerProps) {
  return (
    <Selector
      label="Epic"
      isLabelHidden
      placeholder="Epic"
      value={selectedId}
      onChange={(v) => onChange(v || null)}
      isDisabled={disabled}
      hasClear
      hasSearch={epics.length > 8}
      searchPlaceholder="Search epics..."
      options={epics.map((e) => ({ value: e.id, label: e.title, icon: colorDot(e.color) }))}
    />
  );
}
