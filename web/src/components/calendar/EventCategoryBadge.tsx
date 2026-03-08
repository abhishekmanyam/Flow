import type { EventCategory } from "@/lib/types";
import { EVENT_CATEGORY_LABELS, EVENT_CATEGORY_COLORS } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

interface EventCategoryBadgeProps {
  category: EventCategory;
}

export default function EventCategoryBadge({ category }: EventCategoryBadgeProps) {
  return (
    <Badge variant="secondary" className="gap-1.5">
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: EVENT_CATEGORY_COLORS[category] }}
      />
      {EVENT_CATEGORY_LABELS[category]}
    </Badge>
  );
}
