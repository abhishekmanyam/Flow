import type { EventCategory } from "@/lib/types";
import { EVENT_CATEGORY_LABELS } from "@/lib/types";
import { Token } from "@astryxdesign/core/Token";

type TokenColor =
  | "default"
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "teal"
  | "cyan"
  | "blue"
  | "purple"
  | "pink"
  | "gray";

// Map each event category to the nearest Astryx Token color so categories stay
// scannable without leaking raw hex into the JSX layer.
const CATEGORY_TOKEN_COLOR: Record<EventCategory, TokenColor> = {
  meeting: "blue",
  workshop: "purple",
  webinar: "orange",
  social: "green",
  other: "gray",
};

interface EventCategoryBadgeProps {
  category: EventCategory;
}

export default function EventCategoryBadge({ category }: EventCategoryBadgeProps) {
  return (
    <Token
      label={EVENT_CATEGORY_LABELS[category]}
      color={CATEGORY_TOKEN_COLOR[category]}
      size="sm"
    />
  );
}
