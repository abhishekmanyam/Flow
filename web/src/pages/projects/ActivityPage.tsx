import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { useProjectAccess } from "@/hooks/useProjectAccess";
import { subscribeToProjectEvents, subscribeToTasks, getWorkspaceMembers } from "@/lib/firestore";
import ProjectHeader from "@/components/projects/ProjectHeader";
import { Layout, LayoutContent } from "@astryxdesign/core/Layout";
import { VStack } from "@astryxdesign/core/VStack";
import { List, ListItem } from "@astryxdesign/core/List";
import { Avatar } from "@astryxdesign/core/Avatar";
import { Text } from "@astryxdesign/core/Text";
import { Timestamp } from "@astryxdesign/core/Timestamp";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { Banner } from "@astryxdesign/core/Banner";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Activity } from "lucide-react";
import { isToday, isYesterday, format } from "date-fns";
import { TASK_STATUS_LABELS, TASK_PRIORITY_LABELS } from "@/lib/types";
import type { Project, TaskEvent, TaskStatus, TaskPriority } from "@/lib/types";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

function tsToDate(ts: unknown): Date {
  if (!ts) return new Date();
  if (typeof (ts as { toDate?: () => Date }).toDate === "function") return (ts as { toDate: () => Date }).toDate();
  return new Date(ts as string);
}

function dayLabel(d: Date): string {
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "MMMM d, yyyy");
}

export default function ActivityPage() {
  const { slug, projectId } = useParams<{ slug: string; projectId: string }>();
  const { workspace } = useAuthStore();
  const { loading: accessLoading, hasAccess, canEdit, isProjectAdmin } = useProjectAccess(projectId);
  const [project, setProject] = useState<Project | null>(null);
  const [events, setEvents] = useState<TaskEvent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [memberNameMap, setMemberNameMap] = useState<Map<string, string>>(new Map());
  const [memberAvatarMap, setMemberAvatarMap] = useState<Map<string, string | null>>(new Map());
  const [taskTitleMap, setTaskTitleMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!workspace || !projectId) return;
    getDoc(doc(db, "workspaces", workspace.id, "projects", projectId)).then((snap) => {
      if (snap.exists()) setProject({ id: snap.id, ...snap.data() } as Project);
    });
    getWorkspaceMembers(workspace.id).then((members) => {
      const nameMap = new Map<string, string>();
      const avatarUrlMap = new Map<string, string | null>();
      members.forEach((m) => {
        nameMap.set(m.userId, m.profile?.name ?? "Unknown");
        avatarUrlMap.set(m.userId, m.profile?.avatarUrl ?? null);
      });
      setMemberNameMap(nameMap);
      setMemberAvatarMap(avatarUrlMap);
    });
    return subscribeToTasks(workspace.id, projectId, (t) => {
      const titleMap = new Map<string, string>();
      t.forEach((task) => titleMap.set(task.id, task.title));
      setTaskTitleMap(titleMap);
    });
  }, [workspace?.id, projectId]);

  useEffect(() => {
    if (!workspace || !projectId) return;
    return subscribeToProjectEvents(projectId, 50, (list) => {
      setEvents(list);
      setLoaded(true);
    });
  }, [workspace?.id, projectId]);

  if (accessLoading || !workspace || !project) {
    return (
      <Layout>
        <LayoutContent padding={4}>
          <VStack gap={3}>
            <Skeleton height={28} width={200} />
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} height={48} />)}
          </VStack>
        </LayoutContent>
      </Layout>
    );
  }

  if (!hasAccess) {
    return (
      <Layout>
        <LayoutContent padding={4}>
          <Banner status="error" title="Access denied" description="You don't have access to this project." />
        </LayoutContent>
      </Layout>
    );
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

  // Group events into consecutive day buckets (events arrive sorted newest-first).
  const groups: { label: string; items: TaskEvent[] }[] = [];
  for (const ev of events) {
    const label = dayLabel(tsToDate(ev.createdAt));
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(ev);
    else groups.push({ label, items: [ev] });
  }

  return (
    <Layout
      header={<ProjectHeader project={project} workspaceSlug={slug!} canEdit={canEdit} isProjectAdmin={isProjectAdmin} />}
      content={
        <LayoutContent padding={0}>
          {events.length === 0 && loaded ? (
            <EmptyState
              icon={<Activity size={28} />}
              title="No activity yet"
              description="Activity will appear here as your team works on tasks"
            />
          ) : (
            <VStack gap={0} maxWidth={720}>
              {groups.map((group) => (
                <List
                  key={group.label}
                  hasDividers
                  header={<Text type="label" color="secondary">{group.label}</Text>}
                >
                  {group.items.map((ev) => (
                    <ListItem
                      key={ev.id}
                      label={describeEvent(ev)}
                      startContent={
                        <Avatar
                          size="small"
                          src={memberAvatarMap.get(ev.userId ?? "") ?? undefined}
                          name={memberNameMap.get(ev.userId ?? "") ?? "Unknown"}
                        />
                      }
                      endContent={<Timestamp value={tsToDate(ev.createdAt).toISOString()} format="relative" type="supporting" />}
                    />
                  ))}
                </List>
              ))}
            </VStack>
          )}
        </LayoutContent>
      }
    />
  );
}
