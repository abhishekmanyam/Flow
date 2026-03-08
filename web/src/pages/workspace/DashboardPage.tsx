import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { subscribeToTasks, subscribeToAccessibleProjects, subscribeToWorkspaceEvents, getWorkspaceMembers } from "@/lib/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MotionPage } from "@/components/ui/motion-page";
import { StaggerContainer, StaggerItem } from "@/components/ui/stagger";
import { TextGenerateEffect } from "@/components/ui/text-generate-effect";
import { format, isPast, isToday, formatDistanceToNow } from "date-fns";
import { EmptyState } from "@/components/ui/empty-state";
import { FolderKanban, CheckSquare, Clock, AlertCircle, PartyPopper, Activity } from "lucide-react";
import PriorityIcon from "@/components/tasks/PriorityIcon";
import { STATUS_DOT_COLORS, TASK_STATUS_LABELS, TASK_PRIORITY_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ShootingStars } from "@/components/ui/shooting-stars";
import { StarsBackground } from "@/components/ui/stars-background";
import type { Task, Project, TaskEvent, TaskStatus, TaskPriority, WorkspaceMember } from "@/lib/types";

function tsToDate(ts: unknown): Date | null {
  if (!ts) return null;
  if (typeof (ts as { toDate?: () => Date }).toDate === "function") return (ts as { toDate: () => Date }).toDate();
  return new Date(ts as string);
}

