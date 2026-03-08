import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { SPRINT_STATUS_LABELS } from "@/lib/types";
import type { Sprint, Task } from "@/lib/types";

function tsToDate(ts: unknown): Date | null {
  if (!ts) return null;
  if (typeof (ts as { toDate?: () => Date }).toDate === "function") return (ts as { toDate: () => Date }).toDate();
  return new Date(ts as string);
}

interface SprintHeaderProps {
  sprint: Sprint;
  tasks: Task[];
}

export default function SprintHeader({ sprint, tasks }: SprintHeaderProps) {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "done").length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const totalPoints = tasks.reduce((acc, t) => acc + (t.storyPoints ?? 0), 0);
  const donePoints = tasks.filter((t) => t.status === "done").reduce((acc, t) => acc + (t.storyPoints ?? 0), 0);

  const startDate = tsToDate(sprint.startDate);
  const endDate = tsToDate(sprint.endDate);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="font-semibold text-sm">{sprint.name}</h3>
        <Badge variant="secondary" className="text-[10px]">
          {SPRINT_STATUS_LABELS[sprint.status]}
        </Badge>
        {startDate && endDate && (
          <span className="text-xs text-muted-foreground">
            {format(startDate, "MMM d")} – {format(endDate, "MMM d")}
          </span>
        )}
      </div>
      {sprint.goal && (
        <p className="text-xs text-muted-foreground">{sprint.goal}</p>
      )}
      <div className="flex items-center gap-3">
        <Progress value={pct} className="flex-1 h-1.5" />
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {done}/{total} tasks
          {totalPoints > 0 && ` · ${donePoints}/${totalPoints} pts`}
        </span>
      </div>
    </div>
  );
}
