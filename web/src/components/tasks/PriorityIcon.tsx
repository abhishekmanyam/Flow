import { cn } from "@/lib/utils";
import { AlertCircle, ChevronUp, Minus, ArrowDown } from "lucide-react";
import { PRIORITY_COLORS } from "@/lib/types";
import type { TaskPriority } from "@/lib/types";

interface PriorityIconProps {
  priority: TaskPriority;
  className?: string;
}

export default function PriorityIcon({ priority, className }: PriorityIconProps) {
  const cls = cn("h-3.5 w-3.5", PRIORITY_COLORS[priority], className);
  if (priority === "urgent") return <AlertCircle className={cls} />;
  if (priority === "high") return <ChevronUp className={cls} />;
  if (priority === "medium") return <Minus className={cls} />;
  if (priority === "low") return <ArrowDown className={cls} />;
  return null;
}
