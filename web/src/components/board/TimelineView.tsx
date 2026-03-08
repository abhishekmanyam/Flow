import { useMemo, useRef, useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronRight } from "lucide-react";
import { format, differenceInDays, addDays, startOfDay, isToday } from "date-fns";
import { cn } from "@/lib/utils";
import { STATUS_DOT_COLORS, TASK_STATUS_LABELS } from "@/lib/types";
import type { Task, WorkspaceMember, Label, Epic, Sprint, TaskStatus } from "@/lib/types";

function tsToDate(ts: unknown): Date | null {
  if (!ts) return null;
  if (typeof (ts as { toDate?: () => Date }).toDate === "function") return (ts as { toDate: () => Date }).toDate();
  return new Date(ts as string);
}

function getInitials(name: string | null | undefined) {
  if (!name) return "?";
  return name.split(/\s/).map((s) => s[0]?.toUpperCase()).slice(0, 2).join("");
}

type Grouping = "status" | "assignee" | "none";

const STATUS_BAR_COLORS: Record<TaskStatus, string> = {
  backlog: "bg-muted-foreground/40",
  todo: "bg-slate-400 dark:bg-slate-500",
  in_progress: "bg-blue-500",
  in_review: "bg-yellow-500",
  done: "bg-green-500",
};

const STATUS_ORDER: TaskStatus[] = ["backlog", "todo", "in_progress", "in_review", "done"];
const PX_PER_DAY = 40;
const SIDEBAR_WIDTH = 220;
const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 48;

interface TimelineViewProps {
  tasks: Task[];
  members: WorkspaceMember[];
  labels: Label[];
  epics?: Epic[];
  sprints?: Sprint[];
  taskIdentifiers?: Map<string, string>;
  onSelectTask: (id: string) => void;
}

interface TaskWithDates extends Task {
  _start: Date;
  _end: Date;
}

interface TaskGroup {
  key: string;
  label: string;
  tasks: TaskWithDates[];
}

