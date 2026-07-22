import { Token } from "@astryxdesign/core/Token";

/** Colored dot rendered as the token's leading icon, carrying the epic's own hex color. */
function colorDot(color: string) {
  return (
    <svg viewBox="0 0 8 8" width={8} height={8} aria-hidden="true">
      <circle cx={4} cy={4} r={4} fill={color} />
    </svg>
  );
}

interface EpicBadgeProps {
  title: string;
  color: string;
  className?: string;
}

export default function EpicBadge({ title, color }: EpicBadgeProps) {
  return <Token label={title} size="sm" icon={colorDot(color)} />;
}
