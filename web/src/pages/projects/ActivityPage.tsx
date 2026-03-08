import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { useProjectAccess } from "@/hooks/useProjectAccess";
import { subscribeToProjectEvents, subscribeToTasks, getWorkspaceMembers } from "@/lib/firestore";
import ProjectHeader from "@/components/projects/ProjectHeader";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { MotionPage } from "@/components/ui/motion-page";
import { StaggerContainer, StaggerItem } from "@/components/ui/stagger";
import { EmptyState } from "@/components/ui/empty-state";
import { Activity } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { TASK_STATUS_LABELS, TASK_PRIORITY_LABELS } from "@/lib/types";
import type { Project, TaskEvent, TaskStatus, TaskPriority } from "@/lib/types";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

function tsToDate(ts: unknown): Date {
  if (!ts) return new Date();
  if (typeof (ts as { toDate?: () => Date }).toDate === "function") return (ts as { toDate: () => Date }).toDate();
  return new Date(ts as string);
}

function getInitials(name: string | null | undefined) {
  if (!name) return "?";
  return name.split(/\s/).map((s) => s[0]?.toUpperCase()).slice(0, 2).join("");
}

export default function ActivityPage() {
  const { slug, projectId } = useParams<{ slug: string; projectId: string }>();
  const { workspace } = useAuthStore();
  const { loading: accessLoading, hasAccess, canEdit, isProjectAdmin } = useProjectAccess(projectId);
  const [project, setProject] = useState<Project | null>(null);
  const [events, setEvents] = useState<TaskEvent[]>([]);
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

  // Subscribe to all project events via collectionGroup query
  useEffect(() => {
    if (!workspace || !projectId) return;
    return subscribeToProjectEvents(projectId, 50, setEvents);
  }, [workspace?.id, projectId]);

  if (accessLoading || !workspace || !project) return (
    <div className="p-6 space-y-4"><Skeleton className="h-8 w-48" />{[1,2,3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
  );

  if (!hasAccess) return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center space-y-2">
        <h2 className="text-lg font-semibold">Access Denied</h2>
        <p className="text-sm text-muted-foreground">You don&apos;t have access to this project.</p>
      </div>
    </div>
  );

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
    <MotionPage className="flex flex-col h-full">
      <ProjectHeader project={project} workspaceSlug={slug!} canEdit={canEdit} isProjectAdmin={isProjectAdmin} />
      <div className="flex-1 overflow-auto p-6 max-w-2xl">
        <h2 className="text-lg font-semibold mb-4">Project Activity</h2>
        {events.length === 0 ? (
          <EmptyState icon={Activity} title="No activity yet" description="Activity will appear here as your team works on tasks" />
        ) : (
          <StaggerContainer className="space-y-3">
            {events.map((ev) => (
              <StaggerItem key={ev.id} className="flex gap-3 items-start">
                <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                  <AvatarImage src={memberAvatarMap.get(ev.userId ?? "") ?? undefined} />
                  <AvatarFallback className="text-xs">{getInitials(memberNameMap.get(ev.userId ?? ""))}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{describeEvent(ev)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{formatDistanceToNow(tsToDate(ev.createdAt), { addSuffix: true })}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        )}
      </div>
    </MotionPage>
  );
}