export default function TimelineView({ tasks, members, onSelectTask }: TimelineViewProps) {
  const [grouping, setGrouping] = useState<Grouping>("status");
  const [unscheduledOpen, setUnscheduledOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLDivElement>(null);

  const memberMap = useMemo(() => {
    const m = new Map<string, WorkspaceMember>();
    members.forEach((mem) => m.set(mem.userId, mem));
    return m;
  }, [members]);

  // Split tasks into scheduled (have dueDate) and unscheduled
  const { scheduled, unscheduled } = useMemo(() => {
    const sched: TaskWithDates[] = [];
    const unsched: Task[] = [];
    for (const t of tasks) {
      const end = tsToDate(t.dueDate);
      const start = tsToDate(t.createdAt) ?? new Date();
      if (end) {
        sched.push({ ...t, _start: startOfDay(start), _end: startOfDay(end) });
      } else {
        unsched.push(t);
      }
    }
    return { scheduled: sched, unscheduled: unsched };
  }, [tasks]);

  // Calculate date range
  const { rangeStart, totalDays } = useMemo(() => {
    if (scheduled.length === 0) {
      const today = startOfDay(new Date());
      return { rangeStart: addDays(today, -7), rangeEnd: addDays(today, 30), totalDays: 37 };
    }
    let min = scheduled[0]._start;
    let max = scheduled[0]._end;
    for (const t of scheduled) {
      if (t._start < min) min = t._start;
      if (t._end > max) max = t._end;
    }
    const today = startOfDay(new Date());
    if (today < min) min = today;
    if (today > max) max = today;
    // Pad by 3 days on each side
    const rStart = addDays(min, -3);
    const rEnd = addDays(max, 3);
    return { rangeStart: rStart, rangeEnd: rEnd, totalDays: differenceInDays(rEnd, rStart) + 1 };
  }, [scheduled]);

  // Generate day columns
  const days = useMemo(() => {
    const arr: Date[] = [];
    for (let i = 0; i < totalDays; i++) {
      arr.push(addDays(rangeStart, i));
    }
    return arr;
  }, [rangeStart, totalDays]);

  // Month headers
  const months = useMemo(() => {
    const result: { label: string; startIdx: number; span: number }[] = [];
    let currentMonth = "";
    let currentStart = 0;
    days.forEach((d, i) => {
      const m = format(d, "MMM yyyy");
      if (m !== currentMonth) {
        if (currentMonth) result.push({ label: currentMonth, startIdx: currentStart, span: i - currentStart });
        currentMonth = m;
        currentStart = i;
      }
    });
    if (currentMonth) result.push({ label: currentMonth, startIdx: currentStart, span: days.length - currentStart });
    return result;
  }, [days]);

  // Group tasks
  const groups: TaskGroup[] = useMemo(() => {
    if (grouping === "none") {
      const sorted = [...scheduled].sort((a, b) => a._end.getTime() - b._end.getTime());
      return [{ key: "all", label: "All tasks", tasks: sorted }];
    }
    if (grouping === "status") {
      return STATUS_ORDER.map((s) => ({
        key: s,
        label: TASK_STATUS_LABELS[s],
        tasks: scheduled.filter((t) => t.status === s),
      })).filter((g) => g.tasks.length > 0);
    }
    // By assignee
    const byAssignee = new Map<string, TaskWithDates[]>();
    const unassigned: TaskWithDates[] = [];
    for (const t of scheduled) {
      if (t.assigneeId) {
        const list = byAssignee.get(t.assigneeId) ?? [];
        list.push(t);
        byAssignee.set(t.assigneeId, list);
      } else {
        unassigned.push(t);
      }
    }
    const result: TaskGroup[] = [];
    for (const [userId, taskList] of byAssignee) {
      const mem = memberMap.get(userId);
      result.push({ key: userId, label: mem?.profile?.name ?? "Unknown", tasks: taskList });
    }
    result.sort((a, b) => a.label.localeCompare(b.label));
    if (unassigned.length > 0) result.push({ key: "unassigned", label: "Unassigned", tasks: unassigned });
    return result;
  }, [scheduled, grouping, memberMap]);

  // Scroll to today on mount
  useEffect(() => {
    if (todayRef.current && scrollRef.current) {
      const todayLeft = todayRef.current.offsetLeft;
      scrollRef.current.scrollLeft = todayLeft - scrollRef.current.clientWidth / 3;
    }
  }, [totalDays]);

  const todayIdx = differenceInDays(startOfDay(new Date()), rangeStart);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-2 border-b">
        <span className="text-sm text-muted-foreground">Group by:</span>
        <Select value={grouping} onValueChange={(v) => setGrouping(v as Grouping)}>
          <SelectTrigger className="w-36 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="status">Status</SelectItem>
            <SelectItem value="assignee">Assignee</SelectItem>
            <SelectItem value="none">None</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 overflow-hidden flex">
        {/* Sidebar */}
        <div className="shrink-0 border-r overflow-y-auto" style={{ width: SIDEBAR_WIDTH }}>
          {/* Header spacer */}
          <div className="border-b" style={{ height: HEADER_HEIGHT }}>
            <div className="px-3 py-2 text-xs font-medium text-muted-foreground">Task</div>
          </div>
          {/* Task rows */}
          {groups.map((group) => (
            <div key={group.key}>
              {grouping !== "none" && (
                <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 border-b">
                  {grouping === "status" && (
                    <span className={cn("inline-block h-2 w-2 rounded-full mr-1.5", STATUS_DOT_COLORS[group.key as TaskStatus])} />
                  )}
                  {group.label} ({group.tasks.length})
                </div>
              )}
              {group.tasks.map((task) => {
                const mem = task.assigneeId ? memberMap.get(task.assigneeId) : null;
                return (
                  <div
                    key={task.id}
                    className="flex items-center gap-2 px-3 border-b cursor-pointer hover:bg-muted/30"
                    style={{ height: ROW_HEIGHT }}
                    onClick={() => onSelectTask(task.id)}
                  >
                    <span className="text-sm truncate flex-1">{task.title}</span>
                    {mem && (
                      <Avatar className="h-5 w-5 shrink-0">
                        <AvatarImage src={mem.profile?.avatarUrl ?? undefined} />
                        <AvatarFallback className="text-[9px]">{getInitials(mem.profile?.name)}</AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
          {/* Unscheduled */}
          {unscheduled.length > 0 && (
            <Collapsible open={unscheduledOpen} onOpenChange={setUnscheduledOpen}>
              <CollapsibleTrigger className="flex items-center gap-1.5 px-3 py-1.5 w-full text-xs font-semibold text-muted-foreground bg-muted/50 border-b hover:bg-muted/70">
                <ChevronRight className={cn("h-3 w-3 transition-transform", unscheduledOpen && "rotate-90")} />
                Unscheduled ({unscheduled.length})
              </CollapsibleTrigger>
              <CollapsibleContent>
                {unscheduled.map((task) => {
                  const mem = task.assigneeId ? memberMap.get(task.assigneeId) : null;
                  return (
                    <div
                      key={task.id}
                      className="flex items-center gap-2 px-3 border-b cursor-pointer hover:bg-muted/30"
                      style={{ height: ROW_HEIGHT }}
                      onClick={() => onSelectTask(task.id)}
                    >
                      <span className="text-sm truncate flex-1 text-muted-foreground">{task.title}</span>
                      {mem && (
                        <Avatar className="h-5 w-5 shrink-0">
                          <AvatarImage src={mem.profile?.avatarUrl ?? undefined} />
                          <AvatarFallback className="text-[9px]">{getInitials(mem.profile?.name)}</AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>

        {/* Timeline grid */}
        <div className="flex-1 overflow-auto" ref={scrollRef}>
          <div style={{ width: totalDays * PX_PER_DAY, minHeight: "100%" }} className="relative">
            {/* Date header */}
            <div className="sticky top-0 z-10 bg-background border-b" style={{ height: HEADER_HEIGHT }}>
              {/* Month row */}
              <div className="flex h-1/2">
                {months.map((m) => (
                  <div
                    key={`${m.label}-${m.startIdx}`}
                    className="text-[10px] font-medium text-muted-foreground border-r px-1 flex items-center"
                    style={{ width: m.span * PX_PER_DAY }}
                  >
                    {m.label}
                  </div>
                ))}
              </div>
              {/* Day row */}
              <div className="flex h-1/2">
                {days.map((d, i) => (
                  <div
                    key={i}
                    className={cn(
                      "text-[10px] text-center border-r flex items-center justify-center",
                      isToday(d) ? "bg-primary/10 font-bold text-primary" : "text-muted-foreground",
                      d.getDay() === 0 || d.getDay() === 6 ? "bg-muted/30" : ""
                    )}
                    style={{ width: PX_PER_DAY }}
                  >
                    {format(d, "d")}
                  </div>
                ))}
              </div>
            </div>

            {/* Today line */}
            {todayIdx >= 0 && todayIdx < totalDays && (
              <div
                ref={todayRef}
                className="absolute top-0 bottom-0 w-px bg-red-500 z-[5] pointer-events-none"
                style={{ left: todayIdx * PX_PER_DAY + PX_PER_DAY / 2 }}
              />
            )}

            {/* Grid lines (weekend shading) */}
            <div className="absolute inset-0" style={{ top: HEADER_HEIGHT }}>
              {days.map((d, i) => (
                (d.getDay() === 0 || d.getDay() === 6) ? (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 bg-muted/20"
                    style={{ left: i * PX_PER_DAY, width: PX_PER_DAY }}
                  />
                ) : null
              ))}
            </div>

            {/* Task bars */}
            <TooltipProvider>
              <div style={{ paddingTop: 0 }}>
                {groups.map((group) => (
                  <div key={group.key}>
                    {grouping !== "none" && (
                      <div className="border-b bg-muted/50" style={{ height: 28 }} />
                    )}
                    {group.tasks.map((task) => {
                      const startOffset = differenceInDays(task._start, rangeStart);
                      const barDays = Math.max(differenceInDays(task._end, task._start), 1);
                      const left = startOffset * PX_PER_DAY;
                      const width = barDays * PX_PER_DAY;

                      return (
                        <div key={task.id} className="relative border-b" style={{ height: ROW_HEIGHT }}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className={cn(
                                  "absolute top-1.5 rounded-md cursor-pointer hover:opacity-80 transition-opacity flex items-center px-1.5 overflow-hidden",
                                  STATUS_BAR_COLORS[task.status]
                                )}
                                style={{
                                  left: Math.max(left, 0),
                                  width: Math.max(width, PX_PER_DAY / 2),
                                  height: ROW_HEIGHT - 12,
                                }}
                                onClick={() => onSelectTask(task.id)}
                              >
                                <span className="text-[10px] font-medium text-white truncate leading-none">{task.title}</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <div className="text-xs space-y-0.5">
                                <div className="font-medium">{task.title}</div>
                                <div>{format(task._start, "MMM d")} — {format(task._end, "MMM d")}</div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      );
                    })}
                  </div>
                ))}
                {/* Unscheduled spacer rows */}
                {unscheduled.length > 0 && (
                  <div>
                    <div className="border-b bg-muted/50" style={{ height: 28 }} />
                    {unscheduledOpen && unscheduled.map((task) => (
                      <div key={task.id} className="relative border-b" style={{ height: ROW_HEIGHT }}>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-[10px] text-muted-foreground">No due date</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TooltipProvider>
          </div>
        </div>
      </div>
    </div>
  );
}
