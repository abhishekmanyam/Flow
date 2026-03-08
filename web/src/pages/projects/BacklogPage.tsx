import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { useProjectAccess } from "@/hooks/useProjectAccess";
import { MotionPage } from "@/components/ui/motion-page";
import {
  subscribeToTasks, subscribeToSprints, subscribeToLabels, subscribeToEpics,
  getWorkspaceMembers, getProjectMembers, projectDoc, taskDoc,
  updateTask, duplicateTask, softDeleteTask, startSprint as startSprintFn,
} from "@/lib/firestore";
import { getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { parseLocalDate } from "@/lib/date-utils";
import {
  DndContext, DragOverlay,
  PointerSensor, useSensor, useSensors, closestCenter,
} from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import ProjectHeader from "@/components/projects/ProjectHeader";
import SprintHeader from "@/components/sprints/SprintHeader";
import CreateSprintDialog from "@/components/sprints/CreateSprintDialog";
import CompleteSprintDialog from "@/components/sprints/CompleteSprintDialog";
import TaskDetailSheet from "@/components/tasks/TaskDetailSheet";
import CreateTaskDialog from "@/components/tasks/CreateTaskDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format, isPast, isToday } from "date-fns";
import { EmptyState } from "@/components/ui/empty-state";
import { Plus, ChevronRight, Play, CheckCircle2, MoreHorizontal, Trash2, Inbox, Copy, GripVertical, Pencil } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import PriorityIcon from "@/components/tasks/PriorityIcon";
import EpicBadge from "@/components/epics/EpicBadge";
import { buildTaskIdentifiers } from "@/lib/task-utils";
import { STATUS_DOT_COLORS } from "@/lib/types";
import type { Task, Project, WorkspaceMember, Label, Epic, Sprint, TaskStatus } from "@/lib/types";

export default function BacklogPage() {
  const { slug, projectId } = useParams<{ slug: string; projectId: string }>();
  const { workspace, role: wsRole, user } = useAuthStore();
  const { loading: accessLoading, hasAccess, canEdit, isProjectAdmin } = useProjectAccess(projectId);
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [epics, setEpics] = useState<Epic[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [createStatus, setCreateStatus] = useState<{ status: TaskStatus; sprintId: string | null } | null>(null);
  const [showCreateSprint, setShowCreateSprint] = useState(false);
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null);
  const [completingSprint, setCompletingSprint] = useState<Sprint | null>(null);
  const [startingSprintId, setStartingSprintId] = useState<string | null>(null);
  const [sprintDateInputs, setSprintDateInputs] = useState<{ startDate: string; endDate: string }>({ startDate: "", endDate: "" });
  const [collapsedSprints, setCollapsedSprints] = useState<Set<string>>(new Set());
  const [activeDragTask, setActiveDragTask] = useState<Task | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

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
    const unsubSprints = subscribeToSprints(workspace.id, projectId, setSprints);
    const unsubLabels = subscribeToLabels(workspace.id, projectId, setLabels);
    const unsubEpics = subscribeToEpics(workspace.id, projectId, setEpics);
    return () => { unsubTasks(); unsubSprints(); unsubLabels(); unsubEpics(); };
  }, [workspace?.id, projectId, accessLoading, hasAccess]);

  const taskIdentifiers = useMemo(() => project ? buildTaskIdentifiers(project, tasks) : new Map<string, string>(), [project, tasks]);

  const epicMap = useMemo(() => {
    const m = new Map<string, Epic>();
    epics.forEach((e) => m.set(e.id, e));
    return m;
  }, [epics]);

  const activeSprint = useMemo(() => sprints.find((s) => s.status === "active") ?? null, [sprints]);
  const planningSprints = useMemo(() => sprints.filter((s) => s.status === "planning"), [sprints]);
  const backlogTasks = useMemo(() => tasks.filter((t) => !t.sprintId && t.deletedAt === null), [tasks]);

  const tasksBySprint = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      if (!task.sprintId || task.deletedAt !== null) continue;
      const existing = map.get(task.sprintId) ?? [];
      existing.push(task);
      map.set(task.sprintId, existing);
    }
    return map;
  }, [tasks]);

  const handleTaskUpdated = useCallback((id: string, changes: Partial<Task>) => {
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, ...changes } : t));
  }, []);

  const handleDuplicate = async (task: Task) => {
    if (!workspace || !projectId || !user) return;
    try {
      const dup = await duplicateTask(workspace.id, projectId, task, user.uid);
      setTasks((prev) => [...prev, dup]);
      toast.success("Task duplicated");
    } catch {
      toast.error("Failed to duplicate task");
    }
  };

  const handleSoftDelete = async (taskId: string) => {
    if (!workspace || !projectId) return;
    try {
      await softDeleteTask(workspace.id, projectId, taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      toast.success("Task deleted");
    } catch {
      toast.error("Failed to delete task");
    }
  };

  const handleTaskCreated = (task: Task) => {
    setTasks((prev) => [...prev, task]);
    setCreateStatus(null);
  };

  const moveTaskToSprint = async (taskId: string, sprintId: string | null) => {
    if (!workspace || !projectId || !user) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    try {
      const actorName = user.displayName ?? "Someone";
      await updateTask(workspace.id, projectId, taskId, { sprintId }, user.uid, task, { actorName });
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, sprintId } : t));
    } catch {
      toast.error("Failed to move task");
    }
  };

  const handleStartSprint = async (sprintId: string) => {
    if (!workspace || !projectId) return;
    if (!sprintDateInputs.startDate || !sprintDateInputs.endDate) {
      toast.error("Please set start and end dates");
      return;
    }
    try {
      await startSprintFn(workspace.id, projectId, sprintId, parseLocalDate(sprintDateInputs.startDate), parseLocalDate(sprintDateInputs.endDate));
      toast.success("Sprint started");
      setStartingSprintId(null);
      setSprintDateInputs({ startDate: "", endDate: "" });
    } catch {
      toast.error("Failed to start sprint");
    }
  };

  const handleDeleteSprint = async (sprint: Sprint) => {
    if (!workspace || !projectId) return;
    const sprintTasks = tasksBySprint.get(sprint.id) ?? [];
    // Move tasks to backlog before deleting
    try {
      const actorName = user!.displayName ?? "Someone";
      for (const task of sprintTasks) {
        await updateTask(workspace.id, projectId, task.id, { sprintId: null }, user!.uid, task, { actorName });
      }
      const { deleteDoc } = await import("firebase/firestore");
      const { sprintDoc } = await import("@/lib/firestore");
      await deleteDoc(sprintDoc(workspace.id, projectId, sprint.id));
      toast.success("Sprint deleted");
    } catch {
      toast.error("Failed to delete sprint");
    }
  };

  const toggleCollapse = (sprintId: string) => {
    setCollapsedSprints((prev) => {
      const next = new Set(prev);
      if (next.has(sprintId)) next.delete(sprintId);
      else next.add(sprintId);
      return next;
    });
  };

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveDragTask(tasks.find((t) => t.id === active.id) ?? null);
  };

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    setActiveDragTask(null);
    if (!over || active.id === over.id || !workspace || !projectId) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Determine which list the active task belongs to
    const activeTask = tasks.find((t) => t.id === activeId);
    const overTask = tasks.find((t) => t.id === overId);
    if (!activeTask || !overTask) return;

    // Only reorder within the same section (same sprintId)
    if (activeTask.sprintId !== overTask.sprintId) return;

    const sectionTasks = (activeTask.sprintId
      ? (tasksBySprint.get(activeTask.sprintId) ?? [])
      : backlogTasks
    ).sort((a, b) => a.position - b.position);

    const oldIdx = sectionTasks.findIndex((t) => t.id === activeId);
    const newIdx = sectionTasks.findIndex((t) => t.id === overId);
    if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return;

    const reordered = arrayMove(sectionTasks, oldIdx, newIdx);

    // Optimistic update
    const updatedPositions = reordered.map((t, i) => ({ ...t, position: i }));
    setTasks((prev) => {
      const otherTasks = prev.filter((t) => t.sprintId !== activeTask.sprintId || (activeTask.sprintId === null && t.sprintId !== null));
      return [...otherTasks, ...updatedPositions];
    });

    // Persist
    await Promise.all(
      updatedPositions.map((t, i) =>
        updateDoc(taskDoc(workspace.id, projectId, t.id), { position: i, updatedAt: serverTimestamp() })
      )
    );
  };

  if (accessLoading || !workspace || !user) return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
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
      <Skeleton className="h-64 w-full" />
    </div>
  );

  const memberMap = new Map<string, string>();
  const memberAvatarMap = new Map<string, string | undefined>();
  members.forEach((m) => {
    memberMap.set(m.userId, m.profile?.name ?? "Unknown");
    memberAvatarMap.set(m.userId, m.profile?.avatarUrl ?? undefined);
  });

  const getInitials = (name: string) => name.split(/\s/).map((s) => s[0]?.toUpperCase()).slice(0, 2).join("");

  const tsToDate = (ts: unknown): Date | null => {
    if (!ts) return null;
    if (typeof (ts as { toDate?: () => Date }).toDate === "function") return (ts as { toDate: () => Date }).toDate();
    return new Date(ts as string);
  };

  const renderTaskRowContent = (task: Task, currentSprintId: string | null, dragHandleProps?: Record<string, unknown>) => {
    const dueDate = tsToDate(task.dueDate);
    const isOverdue = dueDate && isPast(dueDate) && task.status !== "done";
    const isDueToday = dueDate && isToday(dueDate);
    const assigneeName = task.assigneeId ? memberMap.get(task.assigneeId) : null;
    const assigneeAvatar = task.assigneeId ? memberAvatarMap.get(task.assigneeId) : undefined;
    const epic = task.epicId ? epicMap.get(task.epicId) : null;
    const identifier = taskIdentifiers.get(task.id);

    return (
      <>
        {canEdit && dragHandleProps && (
          <button className="shrink-0 cursor-grab active:cursor-grabbing touch-none" {...dragHandleProps} onClick={(e) => e.stopPropagation()}>
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
        <span className={cn("h-2 w-2 rounded-full shrink-0", STATUS_DOT_COLORS[task.status])} />
        {identifier && (
          <span className="font-mono text-[11px] text-muted-foreground shrink-0">{identifier}</span>
        )}
        <span className="text-sm font-medium truncate flex-1">{task.title}</span>
        {epic && (
          <EpicBadge title={epic.title} color={epic.color} className="text-[10px] px-1.5 py-0 shrink-0 max-w-[100px] truncate" />
        )}
        {dueDate && (
          <span className={cn("text-[11px] px-1.5 py-0.5 rounded shrink-0",
            isOverdue ? "bg-destructive/10 text-destructive" : isDueToday ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" : "text-muted-foreground")}>
            {format(dueDate, "MMM d")}
          </span>
        )}
        {task.storyPoints != null && task.storyPoints > 0 && (
          <span className="font-mono text-[11px] text-muted-foreground shrink-0">{task.storyPoints}SP</span>
        )}
        <PriorityIcon priority={task.priority} className="h-3.5 w-3.5 shrink-0" />
        {assigneeName ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Avatar className="h-5 w-5 shrink-0">
                <AvatarImage src={assigneeAvatar} />
                <AvatarFallback className="text-[9px]">{getInitials(assigneeName)}</AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent side="top"><p className="text-xs">{assigneeName}</p></TooltipContent>
          </Tooltip>
        ) : null}
        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              {activeSprint && currentSprintId !== activeSprint.id && (
                <DropdownMenuItem onClick={() => moveTaskToSprint(task.id, activeSprint.id)}>
                  Move to {activeSprint.name}
                </DropdownMenuItem>
              )}
              {planningSprints.filter((s) => s.id !== currentSprintId).map((s) => (
                <DropdownMenuItem key={s.id} onClick={() => moveTaskToSprint(task.id, s.id)}>
                  Move to {s.name}
                </DropdownMenuItem>
              ))}
              {currentSprintId && (
                <DropdownMenuItem onClick={() => moveTaskToSprint(task.id, null)}>
                  Move to Backlog
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => handleDuplicate(task)}>
                <Copy className="mr-2 h-3.5 w-3.5" />Duplicate
              </DropdownMenuItem>
              {isProjectAdmin && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleSoftDelete(task.id)}>
                    <Trash2 className="mr-2 h-3.5 w-3.5" />Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </>
    );
  };

  const SortableTaskRow = ({ task, currentSprintId }: { task: Task; currentSprintId: string | null }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
    const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
    const dueDate = tsToDate(task.dueDate);
    const isOverdue = dueDate && isPast(dueDate) && task.status !== "done";

    return (
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        className={cn(
          "flex items-center gap-2.5 px-3 py-2 border rounded-md hover:bg-accent/50 cursor-pointer transition-colors",
          isOverdue && "border-destructive/30 bg-destructive/5",
        )}
        onClick={() => setSelectedTaskId(task.id)}
      >
        {renderTaskRowContent(task, currentSprintId, listeners)}
      </div>
    );
  };

  const renderSprintSection = (sprint: Sprint) => {
    const sprintTasks = tasksBySprint.get(sprint.id) ?? [];
    const isCollapsed = collapsedSprints.has(sprint.id);
    const isStarting = startingSprintId === sprint.id;

    return (
      <Collapsible key={sprint.id} open={!isCollapsed} onOpenChange={() => toggleCollapse(sprint.id)}>
        <div className="border rounded-lg">
          <div className="flex items-start gap-3 p-4">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 mt-0.5">
                <ChevronRight className={cn("h-4 w-4 transition-transform", !isCollapsed && "rotate-90")} />
              </Button>
            </CollapsibleTrigger>
            <div className="flex-1 min-w-0">
              <SprintHeader sprint={sprint} tasks={sprintTasks} />
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {isProjectAdmin && sprint.status === "planning" && !activeSprint && (
                <Button size="sm" variant="outline" onClick={() => {
                  setStartingSprintId(isStarting ? null : sprint.id);
                  if (!isStarting) {
                    const today = new Date();
                    const twoWeeks = new Date(today);
                    twoWeeks.setDate(twoWeeks.getDate() + 14);
                    setSprintDateInputs({
                      startDate: today.toISOString().split("T")[0],
                      endDate: twoWeeks.toISOString().split("T")[0],
                    });
                  }
                }}>
                  <Play className="mr-1 h-3.5 w-3.5" />Start
                </Button>
              )}
              {isProjectAdmin && sprint.status === "active" && (
                <Button size="sm" variant="outline" onClick={() => setCompletingSprint(sprint)}>
                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" />Complete
                </Button>
              )}
              {canEdit && (
                <Button size="sm" variant="ghost" onClick={() => setCreateStatus({ status: "todo", sprintId: sprint.id })}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              )}
              {isProjectAdmin && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setEditingSprint(sprint)}>
                      <Pencil className="mr-2 h-3.5 w-3.5" />Edit sprint
                    </DropdownMenuItem>
                    {sprint.status === "planning" && (
                      <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteSprint(sprint)}>
                        <Trash2 className="mr-2 h-3.5 w-3.5" />Delete sprint
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
          {isStarting && (
            <div className="px-4 pb-3 flex items-end gap-3 border-t pt-3 mx-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Start date</label>
                <input
                  type="date"
                  className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                  value={sprintDateInputs.startDate}
                  onChange={(e) => setSprintDateInputs((p) => ({ ...p, startDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">End date</label>
                <input
                  type="date"
                  className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                  value={sprintDateInputs.endDate}
                  onChange={(e) => setSprintDateInputs((p) => ({ ...p, endDate: e.target.value }))}
                />
              </div>
              <Button size="sm" onClick={() => handleStartSprint(sprint.id)}>
                Start sprint
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setStartingSprintId(null)}>
                Cancel
              </Button>
            </div>
          )}
          <CollapsibleContent>
            <div className="px-4 pb-4 space-y-1">
              {sprintTasks.length === 0 ? (
                <EmptyState icon={Inbox} title="Sprint is empty" description="Add tasks from the backlog or create new ones" className="py-6" />
              ) : (
                <SortableContext items={sprintTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-1">
                    {sprintTasks.map((task) => (
                      <SortableTaskRow key={task.id} task={task} currentSprintId={sprint.id} />
                    ))}
                  </div>
                </SortableContext>
              )}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    );
  };

  return (
    <MotionPage className="flex flex-col h-full">
      <ProjectHeader project={project} workspaceSlug={slug!} canEdit={canEdit} isProjectAdmin={isProjectAdmin} />

      <DndContext sensors={canEdit ? sensors : undefined} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex-1 overflow-auto p-6 space-y-6">
          {/* Active Sprint */}
          {activeSprint && renderSprintSection(activeSprint)}

          {/* Planning Sprints */}
          {planningSprints.map((sprint) => renderSprintSection(sprint))}

          {/* Create Sprint */}
          {isProjectAdmin && (
            <Button variant="outline" size="sm" onClick={() => setShowCreateSprint(true)}>
              <Plus className="mr-1.5 h-4 w-4" />Create sprint
            </Button>
          )}

          {/* Backlog */}
          <div className="border rounded-lg">
            <div className="flex items-center gap-3 p-4">
              <h3 className="font-semibold text-sm">Backlog</h3>
              <Badge variant="secondary" className="text-[10px]">{backlogTasks.length}</Badge>
              {canEdit && (
                <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setCreateStatus({ status: "backlog", sprintId: null })}>
                  <Plus className="mr-1 h-3.5 w-3.5" />Add task
                </Button>
              )}
            </div>
            <div className="px-4 pb-4 space-y-1">
              {backlogTasks.length === 0 ? (
                <EmptyState icon={Inbox} title="Backlog is empty" description="Tasks without a sprint will appear here" className="py-6" />
              ) : (
                <SortableContext items={backlogTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-1">
                    {backlogTasks.map((task) => (
                      <SortableTaskRow key={task.id} task={task} currentSprintId={null} />
                    ))}
                  </div>
                </SortableContext>
              )}
            </div>
          </div>
        </div>

        <DragOverlay>
          {activeDragTask && (
            <div className="flex items-center gap-2.5 px-3 py-2 border rounded-md bg-background shadow-lg">
              {renderTaskRowContent(activeDragTask, activeDragTask.sprintId)}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Dialogs */}
      {showCreateSprint && (
        <CreateSprintDialog
          open
          workspaceId={workspace.id}
          projectId={projectId!}
          currentUserId={user.uid}
          nextPosition={sprints.length}
          onCreated={(sprint) => { setSprints((prev) => [...prev, sprint]); setShowCreateSprint(false); }}
          onClose={() => setShowCreateSprint(false)}
        />
      )}

      {editingSprint && (
        <CreateSprintDialog
          open
          sprint={editingSprint}
          workspaceId={workspace.id}
          projectId={projectId!}
          currentUserId={user.uid}
          nextPosition={sprints.length}
          onCreated={(updated) => {
            setSprints((prev) => prev.map((s) => s.id === updated.id ? updated : s));
            setEditingSprint(null);
          }}
          onClose={() => setEditingSprint(null)}
        />
      )}

      {createStatus && (
        <CreateTaskDialog
          open
          defaultStatus={createStatus.status}
          project={project}
          members={members}
          labels={labels}
          epics={epics}
          sprints={sprints}
          defaultSprintId={createStatus.sprintId}
          currentUserId={user.uid}
          workspaceId={workspace.id}
          onCreated={handleTaskCreated}
          onClose={() => setCreateStatus(null)}
        />
      )}

      {completingSprint && (
        <CompleteSprintDialog
          open
          sprint={completingSprint}
          incompleteTasks={(tasksBySprint.get(completingSprint.id) ?? []).filter((t) => t.status !== "done")}
          otherSprints={planningSprints.filter((s) => s.id !== completingSprint.id)}
          workspaceId={workspace.id}
          projectId={projectId!}
          onCompleted={() => setCompletingSprint(null)}
          onClose={() => setCompletingSprint(null)}
        />
      )}

      <TaskDetailSheet
        taskId={selectedTaskId}
        project={project}
        workspaceId={workspace.id}
        members={members}
        labels={labels}
        epics={epics}
        sprints={sprints}
        currentUserId={user.uid}
        canEdit={canEdit}
        isProjectAdmin={isProjectAdmin}
        onClose={() => setSelectedTaskId(null)}
        onUpdated={handleTaskUpdated}
      />
    </MotionPage>
  );
}
