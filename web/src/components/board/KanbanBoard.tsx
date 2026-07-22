import { useState, useCallback, memo, useMemo } from "react";
import {
  DndContext, DragOverlay,
  PointerSensor, useSensor, useSensors, closestCorners,
} from "@dnd-kit/core";
import type { DragEndEvent, DragOverEvent, DragStartEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { useAuthStore } from "@/store/auth";
import { updateTask, taskDoc } from "@/lib/firestore";
import { updateDoc, serverTimestamp } from "firebase/firestore";
import KanbanColumn from "./KanbanColumn";
import TaskCard from "./TaskCard";
import { buildTaskIdentifiers } from "@/lib/task-utils";
import CreateTaskDialog from "@/components/tasks/CreateTaskDialog";
import TaskDetailSheet from "@/components/tasks/TaskDetailSheet";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { StackItem } from "@astryxdesign/core/Layout";
import { Divider } from "@astryxdesign/core/Divider";
import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { Plus } from "lucide-react";
import { TASK_STATUSES, TASK_STATUS_LABELS } from "@/lib/types";
import type { Task, Project, WorkspaceMember, Label, Epic, Sprint, TaskStatus } from "@/lib/types";
import type { ReactNode } from "react";

interface KanbanBoardProps {
  project: Project;
  tasks: Task[];
  members: WorkspaceMember[];
  labels: Label[];
  epics?: Epic[];
  sprints?: Sprint[];
  currentUserId: string;
  canEdit: boolean;
  isProjectAdmin?: boolean;
  workspaceId: string;
  viewToggle?: ReactNode;
  filterBar?: ReactNode;
}

// rerender-memo: memoize board so it doesn't re-render on unrelated parent changes
export default memo(function KanbanBoard({
  project, tasks: initialTasks, members, labels, epics = [], sprints = [], currentUserId, canEdit, isProjectAdmin = false, workspaceId, viewToggle, filterBar,
}: KanbanBoardProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [createStatus, setCreateStatus] = useState<TaskStatus | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Sync external task changes
  if (initialTasks !== tasks) {
    // Only update if lengths differ or ids changed to avoid infinite loops
    const initIds = initialTasks.map((t) => t.id).join();
    const currIds = tasks.map((t) => t.id).join();
    if (initIds !== currIds) setTasks(initialTasks);
  }

  const taskIdentifiers = useMemo(() => buildTaskIdentifiers(project, tasks), [project.name, tasks]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const getByStatus = useCallback(
    (status: TaskStatus) => tasks.filter((t) => t.status === status),
    [tasks]
  );

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveTask(tasks.find((t) => t.id === active.id) ?? null);
  };

  const handleDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;
    if (activeId === overId) return;
    const activeTask = tasks.find((t) => t.id === activeId);
    if (!activeTask) return;
    const newStatus = TASK_STATUSES.includes(overId as TaskStatus)
      ? overId as TaskStatus
      : tasks.find((t) => t.id === overId)?.status ?? activeTask.status;
    if (newStatus !== activeTask.status) {
      setTasks((prev) => prev.map((t) => t.id === activeId ? { ...t, status: newStatus } : t));
    }
  };

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    setActiveTask(null);
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;
    const task = tasks.find((t) => t.id === activeId);
    if (!task) return;

    const newStatus = TASK_STATUSES.includes(overId as TaskStatus)
      ? overId as TaskStatus
      : tasks.find((t) => t.id === overId)?.status ?? task.status;

    const columnTasks = tasks.filter((t) => t.status === newStatus).sort((a, b) => a.position - b.position);
    const oldIdx = columnTasks.findIndex((t) => t.id === activeId);
    const newIdx = overId === newStatus ? columnTasks.length - 1 : columnTasks.findIndex((t) => t.id === overId);
    const reordered = oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx
      ? arrayMove(columnTasks, oldIdx, newIdx)
      : columnTasks;

    const updated = reordered.map((t, i) => ({ ...t, position: i }));
    setTasks((prev) => [...prev.filter((t) => t.status !== newStatus), ...updated]);

    // Persist — fire and forget
    const batch = updated.map((t) =>
      updateDoc(taskDoc(workspaceId, project.id, t.id), { position: t.position, status: newStatus, updatedAt: serverTimestamp() })
    );
    if (task.status !== newStatus) {
      const actorName = useAuthStore.getState().user?.displayName ?? "Someone";
      batch.push(
        updateTask(workspaceId, project.id, activeId, { status: newStatus }, currentUserId, task, { actorName })
      );
    }
    await Promise.all(batch);
  };

  const handleTaskCreated = (task: Task) => {
    setTasks((prev) => [...prev, task]);
    setCreateStatus(null);
  };

  const handleTaskUpdated = (id: string, changes: Partial<Task>) => {
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, ...changes } : t));
  };

  return (
    <VStack height="100%">
      <VStack>
        <HStack hAlign="between" vAlign="center" paddingInline={4} paddingBlock={3}>
          <HStack gap={2} vAlign="center">
            {canEdit && (
              <Button
                label="Add task"
                variant="primary"
                size="sm"
                icon={<Icon icon={Plus} size="sm" />}
                onClick={() => setCreateStatus("backlog")}
              />
            )}
          </HStack>
          {viewToggle && <HStack gap={2} vAlign="center">{viewToggle}</HStack>}
        </HStack>
        {filterBar && (
          <>
            <Divider />
            <VStack paddingInline={4} paddingBlock={2}>{filterBar}</VStack>
          </>
        )}
        <Divider />
      </VStack>

      <StackItem size="fill">
        <DndContext sensors={sensors} collisionDetection={closestCorners}
          onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
          <HStack gap={4} padding={4} isScrollable height="100%" vAlign="stretch">
            {TASK_STATUSES.map((status) => (
              <KanbanColumn key={status} status={status} label={TASK_STATUS_LABELS[status]}
                tasks={getByStatus(status)} canEdit={canEdit}
                onAddTask={() => setCreateStatus(status)}
                onSelectTask={setSelectedTaskId}
                members={members} labels={labels} epics={epics} sprints={sprints}
                taskIdentifiers={taskIdentifiers} />
            ))}
          </HStack>
          <DragOverlay>
            {activeTask && <TaskCard task={activeTask} isDragging onSelect={() => {}} members={members} labels={labels} epics={epics} sprints={sprints} taskIdentifier={taskIdentifiers.get(activeTask.id)} />}
          </DragOverlay>
        </DndContext>
      </StackItem>

      {createStatus && (
        <CreateTaskDialog open defaultStatus={createStatus} project={project}
          members={members} labels={labels} epics={epics} sprints={sprints} currentUserId={currentUserId} workspaceId={workspaceId}
          onCreated={handleTaskCreated} onClose={() => setCreateStatus(null)} />
      )}
      <TaskDetailSheet taskId={selectedTaskId} project={project} workspaceId={workspaceId}
        members={members} labels={labels} epics={epics} sprints={sprints} currentUserId={currentUserId} canEdit={canEdit}
        isProjectAdmin={isProjectAdmin} onClose={() => setSelectedTaskId(null)} onUpdated={handleTaskUpdated} />
    </VStack>
  );
});
