import { Icon } from "@astryxdesign/core/Icon";
import { Tooltip } from "@astryxdesign/core/Tooltip";
import { AlertTriangle, ChevronsUp, Equal, ChevronsDown } from "lucide-react";
import type { ComponentProps } from "react";
import { TASK_PRIORITY_LABELS } from "@/lib/types";
import type { TaskPriority } from "@/lib/types";

interface PriorityIconProps {
  priority: TaskPriority;
  className?: string;
}

type IconColor = ComponentProps<typeof Icon>["color"];

const PRIORITY_ICON: Record<Exclude<TaskPriority, "none">, { icon: typeof AlertTriangle; color: IconColor }> = {
  urgent: { icon: AlertTriangle, color: "error" },
  high: { icon: ChevronsUp, color: "warning" },
  medium: { icon: Equal, color: "accent" },
  low: { icon: ChevronsDown, color: "secondary" },
};

export default function PriorityIcon({ priority }: PriorityIconProps) {
  if (priority === "none") return null;
  const { icon, color } = PRIORITY_ICON[priority];
  return (
    <Tooltip content={`${TASK_PRIORITY_LABELS[priority]} priority`}>
      <Icon icon={icon} color={color} size="sm" />
    </Tooltip>
  );
}
