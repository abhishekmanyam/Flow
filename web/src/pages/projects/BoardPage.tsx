import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { useProjectAccess } from "@/hooks/useProjectAccess";
import { useTaskFilters } from "@/hooks/useTaskFilters";
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
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { StackItem } from "@astryxdesign/core/Layout";
import { Divider } from "@astryxdesign/core/Divider";
import { Button } from "@astryxdesign/core/Button";
import { Badge } from "@astryxdesign/core/Badge";
import { Icon } from "@astryxdesign/core/Icon";
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { Text } from "@astryxdesign/core/Text";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Plus, Funnel, Lock } from "lucide-react";
import type { ViewMode } from "@/components/board/ViewToggle";
import type { Task, Project, WorkspaceMember, Label, Epic, Sprint, TaskStatus } from "@/lib/types";

function getStoredView(): ViewMode {
  return (localStorage.getItem("board-view") as ViewMode) ?? "board";
}

function BoardSkeleton() {
  return (
    <VStack gap={4} padding={6} height="100%">
      <Skeleton height={32} width={192} />
      <HStack gap={3}>
        {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} height={256} width={288} index={i} />)}
      </HStack>
    </VStack>
  );
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

  if (accessLoading || !workspace || !user) return <BoardSkeleton />;

  if (!hasAccess) return (
    <VStack height="100%" hAlign="center" vAlign="center">
      <EmptyState
        icon={<Icon icon={Lock} size="lg" color="secondary" />}
        title="Access denied"
        description="You don't have access to this project."
      />
    </VStack>
  );

  if (!project) return <BoardSkeleton />;

  const filtersButton = (
    <Button
      label={showFilters ? "Hide filters" : "Filters"}
      variant="ghost"
      size="sm"
      icon={<Icon icon={Funnel} size="sm" />}
      endContent={hasActiveFilters ? <Badge label="Active" variant="neutral" /> : undefined}
      onClick={() => setShowFilters((p) => !p)}
    />
  );

  const filterBarNode = (
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
  );

  const selectAllValue: boolean | "indeterminate" =
    filteredTasks.length > 0 && selectedIds.size === filteredTasks.length
      ? true
      : selectedIds.size > 0
        ? "indeterminate"
        : false;

  return (
    <VStack height="100%">
      <ProjectHeader project={project} workspaceSlug={slug!} canEdit={canEdit} isProjectAdmin={isProjectAdmin} presenceUsers={presenceUsers} currentUserId={user.uid} />

      <StackItem size="fill">
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
              <HStack gap={2} vAlign="center">
                {filtersButton}
                <ViewToggle value={view} onChange={handleViewChange} />
              </HStack>
            }
            filterBar={showFilters ? filterBarNode : undefined}
          />
        ) : (
          <VStack height="100%">
            <HStack gap={2} vAlign="center" paddingInline={6} paddingBlock={3}>
              {view === "list" && canEdit && (
                <Button
                  label="Add task"
                  variant="primary"
                  size="sm"
                  icon={<Icon icon={Plus} size="sm" />}
                  onClick={() => setCreateStatus("backlog")}
                />
              )}
              {filtersButton}
              <StackItem size="fill" />
              <ViewToggle value={view} onChange={handleViewChange} />
            </HStack>
            <Divider />
            {showFilters && (
              <>
                <VStack paddingInline={6} paddingBlock={2}>{filterBarNode}</VStack>
                <Divider />
              </>
            )}
            {view === "list" && canEdit && (
              <>
                <HStack gap={2} vAlign="center" paddingInline={6} paddingBlock={1.5}>
                  <CheckboxInput
                    label="Select all tasks"
                    isLabelHidden
                    size="sm"
                    value={selectAllValue}
                    onChange={toggleSelectAll}
                  />
                  <Text type="supporting" color="secondary">
                    {selectedIds.size > 0 ? `${selectedIds.size} selected` : "Select all"}
                  </Text>
                </HStack>
                <Divider />
              </>
            )}
            <StackItem size="fill">
              {view === "list" ? (
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
              ) : (
                <TimelineView
                  tasks={filteredTasks}
                  members={members}
                  labels={labels}
                  epics={epics}
                  sprints={sprints}
                  taskIdentifiers={taskIdentifiers}
                  onSelectTask={setSelectedTaskId}
                />
              )}
            </StackItem>
          </VStack>
        )}
      </StackItem>

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
    </VStack>
  );
}
