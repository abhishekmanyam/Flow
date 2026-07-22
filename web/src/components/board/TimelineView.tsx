import { useMemo, useRef, useEffect, useState, Fragment } from "react";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { StackItem } from "@astryxdesign/core/Layout";
import { Card } from "@astryxdesign/core/Card";
import { Divider } from "@astryxdesign/core/Divider";
import { Text } from "@astryxdesign/core/Text";
import { Avatar } from "@astryxdesign/core/Avatar";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { ClickableCard } from "@astryxdesign/core/ClickableCard";
import { Tooltip } from "@astryxdesign/core/Tooltip";
import { Collapsible } from "@astryxdesign/core/Collapsible";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Icon } from "@astryxdesign/core/Icon";
import { CalendarClock } from "lucide-react";
import { format, differenceInDays, addDays, startOfDay, isToday } from "date-fns";
import { TASK_STATUS_LABELS } from "@/lib/types";
import type { Task, WorkspaceMember, Label, Epic, Sprint, TaskStatus } from "@/lib/types";

function tsToDate(ts: unknown): Date | null {
  if (!ts) return null;
  if (typeof (ts as { toDate?: () => Date }).toDate === "function") return (ts as { toDate: () => Date }).toDate();
  return new Date(ts as string);
}

type Grouping = "status" | "assignee" | "none";
type DotVariant = "success" | "warning" | "error" | "accent" | "neutral";
type CardVariant = "gray" | "blue" | "yellow" | "green";

const STATUS_DOT_VARIANT: Record<TaskStatus, DotVariant> = {
  backlog: "neutral",
  todo: "neutral",
  in_progress: "accent",
  in_review: "warning",
  done: "success",
};

const STATUS_BAR_VARIANT: Record<TaskStatus, CardVariant> = {
  backlog: "gray",
  todo: "gray",
  in_progress: "blue",
  in_review: "yellow",
  done: "green",
};

