import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LayoutGrid, List, GanttChart } from "lucide-react";

export type ViewMode = "board" | "list" | "timeline";

interface ViewToggleProps {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
}

export default function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <ToggleGroup type="single" value={value} onValueChange={(v) => v && onChange(v as ViewMode)}>
      <ToggleGroupItem value="board" aria-label="Board view" className="h-8 w-8 p-0">
        <LayoutGrid className="h-4 w-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="list" aria-label="List view" className="h-8 w-8 p-0">
        <List className="h-4 w-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="timeline" aria-label="Timeline view" className="h-8 w-8 p-0">
        <GanttChart className="h-4 w-4" />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
