import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { useProjectAccess } from "@/hooks/useProjectAccess";
import { useTaskFilters } from "@/hooks/useTaskFilters";
import { MotionPage } from "@/components/ui/motion-page";
import { subscribeToTasks, subscribeToLabels, subscribeToEpics, subscribeToSprints, getWorkspaceMembers, getProjectMembers, projectDoc } from "@/lib/firestore";
import { getDoc } from "firebase/firestore";
import ProjectHeader from "@/components/projects/ProjectHeader";
import KanbanBoard from "@/components/board/KanbanBoard";
import ListView from "@/components/board/ListView";
import TimelineView from "@/components/board/TimelineView";
import ViewToggle from "@/components/board/ViewToggle";
import TaskFilterBar from "@/components/filters/TaskFilterBar";
import BulkActionBar from "@/components/tasks/BulkActionBar";
import TaskSearch from "@/components/search/TaskSearch";
import { buildTaskIdentifiers } from "@/lib/task-utils";
import { useBoardPresence } from "@/hooks/useBoardPresence";
import TaskDetailSheet from "@/components/tasks/TaskDetailSheet";
import CreateTaskDialog from "@/components/tasks/CreateTaskDialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { ViewMode } from "@/components/board/ViewToggle";
import type { Task, Project, WorkspaceMember, Label, Epic, Sprint, TaskStatus } from "@/lib/types";

function getStoredView(): ViewMode {
  return (localStorage.getItem("board-view") as ViewMode) ?? "board";
}

