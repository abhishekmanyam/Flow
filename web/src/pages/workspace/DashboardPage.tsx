import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { subscribeToTasks, subscribeToAccessibleProjects, subscribeToWorkspaceEvents, getWorkspaceMembers } from "@/lib/firestore";
import { FolderKanban, CheckSquare, Clock, AlertCircle, PartyPopper, Activity } from "lucide-react";
import PriorityIcon from "@/components/tasks/PriorityIcon";
import { TASK_STATUS_LABELS, TASK_PRIORITY_LABELS } from "@/lib/types";
import type { Task, Project, TaskEvent, TaskStatus, TaskPriority, WorkspaceMember } from "@/lib/types";
import { isPast } from "date-fns";
import { Layout, LayoutHeader, LayoutContent } from "@astryxdesign/core/Layout";
import { HStack } from "@astryxdesign/core/HStack";
import { VStack } from "@astryxdesign/core/VStack";
import { Grid } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { Card } from "@astryxdesign/core/Card";
import { List } from "@astryxdesign/core/List";
import { ListItem } from "@astryxdesign/core/List";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Badge } from "@astryxdesign/core/Badge";
import { Avatar } from "@astryxdesign/core/Avatar";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { Timestamp } from "@astryxdesign/core/Timestamp";

function tsToDate(ts: unknown): Date | null {
  if (!ts) return null;
  if (typeof (ts as { toDate?: () => Date }).toDate === "function") return (ts as { toDate: () => Date }).toDate();
  return new Date(ts as string);
}

const STATUS_DOT_VARIANT: Record<TaskStatus, "success" | "warning" | "error" | "accent" | "neutral"> = {
  backlog: "neutral",
  todo: "neutral",
  in_progress: "accent",
  in_review: "warning",
  done: "success",
};

export default function DashboardPage() {
  const { workspace, user, role } = useAuthStore();
  const navigate = useNavigate();
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [recentEvents, setRecentEvents] = useState<TaskEvent[]>([]);
  const [wsMembers, setWsMembers] = useState<WorkspaceMember[]>([]);
  const [projectsLoaded, setProjectsLoaded] = useState(false);

  useEffect(() => {
    if (!workspace || !user || !role) return;
    return subscribeToAccessibleProjects(workspace.id, user.uid, role, (p) => {
      setProjects(p);
      setProjectsLoaded(true);
    });
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

  // js-index-maps: project lookup map
  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

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

  if (!workspace || !user) return null;

  const myTasks = allTasks.filter((t) => t.assigneeId === user.uid && t.status !== "done");
  const totalDone = allTasks.filter((t) => t.status === "done").length;
  const overdueTasks = myTasks.filter((t) => {
    const d = tsToDate(t.dueDate);
    return d && isPast(d);
  });

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

  const kpis = [
    { icon: FolderKanban, label: "Total tasks", value: allTasks.length, alert: false },
    { icon: CheckSquare, label: "Completed", value: totalDone, alert: false },
    { icon: Clock, label: "My open tasks", value: myTasks.length, alert: false },
    { icon: AlertCircle, label: "Overdue", value: overdueTasks.length, alert: overdueTasks.length > 0 },
  ];

  return (
    <Layout
      header={
        <LayoutHeader hasDivider>
          <HStack justify="between" align="center" paddingInline={4} paddingBlock={3}>
            <VStack gap={0.5}>
              <Heading level={1}>Dashboard</Heading>
              <Text type="supporting">Welcome back — here&apos;s what&apos;s happening</Text>
            </VStack>
          </HStack>
        </LayoutHeader>
      }
    >
      <LayoutContent padding={4}>
        <VStack gap={6} maxWidth={1120}>
          <Grid columns={{ minWidth: 200, max: 4 }} gap={4}>
            {kpis.map(({ icon: Icon, label, value, alert }) => (
              <Card key={label} padding={4} variant={alert ? "red" : "default"}>
                <VStack gap={1}>
                  <HStack gap={2} align="center">
                    <Icon size={16} />
                    <Text type="supporting" weight="medium">{label}</Text>
                  </HStack>
                  <Heading level={2}>{value}</Heading>
                </VStack>
              </Card>
            ))}
          </Grid>

          <Grid columns={{ minWidth: 360, max: 2 }} gap={4}>
            <VStack gap={2}>
              <Heading level={3}>My tasks</Heading>
              {!projectsLoaded ? (
                <VStack gap={2}>
                  <Skeleton height={44} />
                  <Skeleton height={44} index={1} />
                  <Skeleton height={44} index={2} />
                </VStack>
              ) : myTasks.length === 0 ? (
                <EmptyState icon={<PartyPopper />} title="You're all caught up!" description="No open tasks assigned to you" isCompact />
              ) : (
                <List hasDividers density="compact">
                  {myTasks.slice(0, 10).map((task) => {
                    const proj = projectMap.get(task.projectId);
                    const dueDate = tsToDate(task.dueDate);
                    const isOverdue = dueDate && isPast(dueDate);
                    return (
                      <ListItem
                        key={task.id}
                        label={task.title}
                        description={`${proj?.name ?? ""} · ${TASK_STATUS_LABELS[task.status as TaskStatus]}`}
                        startContent={<StatusDot variant={STATUS_DOT_VARIANT[task.status as TaskStatus]} label={TASK_STATUS_LABELS[task.status as TaskStatus]} />}
                        endContent={
                          <HStack gap={2} align="center">
                            <PriorityIcon priority={task.priority} />
                            {dueDate && (isOverdue
                              ? <Badge variant="error" label="Overdue" />
                              : <Timestamp value={dueDate.toISOString()} format="date" />)}
                          </HStack>
                        }
                        onClick={() => proj && navigate(`/${workspace.slug}/projects/${task.projectId}/board`)}
                      />
                    );
                  })}
                </List>
              )}
            </VStack>

            <VStack gap={2}>
              <Heading level={3}>Recent activity</Heading>
              {recentEvents.length === 0 ? (
                <EmptyState icon={<Activity />} title="No activity yet" description="Your recent activity will appear here" isCompact />
              ) : (
                <List hasDividers density="compact">
                  {recentEvents.slice(0, 10).map((ev) => {
                    const proj = ev.projectId ? projectMap.get(ev.projectId) : null;
                    const created = tsToDate(ev.createdAt);
                    return (
                      <ListItem
                        key={ev.id}
                        label={describeEvent(ev)}
                        description={proj?.name ?? undefined}
                        startContent={<Avatar size="small" name={memberNameMap.get(ev.userId ?? "") ?? "?"} src={memberAvatarMap.get(ev.userId ?? "") ?? undefined} />}
                        endContent={created ? <Timestamp value={created.toISOString()} format="relative" /> : undefined}
                      />
                    );
                  })}
                </List>
              )}
            </VStack>
          </Grid>
        </VStack>
      </LayoutContent>
    </Layout>
  );
}
