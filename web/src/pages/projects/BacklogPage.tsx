import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { useProjectAccess } from "@/hooks/useProjectAccess";
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
import { Layout, LayoutContent } from "@astryxdesign/core/Layout";
import { HStack } from "@astryxdesign/core/HStack";
import { VStack } from "@astryxdesign/core/VStack";
import { Text } from "@astryxdesign/core/Text";
import { Heading } from "@astryxdesign/core/Heading";
import { Button } from "@astryxdesign/core/Button";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Badge } from "@astryxdesign/core/Badge";
import { Token } from "@astryxdesign/core/Token";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Avatar } from "@astryxdesign/core/Avatar";
import { MoreMenu } from "@astryxdesign/core/MoreMenu";
import { Card } from "@astryxdesign/core/Card";
import { Section } from "@astryxdesign/core/Section";
import { Divider } from "@astryxdesign/core/Divider";
import { DateInput } from "@astryxdesign/core/DateInput";
import type { ISODateString } from "@astryxdesign/core/Calendar";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { Banner } from "@astryxdesign/core/Banner";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { toast } from "@/components/system/toast";
import { format, isPast, isToday } from "date-fns";
import { Plus, ChevronRight, Play, CheckCircle2, Inbox, GripVertical, Pencil } from "lucide-react";
import PriorityIcon from "@/components/tasks/PriorityIcon";
import EpicBadge from "@/components/epics/EpicBadge";
import { buildTaskIdentifiers } from "@/lib/task-utils";
import type { Task, Project, WorkspaceMember, Label, Epic, Sprint, TaskStatus } from "@/lib/types";