export default function BoardPage() {
  const { slug, projectId } = useParams<{ slug: string; projectId: string }>();
  const { workspace, role: wsRole, user } = useAuthStore();
  const { loading: accessLoading, hasAccess, canEdit, isProjectAdmin } = useProjectAccess(projectId);
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [epics, setEpics] = useState<Epic[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [view, setView] = useState<ViewMode>(getStoredView);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [createStatus, setCreateStatus] = useState<TaskStatus | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  const presenceUsers = useBoardPresence(projectId);
  const { filters, filteredTasks, hasActiveFilters, updateFilter, clearFilters } = useTaskFilters(tasks);
  const taskIdentifiers = useMemo(() => project ? buildTaskIdentifiers(project, tasks) : new Map<string, string>(), [project, tasks]);

  const handleViewChange = (v: ViewMode) => {
    setView(v);
    localStorage.setItem("board-view", v);
    setSelectedIds(new Set());
  };

  useEffect(() => {
    if (!workspace || !projectId || accessLoading || !hasAccess) return;
    Promise.all([
      getDoc(projectDoc(workspace.id, projectId)),
      wsRole === "admin"
        ? getWorkspaceMembers(workspace.id)
        : getProjectMembers(workspace.id, projectId).then((pm) =>
            pm.map((m) => ({ userId: m.userId, role: m.role, joinedAt: m.addedAt, profile: m.profile }) as unknown as WorkspaceMember)
          ),
    ]).then(([projSnap, mems]) => {
      if (projSnap.exists()) setProject({ id: projSnap.id, ...projSnap.data() } as Project);
      setMembers(mems);
    });
    const unsubTasks = subscribeToTasks(workspace.id, projectId, setTasks);
    const unsubLabels = subscribeToLabels(workspace.id, projectId, setLabels);
    const unsubEpics = subscribeToEpics(workspace.id, projectId, setEpics);
    const unsubSprints = subscribeToSprints(workspace.id, projectId, setSprints);
    return () => { unsubTasks(); unsubLabels(); unsubEpics(); unsubSprints(); };
  }, [workspace?.id, projectId, accessLoading, hasAccess]);

  const handleTaskUpdated = useCallback((id: string, changes: Partial<Task>) => {
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, ...changes } : t));
  }, []);

  const handleTaskCreated = (task: Task) => {
    setTasks((prev) => [...prev, task]);
    setCreateStatus(null);
  };

  const handleBulkUpdated = useCallback((ids: string[], changes: Partial<Task>) => {
    setTasks((prev) => prev.map((t) => ids.includes(t.id) ? { ...t, ...changes } : t));
  }, []);

  const toggleTaskSelection = useCallback((taskId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === filteredTasks.length) return new Set();
      return new Set(filteredTasks.map((t) => t.id));
    });
  }, [filteredTasks]);

  if (accessLoading || !workspace || !user) return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-8 w-48" />
      <div className="flex gap-3">
        {[1,2,3,4,5].map((i) => <Skeleton key={i} className="h-64 w-72" />)}
      </div>
    </div>
  );

  if (!hasAccess) return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center space-y-2">
        <h2 className="text-lg font-semibold">Access Denied</h2>
        <p className="text-sm text-muted-foreground">You don&apos;t have access to this project.</p>
      </div>
    </div>
  );

  if (!project) return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-8 w-48" />
      <div className="flex gap-3">
        {[1,2,3,4,5].map((i) => <Skeleton key={i} className="h-64 w-72" />)}
      </div>
    </div>
  );

  return (
    <MotionPage className="flex flex-col h-full">
      <ProjectHeader project={project} workspaceSlug={slug!} canEdit={canEdit} isProjectAdmin={isProjectAdmin} presenceUsers={presenceUsers} currentUserId={user.uid} />

      {view === "board" ? (
        <KanbanBoard
          project={project}
          tasks={filteredTasks}
          members={members}
          labels={labels}
          epics={epics}
          sprints={sprints}
          currentUserId={user.uid}
          canEdit={canEdit}
          isProjectAdmin={isProjectAdmin}
          workspaceId={workspace.id}
          viewToggle={
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowFilters((p) => !p)}>
                <Search className="mr-1 h-3 w-3" />{showFilters ? "Hide filters" : "Filters"}{hasActiveFilters && " *"}
              </Button>
              <ViewToggle value={view} onChange={handleViewChange} />
            </div>
          }
          filterBar={showFilters ? (
            <TaskFilterBar
              filters={filters}
              hasActiveFilters={hasActiveFilters}
              members={members}
              labels={labels}
              epics={epics}
              sprints={sprints}
              onUpdateFilter={updateFilter}
              onClear={clearFilters}
            />
          ) : undefined}
        />
      ) : (
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex items-center gap-2 px-6 py-3 border-b">
            {view === "list" && canEdit && (
              <Button size="sm" onClick={() => setCreateStatus("backlog")}>
                <Plus className="mr-1.5 h-4 w-4" />Add task
              </Button>
            )}
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowFilters((p) => !p)}>
              <Search className="mr-1 h-3 w-3" />{showFilters ? "Hide filters" : "Filters"}{hasActiveFilters && " *"}
            </Button>
            <div className="ml-auto">
              <ViewToggle value={view} onChange={handleViewChange} />
            </div>
          </div>
          {showFilters && (
            <div className="px-6 py-2 border-b">
              <TaskFilterBar
                filters={filters}
                hasActiveFilters={hasActiveFilters}
                members={members}
                labels={labels}
                epics={epics}
                sprints={sprints}
                onUpdateFilter={updateFilter}
                onClear={clearFilters}
              />
            </div>
          )}
          {view === "list" && canEdit && (
            <div className="px-6 py-1.5 border-b flex items-center gap-2">
              <Checkbox
                checked={selectedIds.size > 0 && selectedIds.size === filteredTasks.length}
                onCheckedChange={toggleSelectAll}
              />
              <span className="text-xs text-muted-foreground">
                {selectedIds.size > 0 ? `${selectedIds.size} selected` : "Select all"}
              </span>
            </div>
          )}
          {view === "list" ? (
            <div className="flex-1 overflow-auto px-6">
              <ListView
                tasks={filteredTasks}
                members={members}
                labels={labels}
                epics={epics}
                sprints={sprints}
                taskIdentifiers={taskIdentifiers}
                onSelectTask={setSelectedTaskId}
                selectedIds={selectedIds}
                onToggleSelect={canEdit ? toggleTaskSelection : undefined}
              />
            </div>
          ) : (
            <div className="flex-1 overflow-hidden">
              <TimelineView
                tasks={filteredTasks}
                members={members}
                labels={labels}
                epics={epics}
                sprints={sprints}
                taskIdentifiers={taskIdentifiers}
                onSelectTask={setSelectedTaskId}
              />
            </div>
          )}
        </div>
      )}

      {(view === "list" || view === "timeline") && (
        <>
          {createStatus && (
            <CreateTaskDialog open defaultStatus={createStatus} project={project}
              members={members} labels={labels} epics={epics} sprints={sprints} currentUserId={user.uid} workspaceId={workspace.id}
              onCreated={handleTaskCreated} onClose={() => setCreateStatus(null)} />
          )}
          <TaskDetailSheet taskId={selectedTaskId} project={project} workspaceId={workspace.id}
            members={members} labels={labels} epics={epics} sprints={sprints} currentUserId={user.uid} canEdit={canEdit}
            isProjectAdmin={isProjectAdmin} onClose={() => setSelectedTaskId(null)} onUpdated={handleTaskUpdated} />
        </>
      )}

      {canEdit && (
        <BulkActionBar
          selectedIds={selectedIds}
          members={members}
          workspaceId={workspace.id}
          projectId={projectId!}
          isProjectAdmin={isProjectAdmin}
          onClearSelection={() => setSelectedIds(new Set())}
          onTasksUpdated={handleBulkUpdated}
        />
      )}

      <TaskSearch tasks={tasks} onSelect={setSelectedTaskId} />
    </MotionPage>
  );
}
