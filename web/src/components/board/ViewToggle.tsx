import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Icon } from "@astryxdesign/core/Icon";
import { LayoutGrid, List, GanttChart } from "lucide-react";

export type ViewMode = "board" | "list" | "timeline";

interface ViewToggleProps {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
}

export default function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <SegmentedControl
      label="Board view"
      size="sm"
      value={value}
      onChange={(v) => onChange(v as ViewMode)}
    >
      <SegmentedControlItem value="board" label="Board" isLabelHidden icon={<Icon icon={LayoutGrid} size="sm" />} />
      <SegmentedControlItem value="list" label="List" isLabelHidden icon={<Icon icon={List} size="sm" />} />
      <SegmentedControlItem value="timeline" label="Timeline" isLabelHidden icon={<Icon icon={GanttChart} size="sm" />} />
    </SegmentedControl>
  );
}
