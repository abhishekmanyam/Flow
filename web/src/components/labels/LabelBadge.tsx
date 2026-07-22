import { Token } from "@astryxdesign/core/Token";

/** Colored dot rendered as the token's leading icon, carrying the label's own hex color. */
function colorDot(color: string) {
  return (
    <svg viewBox="0 0 8 8" width={8} height={8} aria-hidden="true">
      <circle cx={4} cy={4} r={4} fill={color} />
    </svg>
  );
}

interface LabelBadgeProps {
  name: string;
  color: string;
  className?: string;
}

export default function LabelBadge({ name, color }: LabelBadgeProps) {
  return <Token label={name} size="sm" icon={colorDot(color)} />;
}