export default function DashboardPage() {
  const { workspace, user, role } = useAuthStore();
  const navigate = useNavigate();
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [recentEvents, setRecentEvents] = useState<TaskEvent[]>([]);
  const [wsMembers, setWsMembers] = useState<WorkspaceMember[]>([]);

  useEffect(() => {
    if (!workspace || !user || !role) return;
    return subscribeToAccessibleProjects(workspace.id, user.uid, role, setProjects);
  }, [workspace?.id, user?.uid, role]);

  useEffect(() => {
    if (!workspace) return;
    const uid = user?.uid;
    if (!uid) return;
    return subscribeToWorkspaceEvents(workspace.id, 50, (events) => {
      setRecentEvents(events.filter((e) => e.userId === uid).slice(0, 10));
    });
  }, [workspace?.id, user?.uid]);

  useEffect(() => {
    if (!workspace) return;
    getWorkspaceMembers(workspace.id).then(setWsMembers);
  }, [workspace?.id]);

  useEffect(() => {
    if (!workspace || projects.length === 0) return;
    // Subscribe to tasks across all active projects
    const unsubs = projects.map((p) =>
      subscribeToTasks(workspace.id, p.id, (tasks) => {
        setAllTasks((prev) => {
          const others = prev.filter((t) => t.projectId !== p.id);
          return [...others, ...tasks];
        });
      })
    );
    return () => unsubs.forEach((u) => u());
  }, [workspace?.id, projects]);

  if (!workspace || !user) return null;

  const myTasks = allTasks.filter((t) => t.assigneeId === user.uid && t.status !== "done");
  const totalDone = allTasks.filter((t) => t.status === "done").length;
  const overdueTasks = myTasks.filter((t) => {
    const d = tsToDate(t.dueDate);
    return d && isPast(d);
  });

  // js-index-maps: project lookup map
  const projectMap = new Map(projects.map((p) => [p.id, p]));

  const memberNameMap = useMemo(() => {
    const m = new Map<string, string>();
    wsMembers.forEach((mem) => m.set(mem.userId, mem.profile?.name ?? "Unknown"));
    return m;
  }, [wsMembers]);

  const memberAvatarMap = useMemo(() => {
    const m = new Map<string, string | null>();
    wsMembers.forEach((mem) => m.set(mem.userId, mem.profile?.avatarUrl ?? null));
    return m;
  }, [wsMembers]);

  const taskTitleMap = useMemo(() => {
    const m = new Map<string, string>();
    allTasks.forEach((t) => m.set(t.id, t.title));
    return m;
  }, [allTasks]);

  function getInitials(name: string | null | undefined) {
    if (!name) return "?";
    return name.split(/\s/).map((s) => s[0]?.toUpperCase()).slice(0, 2).join("");
  }

  function describeEvent(ev: TaskEvent): string {
    const who = memberNameMap.get(ev.userId ?? "") ?? "Someone";
    const taskTitle = taskTitleMap.get(ev.taskId) ?? "a task";
    switch (ev.eventType) {
      case "created": return `${who} created "${taskTitle}"`;
      case "status_changed": return `${who} moved "${taskTitle}" to ${TASK_STATUS_LABELS[ev.newValue as TaskStatus] ?? ev.newValue}`;
      case "priority_changed": return `${who} set priority of "${taskTitle}" to ${TASK_PRIORITY_LABELS[ev.newValue as TaskPriority] ?? ev.newValue}`;
      case "commented": return `${who} commented on "${taskTitle}"`;
      default: return `${who} updated "${taskTitle}"`;
    }
  }

  return (
    <div className="relative min-h-screen bg-background">
    <MotionPage className="relative z-10 p-6 max-w-6xl mx-auto space-y-6 w-full">
      <div>
        <TextGenerateEffect words="Dashboard" className="text-2xl" duration={0.4} filter={false} />
        <p className="text-sm text-muted-foreground mt-0.5">Welcome back — here&apos;s what&apos;s happening</p>
      </div>

      <StaggerContainer className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: FolderKanban, label: "Total tasks", value: allTasks.length },
          { icon: CheckSquare, label: "Completed", value: totalDone },
          { icon: Clock, label: "My open tasks", value: myTasks.length },
          { icon: AlertCircle, label: "Overdue", value: overdueTasks.length, red: true },
        ].map(({ icon: Icon, label, value, red }) => (
          <StaggerItem key={label}>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Icon className={cn("h-4 w-4", red && value > 0 && "text-red-500")} />
                  <span className="text-xs font-medium">{label}</span>
                </div>
                <p className={cn("text-2xl font-bold", red && value > 0 && "text-red-500")}>{value}</p>
              </CardContent>
            </Card>
          </StaggerItem>
        ))}
      </StaggerContainer>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">My tasks</CardTitle></CardHeader>
          <CardContent className="p-0">
            {myTasks.length === 0 ? (
              <EmptyState icon={PartyPopper} title="You're all caught up!" description="No open tasks assigned to you" className="py-10" />
            ) : (
              <StaggerContainer className="divide-y">
                {myTasks.slice(0, 10).map((task) => {
                  const proj = projectMap.get(task.projectId);
                  const dueDate = tsToDate(task.dueDate);
                  const isOverdue = dueDate && isPast(dueDate);
                  const isDueToday = dueDate && isToday(dueDate);
                  return (
                    <StaggerItem key={task.id} className={cn(
                      "px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-muted/30 transition-colors",
                      isOverdue && "bg-destructive/5",
                    )}
                      onClick={() => proj && navigate(`/${workspace.slug}/projects/${task.projectId}/board`)}>
                      <span className={cn("h-2 w-2 rounded-full shrink-0", STATUS_DOT_COLORS[task.status as TaskStatus])} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{task.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">{proj?.name}</span>
                          <span className="text-[11px] text-muted-foreground">{TASK_STATUS_LABELS[task.status as TaskStatus]}</span>
                        </div>
                      </div>
                      <PriorityIcon priority={task.priority} className="h-3.5 w-3.5 shrink-0" />
                      {dueDate && (
                        <span className={cn("text-[11px] px-1.5 py-0.5 rounded shrink-0",
                          isOverdue ? "bg-destructive/10 text-destructive" : isDueToday ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" : "text-muted-foreground")}>
                          {format(dueDate, "MMM d")}{isOverdue && " (overdue)"}
                        </span>
                      )}
                    </StaggerItem>
                  );
                })}
              </StaggerContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Recent activity</CardTitle></CardHeader>
          <CardContent className="p-0">
            {recentEvents.length === 0 ? (
              <EmptyState icon={Activity} title="No activity yet" description="Your recent activity will appear here" className="py-10" />
            ) : (
              <div className="divide-y">
                {recentEvents.slice(0, 10).map((ev) => {
                  const proj = ev.projectId ? projectMap.get(ev.projectId) : null;
                  return (
                    <div key={ev.id} className="px-4 py-3 flex gap-3 items-start">
                      <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                        <AvatarImage src={memberAvatarMap.get(ev.userId ?? "") ?? undefined} />
                        <AvatarFallback className="text-xs">{getInitials(memberNameMap.get(ev.userId ?? ""))}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{describeEvent(ev)}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {proj && <span className="text-xs text-muted-foreground">{proj.name}</span>}
                          <span className="text-xs text-muted-foreground">{formatDistanceToNow(tsToDate(ev.createdAt) ?? new Date(), { addSuffix: true })}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MotionPage>
    <ShootingStars
      starColor="#a5b4fc"
      trailColor="#6366f1"
      minDelay={1500}
      maxDelay={4000}
    />
    <StarsBackground
      starDensity={0.00025}
      starColor={[160, 160, 190]}
    />
    </div>
  );
}