const STATUS_DOT_VARIANT: Record<TaskStatus, "neutral" | "accent" | "warning" | "success" | "error"> = {
  backlog: "neutral",
  todo: "neutral",
  in_progress: "accent",
  in_review: "warning",
  done: "success",
};

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

    const activeTask = tasks.find((t) => t.id === activeId);
    const overTask = tasks.find((t) => t.id === overId);
    if (!activeTask || !overTask) return;

    if (activeTask.sprintId !== overTask.sprintId) return;

    const sectionTasks = (activeTask.sprintId
      ? (tasksBySprint.get(activeTask.sprintId) ?? [])
      : backlogTasks
    ).sort((a, b) => a.position - b.position);

    const oldIdx = sectionTasks.findIndex((t) => t.id === activeId);
    const newIdx = sectionTasks.findIndex((t) => t.id === overId);
    if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return;

    const reordered = arrayMove(sectionTasks, oldIdx, newIdx);

    const updatedPositions = reordered.map((t, i) => ({ ...t, position: i }));
    setTasks((prev) => {
      const otherTasks = prev.filter((t) => t.sprintId !== activeTask.sprintId || (activeTask.sprintId === null && t.sprintId !== null));
      return [...otherTasks, ...updatedPositions];
    });

    await Promise.all(
      updatedPositions.map((t, i) =>
        updateDoc(taskDoc(workspace.id, projectId, t.id), { position: i, updatedAt: serverTimestamp() })
      )
    );
  };

  if (accessLoading || !workspace || !user) {
    return (
      <Layout>
        <LayoutContent padding={4}>
          <VStack gap={3}><Skeleton height={28} width={220} /><Skeleton height={320} /></VStack>
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

  if (!project) {
    return (
      <Layout>
        <LayoutContent padding={4}>
          <VStack gap={3}><Skeleton height={28} width={220} /><Skeleton height={320} /></VStack>
        </LayoutContent>
      </Layout>
    );
  }

  const memberMap = new Map<string, string>();
  const memberAvatarMap = new Map<string, string | undefined>();
  members.forEach((m) => {
    memberMap.set(m.userId, m.profile?.name ?? "Unknown");
    memberAvatarMap.set(m.userId, m.profile?.avatarUrl ?? undefined);
  });

  const tsToDate = (ts: unknown): Date | null => {
    if (!ts) return null;
    if (typeof (ts as { toDate?: () => Date }).toDate === "function") return (ts as { toDate: () => Date }).toDate();
    return new Date(ts as string);
  };

  const renderTaskRowContent = (task: Task, currentSprintId: string | null, listeners?: Record<string, unknown>) => {
    const dueDate = tsToDate(task.dueDate);
    const isOverdue = dueDate && isPast(dueDate) && task.status !== "done";
    const isDueToday = dueDate && isToday(dueDate);
    const assigneeName = task.assigneeId ? memberMap.get(task.assigneeId) : null;
    const assigneeAvatar = task.assigneeId ? memberAvatarMap.get(task.assigneeId) : undefined;
    const epic = task.epicId ? epicMap.get(task.epicId) : null;
    const identifier = taskIdentifiers.get(task.id);

    const menuItems = [
      ...(activeSprint && currentSprintId !== activeSprint.id ? [{ label: `Move to ${activeSprint.name}`, onClick: () => moveTaskToSprint(task.id, activeSprint.id) }] : []),
      ...planningSprints.filter((s) => s.id !== currentSprintId).map((s) => ({ label: `Move to ${s.name}`, onClick: () => moveTaskToSprint(task.id, s.id) })),
      ...(currentSprintId ? [{ label: "Move to Backlog", onClick: () => moveTaskToSprint(task.id, null) }] : []),
      { label: "Duplicate", onClick: () => handleDuplicate(task) },
      ...(isProjectAdmin ? [{ type: "divider" as const }, { label: "Delete", onClick: () => handleSoftDelete(task.id) }] : []),
    ];

    return (
      <>
        {canEdit && listeners && (
          <HStack {...listeners} align="center" aria-label="Drag task" onClick={(e) => e.stopPropagation()}>
            <GripVertical size={14} />
          </HStack>
        )}
        <StatusDot variant={STATUS_DOT_VARIANT[task.status]} label={task.status} />
        {identifier && <Text type="code" color="secondary">{identifier}</Text>}
        <HStack width="100%" align="center" gap={2}>
          <Text type="body" weight="medium" maxLines={1}>{task.title}</Text>
          {epic && <EpicBadge title={epic.title} color={epic.color} />}
        </HStack>
        {dueDate && (
          isOverdue || isDueToday
            ? <Token label={format(dueDate, "MMM d")} size="sm" color={isOverdue ? "red" : "orange"} />
            : <Text type="supporting" color="secondary">{format(dueDate, "MMM d")}</Text>
        )}
        {task.storyPoints != null && task.storyPoints > 0 && (
          <Text type="code" color="secondary">{task.storyPoints}SP</Text>
        )}
        <PriorityIcon priority={task.priority} />
        {assigneeName && <Avatar size="xsmall" src={assigneeAvatar} name={assigneeName} />}
        {canEdit && <MoreMenu label="Task actions" size="sm" items={menuItems} />}
      </>
    );
  };

  const SortableTaskRow = ({ task, currentSprintId }: { task: Task; currentSprintId: string | null }) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task.id });
    const dndStyle = { transform: CSS.Transform.toString(transform), transition };
    return (
      <HStack
        ref={setNodeRef}
        style={dndStyle}
        {...attributes}
        gap={2}
        align="center"
        paddingInline={4}
        paddingBlock={2}
        onClick={() => setSelectedTaskId(task.id)}
      >
        {renderTaskRowContent(task, currentSprintId, listeners)}
      </HStack>
    );
  };

  const renderSprintSection = (sprint: Sprint) => {
    const sprintTasks = tasksBySprint.get(sprint.id) ?? [];
    const isCollapsed = collapsedSprints.has(sprint.id);
    const isStarting = startingSprintId === sprint.id;
    const sprintMenuItems = [
      { label: "Edit sprint", onClick: () => setEditingSprint(sprint) },
      ...(sprint.status === "planning" ? [{ label: "Delete sprint", onClick: () => handleDeleteSprint(sprint) }] : []),
    ];

    return (
      <VStack key={sprint.id} gap={0}>
        <Section variant="muted" padding={0} dividers={["bottom"]}>
        <HStack gap={2} align="start" paddingInline={4} paddingBlock={3}>
          <IconButton
            label={isCollapsed ? "Expand sprint" : "Collapse sprint"}
            variant="ghost"
            size="sm"
            icon={<ChevronRight size={16} />}
            onClick={() => toggleCollapse(sprint.id)}
          />
          <VStack width="100%">
            <SprintHeader sprint={sprint} tasks={sprintTasks} />
          </VStack>
          <HStack gap={1} align="center">
            {isProjectAdmin && sprint.status === "planning" && !activeSprint && (
              <Button
                label="Start"
                variant="secondary"
                size="sm"
                icon={<Play size={14} />}
                onClick={() => {
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
                }}
              />
            )}
            {isProjectAdmin && sprint.status === "active" && (
              <Button label="Complete" variant="secondary" size="sm" icon={<CheckCircle2 size={14} />} onClick={() => setCompletingSprint(sprint)} />
            )}
            {canEdit && (
              <IconButton label="Add task to sprint" variant="ghost" size="sm" icon={<Plus size={16} />} onClick={() => setCreateStatus({ status: "todo", sprintId: sprint.id })} />
            )}
            {isProjectAdmin && (
              <MoreMenu
                label="Sprint actions"
                size="sm"
                items={sprintMenuItems}
                icon={<Pencil size={14} />}
              />
            )}
          </HStack>
        </HStack>
        </Section>

        {isStarting && (
          <Section variant="muted" padding={0} dividers={["bottom"]}>
            <HStack gap={3} align="end" paddingInline={4} paddingBlock={3} wrap="wrap">
              <DateInput label="Start date" value={(sprintDateInputs.startDate || undefined) as ISODateString | undefined} onChange={(v) => setSprintDateInputs((p) => ({ ...p, startDate: v ?? "" }))} />
              <DateInput label="End date" value={(sprintDateInputs.endDate || undefined) as ISODateString | undefined} onChange={(v) => setSprintDateInputs((p) => ({ ...p, endDate: v ?? "" }))} />
              <Button label="Start sprint" variant="primary" size="sm" onClick={() => handleStartSprint(sprint.id)} />
              <Button label="Cancel" variant="ghost" size="sm" onClick={() => setStartingSprintId(null)} />
            </HStack>
          </Section>
        )}

        {!isCollapsed && (
          sprintTasks.length === 0 ? (
            <EmptyState icon={<Inbox size={24} />} title="Sprint is empty" description="Add tasks from the backlog or create new ones" isCompact />
          ) : (
            <SortableContext items={sprintTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              <VStack gap={0}>
                {sprintTasks.map((task) => (
                  <VStack gap={0} key={task.id}>
                    <SortableTaskRow task={task} currentSprintId={sprint.id} />
                    <Divider />
                  </VStack>
                ))}
              </VStack>
            </SortableContext>
          )
        )}
      </VStack>
    );
  };

  return (
    <>
    <Layout
      header={<ProjectHeader project={project} workspaceSlug={slug!} canEdit={canEdit} isProjectAdmin={isProjectAdmin} />}
      content={
        <LayoutContent padding={0}>
          <DndContext sensors={canEdit ? sensors : undefined} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <VStack gap={0}>
              {activeSprint && renderSprintSection(activeSprint)}
              {planningSprints.map((sprint) => renderSprintSection(sprint))}

              {isProjectAdmin && (
                <HStack paddingInline={4} paddingBlock={3}>
                  <Button label="Create sprint" variant="secondary" size="sm" icon={<Plus size={16} />} onClick={() => setShowCreateSprint(true)} />
                </HStack>
              )}

              <VStack gap={0}>
                <Section variant="muted" padding={0} dividers={["bottom"]}>
                  <HStack gap={2} align="center" paddingInline={4} paddingBlock={3}>
                    <Heading level={3}>Backlog</Heading>
                    <Badge variant="neutral" label={String(backlogTasks.length)} />
                    {canEdit && (
                      <HStack justify="end" width="100%">
                        <Button label="Add task" variant="ghost" size="sm" icon={<Plus size={16} />} onClick={() => setCreateStatus({ status: "backlog", sprintId: null })} />
                      </HStack>
                    )}
                  </HStack>
                </Section>
                {backlogTasks.length === 0 ? (
                  <EmptyState icon={<Inbox size={24} />} title="Backlog is empty" description="Tasks without a sprint will appear here" isCompact />
                ) : (
                  <SortableContext items={backlogTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                    <VStack gap={0}>
                      {backlogTasks.map((task) => (
                        <VStack gap={0} key={task.id}>
                          <SortableTaskRow task={task} currentSprintId={null} />
                          <Divider />
                        </VStack>
                      ))}
                    </VStack>
                  </SortableContext>
                )}
              </VStack>
            </VStack>

            <DragOverlay>
              {activeDragTask && (
                <Card padding={2}>
                  <HStack gap={2} align="center">
                    {renderTaskRowContent(activeDragTask, activeDragTask.sprintId)}
                  </HStack>
                </Card>
              )}
            </DragOverlay>
          </DndContext>
        </LayoutContent>
      }
    />

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
    </>
  );
}