const STATUS_ORDER: TaskStatus[] = ["backlog", "todo", "in_progress", "in_review", "done"];
const PX_PER_DAY = 40;
const SIDEBAR_WIDTH = 220;
const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 48;
const GROUP_HEIGHT = 28;

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
  const scrollRef = useRef<HTMLElement | null>(null);

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

  const todayIdx = differenceInDays(startOfDay(new Date()), rangeStart);

  // Scroll to today on mount
  useEffect(() => {
    if (scrollRef.current && todayIdx >= 0) {
      const todayLeft = todayIdx * PX_PER_DAY + PX_PER_DAY / 2;
      scrollRef.current.scrollLeft = todayLeft - scrollRef.current.clientWidth / 3;
    }
  }, [totalDays, todayIdx]);

  if (scheduled.length === 0 && unscheduled.length === 0) {
    return (
      <EmptyState
        icon={<Icon icon={CalendarClock} size="lg" color="secondary" />}
        title="Nothing to schedule"
        description="Tasks with a due date appear on the timeline."
      />
    );
  }

  const renderSidebarRow = (task: Task, muted = false) => {
    const mem = task.assigneeId ? memberMap.get(task.assigneeId) : null;
    return (
      <Fragment key={task.id}>
        <HStack height={ROW_HEIGHT} vAlign="center" gap={2} paddingInline={3} onClick={() => onSelectTask(task.id)}>
          <StackItem size="fill">
            <Text type="body" color={muted ? "secondary" : "primary"} maxLines={1}>{task.title}</Text>
          </StackItem>
          {mem && <Avatar size="xsmall" name={mem.profile?.name ?? undefined} src={mem.profile?.avatarUrl ?? undefined} />}
        </HStack>
        <Divider />
      </Fragment>
    );
  };

  return (
    <VStack height="100%">
      <HStack gap={3} vAlign="center" paddingInline={4} paddingBlock={2}>
        <Text type="supporting" color="secondary">Group by</Text>
        <SegmentedControl label="Group by" size="sm" value={grouping} onChange={(v) => setGrouping(v as Grouping)}>
          <SegmentedControlItem value="status" label="Status" />
          <SegmentedControlItem value="assignee" label="Assignee" />
          <SegmentedControlItem value="none" label="None" />
        </SegmentedControl>
      </HStack>
      <Divider />

      <StackItem size="fill">
        <HStack height="100%" vAlign="stretch">
          {/* Sidebar (static width, no shrink) */}
          <StackItem>
            <VStack width={SIDEBAR_WIDTH} height="100%" isScrollable>
              <HStack height={HEADER_HEIGHT} vAlign="center" paddingInline={3}>
                <Text type="supporting" weight="medium" color="secondary">Task</Text>
              </HStack>
              <Divider />
              {groups.map((group) => (
                <VStack key={group.key}>
                  {grouping !== "none" && (
                    <>
                      <Card variant="muted" padding={0} height={GROUP_HEIGHT}>
                        <HStack height="100%" vAlign="center" gap={1.5} paddingInline={3}>
                          {grouping === "status" && (
                            <StatusDot variant={STATUS_DOT_VARIANT[group.key as TaskStatus]} label={`${group.label} status`} />
                          )}
                          <Text type="supporting" weight="semibold" color="secondary">{group.label} ({group.tasks.length})</Text>
                        </HStack>
                      </Card>
                      <Divider />
                    </>
                  )}
                  {group.tasks.map((task) => renderSidebarRow(task))}
                </VStack>
              ))}
              {unscheduled.length > 0 && (
                <Collapsible
                  isOpen={unscheduledOpen}
                  onOpenChange={setUnscheduledOpen}
                  trigger={
                    <Card variant="muted" padding={0} height={GROUP_HEIGHT}>
                      <HStack height="100%" vAlign="center" paddingInline={3}>
                        <Text type="supporting" weight="semibold" color="secondary">Unscheduled ({unscheduled.length})</Text>
                      </HStack>
                    </Card>
                  }
                >
                  {unscheduled.map((task) => renderSidebarRow(task, true))}
                </Collapsible>
              )}
            </VStack>
          </StackItem>

          <Divider orientation="vertical" />

          {/* Timeline grid */}
          <StackItem size="fill">
            <VStack isScrollable height="100%" ref={scrollRef}>
              {/* geometry-only: overall canvas width/height + positioning context */}
              <VStack style={{ width: totalDays * PX_PER_DAY, minHeight: "100%", position: "relative" }}>
                {/* Date header — sticky overlay; background token permitted on a scroll overlay */}
                <VStack style={{ position: "sticky", top: 0, zIndex: 10, height: HEADER_HEIGHT, background: "var(--color-background-surface)" }}>
                  <HStack style={{ height: HEADER_HEIGHT / 2 }}>
                    {months.map((m) => (
                      <HStack key={`${m.label}-${m.startIdx}`} style={{ width: m.span * PX_PER_DAY }} vAlign="center" paddingInline={1}>
                        <Text type="supporting" size="2xs" weight="medium" color="secondary" maxLines={1}>{m.label}</Text>
                      </HStack>
                    ))}
                  </HStack>
                  <HStack style={{ height: HEADER_HEIGHT / 2 }}>
                    {days.map((d, i) => {
                      const weekend = d.getDay() === 0 || d.getDay() === 6;
                      const today = isToday(d);
                      return (
                        <Card key={i} padding={0} width={PX_PER_DAY} height="100%" variant={today ? "blue" : weekend ? "muted" : "transparent"}>
                          <HStack height="100%" vAlign="center" hAlign="center">
                            <Text type="supporting" size="2xs" color={today ? "accent" : "secondary"} weight={today ? "bold" : "normal"}>
                              {format(d, "d")}
                            </Text>
                          </HStack>
                        </Card>
                      );
                    })}
                  </HStack>
                </VStack>

                {/* Weekend shading overlay (behind bars) — token-bridge background on overlay */}
                <VStack style={{ position: "absolute", top: HEADER_HEIGHT, left: 0, right: 0, bottom: 0, pointerEvents: "none" }}>
                  {days.map((d, i) =>
                    d.getDay() === 0 || d.getDay() === 6 ? (
                      <VStack key={i} style={{ position: "absolute", top: 0, bottom: 0, left: i * PX_PER_DAY, width: PX_PER_DAY, background: "var(--color-background-muted)" }} />
                    ) : null
                  )}
                </VStack>

                {/* Today line */}
                {todayIdx >= 0 && todayIdx < totalDays && (
                  <VStack style={{ position: "absolute", top: 0, bottom: 0, left: todayIdx * PX_PER_DAY + PX_PER_DAY / 2, width: 1, background: "var(--color-border-red)", zIndex: 5, pointerEvents: "none" }} />
                )}

                {/* Task bars */}
                {groups.map((group) => (
                  <VStack key={group.key}>
                    {grouping !== "none" && (
                      <>
                        <Card variant="muted" padding={0} height={GROUP_HEIGHT} />
                        <Divider />
                      </>
                    )}
                    {group.tasks.map((task) => {
                      const startOffset = differenceInDays(task._start, rangeStart);
                      const barDays = Math.max(differenceInDays(task._end, task._start), 1);
                      const left = Math.max(startOffset * PX_PER_DAY, 0);
                      const width = Math.max(barDays * PX_PER_DAY, PX_PER_DAY / 2);
                      return (
                        <Fragment key={task.id}>
                          <VStack style={{ height: ROW_HEIGHT, position: "relative" }}>
                            <Tooltip content={`${task.title} · ${format(task._start, "MMM d")} — ${format(task._end, "MMM d")}`}>
                              <ClickableCard
                                label={task.title}
                                variant={STATUS_BAR_VARIANT[task.status]}
                                padding={1}
                                onClick={() => onSelectTask(task.id)}
                                style={{ position: "absolute", top: 6, left, width, height: ROW_HEIGHT - 12 }}
                              >
                                <Text type="supporting" size="2xs" maxLines={1}>{task.title}</Text>
                              </ClickableCard>
                            </Tooltip>
                          </VStack>
                          <Divider />
                        </Fragment>
                      );
                    })}
                  </VStack>
                ))}
                {unscheduled.length > 0 && (
                  <VStack>
                    <Card variant="muted" padding={0} height={GROUP_HEIGHT} />
                    <Divider />
                    {unscheduledOpen && unscheduled.map((task) => (
                      <Fragment key={task.id}>
                        <HStack style={{ height: ROW_HEIGHT }} vAlign="center" hAlign="center">
                          <Text type="supporting" size="2xs" color="secondary">No due date</Text>
                        </HStack>
                        <Divider />
                      </Fragment>
                    ))}
                  </VStack>
                )}
              </VStack>
            </VStack>
          </StackItem>
        </HStack>
      </StackItem>
    </VStack>
  );
}
