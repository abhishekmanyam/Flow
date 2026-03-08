import { Badge } from "@/components/ui/badge";

interface LabelBadgeProps {
  name: string;
  color: string;
  className?: string;
}

export default function LabelBadge({ name, color, className }: LabelBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={className}
      style={{ borderColor: color, color, backgroundColor: `${color}15` }}
    >
      {name}
    </Badge>
  );
}
