import { Badge } from "@/components/ui/badge";

interface EpicBadgeProps {
  title: string;
  color: string;
  className?: string;
}

export default function EpicBadge({ title, color, className }: EpicBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={className}
      style={{ borderColor: color, color, backgroundColor: `${color}15` }}
    >
      {title}
    </Badge>
  );
}
