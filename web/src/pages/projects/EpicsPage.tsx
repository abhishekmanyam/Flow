import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { useProjectAccess } from "@/hooks/useProjectAccess";
import { subscribeToEpics, subscribeToTasks, subscribeToSprints, subscribeToLabels, createEpic, updateEpic, deleteEpic, updateTask, projectDoc, getWorkspaceMembers, getProjectMembers } from "@/lib/firestore";
import { getDoc } from "firebase/firestore";
import {
  DndContext, DragOverlay,
  PointerSensor, useSensor, useSensors, closestCenter,
} from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import ProjectHeader from "@/components/projects/ProjectHeader";
import { Layout, LayoutContent, LayoutHeader } from "@astryxdesign/core/Layout";
import { HStack } from "@astryxdesign/core/HStack";
import { VStack } from "@astryxdesign/core/VStack";
import { Text } from "@astryxdesign/core/Text";
import { Button } from "@astryxdesign/core/Button";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Token } from "@astryxdesign/core/Token";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Avatar } from "@astryxdesign/core/Avatar";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { List, ListItem } from "@astryxdesign/core/List";
import { Divider } from "@astryxdesign/core/Divider";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { LayoutFooter } from "@astryxdesign/core/Layout";
import { FormLayout } from "@astryxdesign/core/FormLayout";
import { Field } from "@astryxdesign/core/Field";
import { TextInput } from "@astryxdesign/core/TextInput";
import { TextArea } from "@astryxdesign/core/TextArea";
import { Selector } from "@astryxdesign/core/Selector";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { Banner } from "@astryxdesign/core/Banner";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { toast } from "@/components/system/toast";
import PriorityIcon from "@/components/tasks/PriorityIcon";
import LabelPicker from "@/components/labels/LabelPicker";
import LabelBadge from "@/components/labels/LabelBadge";
import { Plus, Pencil, Trash2, Layers, ChevronRight, GripVertical, Zap } from "lucide-react";
import { EPIC_STATUS_LABELS, LABEL_COLORS } from "@/lib/types";
import type { Project, Epic, Task, EpicStatus, Sprint, WorkspaceMember, Label as LabelType, TaskStatus } from "@/lib/types";

const STATUS_DOT_VARIANT: Record<TaskStatus, "neutral" | "accent" | "warning" | "success" | "error"> = {
  backlog: "neutral",
  todo: "neutral",
  in_progress: "accent",
  in_review: "warning",
  done: "success",
};

const EPIC_STATUS_TOKEN: Record<EpicStatus, "gray" | "blue" | "green" | "red"> = {
  not_started: "gray",
  in_progress: "blue",
  done: "green",
  cancelled: "red",
};

function colorDot(color: string, size = 12) {
  return (
    <svg viewBox="0 0 12 12" width={size} height={size} aria-hidden="true">
      <circle cx={6} cy={6} r={6} fill={color} />
    </svg>
  );
}

function colorCircle(color: string, selected: boolean) {
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} aria-hidden="true">
      <circle cx={8} cy={8} r={selected ? 6 : 7} fill={color} stroke={selected ? "currentColor" : "none"} strokeWidth={selected ? 2 : 0} />
    </svg>
  );
}

function getInitials(name: string | null | undefined) {
  if (!name) return "?";
  return name.split(/\s/).map((s) => s[0]?.toUpperCase()).slice(0, 2).join("");
}

export default function EpicsPage() {
  const { slug, projectId } = useParams<{ slug: string; projectId: string }>();
  const navigate = useNavigate();
  const { workspace, user, role: wsRole } = useAuthStore();
  const { loading: accessLoading, hasAccess, canEdit, isProjectAdmin } = useProjectAccess(projectId);
  const [project, setProject] = useState<Project | null>(null);
  const [epics, setEpics] = useState<Epic[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [labels, setLabels] = useState<LabelType[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingEpic, setEditingEpic] = useState<Epic | null>(null);
  const [expandedEpics, setExpandedEpics] = useState<Set<string>>(new Set());
  const [activeDragEpic, setActiveDragEpic] = useState<Epic | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const availableSprints = useMemo(() => sprints.filter((s) => s.status === "planning" || s.status === "active"), [sprints]);

  const labelMap = useMemo(() => {
    const m = new Map<string, LabelType>();
    labels.forEach((l) => m.set(l.id, l));
    return m;
  }, [labels]);

  const memberMap = useMemo(() => {
    const m = new Map<string, WorkspaceMember>();
    members.forEach((mem) => m.set(mem.userId, mem));
    return m;
  }, [members]);

  const toggleExpanded = (epicId: string) => {
    setExpandedEpics((prev) => {
      const next = new Set(prev);
      if (next.has(epicId)) next.delete(epicId);
      else next.add(epicId);
      return next;
    });
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
    ]).then(([snap, mems]) => {
      if (snap.exists()) setProject({ id: snap.id, ...snap.data() } as Project);
      setMembers(mems);
    });
    const unsubs = [
      subscribeToEpics(workspace.id, projectId, setEpics),
      subscribeToTasks(workspace.id, projectId, setTasks),
      subscribeToSprints(workspace.id, projectId, setSprints),
      subscribeToLabels(workspace.id, projectId, setLabels),
    ];
    return () => unsubs.forEach((u) => u());
  }, [workspace?.id, projectId, accessLoading, hasAccess]);

  const handleEpicDragStart = ({ active }: DragStartEvent) => {
    setActiveDragEpic(epics.find((e) => e.id === active.id) ?? null);
  };

  const handleEpicDragEnd = async ({ active, over }: DragEndEvent) => {
    setActiveDragEpic(null);
    if (!over || active.id === over.id || !workspace || !projectId) return;
    const oldIdx = epics.findIndex((e) => e.id === active.id);
    const newIdx = epics.findIndex((e) => e.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(epics, oldIdx, newIdx);
    setEpics(reordered);
    await Promise.all(reordered.map((e, i) => updateEpic(workspace.id, projectId, e.id, { position: i })));
  };

  const pushEpicTasksToSprint = async (epicId: string, sprintId: string) => {
    if (!workspace || !projectId || !user) return;
    const epicTasks = tasks.filter((t) => t.epicId === epicId && t.status !== "done" && !t.sprintId && t.deletedAt === null);
    if (epicTasks.length === 0) { toast.info("No eligible tasks to push"); return; }
    try {
      const actorName = user.displayName ?? "Someone";
      await Promise.all(epicTasks.map((t) => updateTask(workspace.id, projectId, t.id, { sprintId }, user.uid, t, { actorName })));
      toast.success(`Moved ${epicTasks.length} task${epicTasks.length > 1 ? "s" : ""} to sprint`);
    } catch { toast.error("Failed to push tasks"); }
  };

  const getEpicStats = (epicId: string) => {
    const epicTasks = tasks.filter((t) => t.epicId === epicId);
    const done = epicTasks.filter((t) => t.status === "done").length;
    const total = epicTasks.length;
    const points = epicTasks.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);
    const donePoints = epicTasks.filter((t) => t.status === "done").reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);
    return { total, done, points, donePoints, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
  };

  if (accessLoading || !workspace || !user || !project) {
    return (
      <Layout>
        <LayoutContent padding={4}>
          <VStack gap={3}><Skeleton height={28} width={200} /><Skeleton height={240} /></VStack>
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

  const SortableEpicRow = ({ epic }: { epic: Epic }) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: epic.id });
    const dndStyle = { transform: CSS.Transform.toString(transform), transition };
    const stats = getEpicStats(epic.id);
    const epicTasks = tasks.filter((t) => t.epicId === epic.id);
    const isExpanded = expandedEpics.has(epic.id);

    return (
      <VStack gap={0} ref={setNodeRef} style={dndStyle} {...attributes}>
        <HStack gap={2} align="start" paddingInline={4} paddingBlock={3}>
          {canEdit && (
            <HStack {...listeners} align="center" aria-label="Drag epic">
              <GripVertical size={16} />
            </HStack>
          )}
          <IconButton
            label={isExpanded ? "Collapse" : "Expand"}
            variant="ghost"
            size="sm"
            icon={<ChevronRight size={16} />}
            onClick={() => toggleExpanded(epic.id)}
          />
          <HStack align="center" paddingBlock={1}>{colorDot(epic.color)}</HStack>
          <VStack gap={2} width="100%">
            <HStack gap={2} align="center" wrap="wrap">
              <Text type="body" weight="medium" maxLines={1}>{epic.title}</Text>
              <Token label={EPIC_STATUS_LABELS[epic.status]} color={EPIC_STATUS_TOKEN[epic.status]} size="sm" />
            </HStack>
            {epic.description && (
              <Text type="supporting" color="secondary" maxLines={2}>{epic.description}</Text>
            )}
            {(epic.labelIds?.length ?? 0) > 0 && (
              <HStack gap={1} wrap="wrap">
                {epic.labelIds.map((lid) => {
                  const label = labelMap.get(lid);
                  return label ? <LabelBadge key={lid} name={label.name} color={label.color} /> : null;
                })}
              </HStack>
            )}
            <VStack gap={1}>
              <HStack justify="between" align="center">
                <Text type="supporting" color="secondary">{stats.done}/{stats.total} tasks done</Text>
                <Text type="supporting" color="secondary">{stats.donePoints}/{stats.points} points</Text>
              </HStack>
              <ProgressBar label={`${epic.title} progress`} value={stats.pct} isLabelHidden variant={stats.pct === 100 ? "success" : "accent"} />
            </VStack>
          </VStack>
          {canEdit && (
            <HStack gap={1} align="center">
              {availableSprints.length > 0 && (
                <IconButton
                  label={`Push to ${availableSprints[0].name}`}
                  variant="ghost"
                  size="sm"
                  icon={<Zap size={14} />}
                  onClick={() => pushEpicTasksToSprint(epic.id, availableSprints[0].id)}
                />
              )}
              <IconButton label="Edit epic" variant="ghost" size="sm" icon={<Pencil size={14} />} onClick={() => setEditingEpic(epic)} />
              <IconButton
                label="Delete epic"
                variant="ghost"
                size="sm"
                icon={<Trash2 size={14} />}
                clickAction={async () => {
                  await deleteEpic(workspace.id, projectId!, epic.id);
                  toast.success("Epic deleted");
                }}
              />
            </HStack>
          )}
        </HStack>
        {isExpanded && (
          epicTasks.length === 0 ? (
            <VStack paddingInline={4} paddingBlock={2}>
              <Text type="supporting" color="secondary">No tasks in this epic</Text>
            </VStack>
          ) : (
            <List hasDividers>
              {epicTasks.map((task) => {
                const mem = task.assigneeId ? memberMap.get(task.assigneeId) : null;
                return (
                  <ListItem
                    key={task.id}
                    label={task.title}
                    onClick={() => navigate(`/${slug}/projects/${projectId}/board`)}
                    startContent={<StatusDot variant={STATUS_DOT_VARIANT[task.status]} label={task.status} />}
                    endContent={
                      <HStack gap={2} align="center">
                        <PriorityIcon priority={task.priority} />
                        {mem && <Avatar size="xsmall" src={mem.profile?.avatarUrl ?? undefined} name={mem.profile?.name ?? getInitials(mem.profile?.name)} />}
                      </HStack>
                    }
                  />
                );
              })}
            </List>
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
        <Layout
          header={
            canEdit ? (
              <LayoutHeader hasDivider>
                <HStack paddingInline={4} paddingBlock={3}>
                  <Button label="Add epic" variant="primary" size="sm" icon={<Plus size={16} />} onClick={() => setCreateOpen(true)} />
                </HStack>
              </LayoutHeader>
            ) : undefined
          }
          content={
            <LayoutContent padding={0}>
              {epics.length === 0 ? (
                <EmptyState icon={<Layers size={28} />} title="No epics yet" description="Create one to group related tasks into larger goals" />
              ) : (
                <DndContext sensors={canEdit ? sensors : undefined} collisionDetection={closestCenter} onDragStart={handleEpicDragStart} onDragEnd={handleEpicDragEnd}>
                  <SortableContext items={epics.map((e) => e.id)} strategy={verticalListSortingStrategy}>
                    <VStack gap={0}>
                      {epics.map((epic, i) => (
                        <VStack gap={0} key={epic.id}>
                          <SortableEpicRow epic={epic} />
                          {i < epics.length - 1 && <Divider />}
                        </VStack>
                      ))}
                    </VStack>
                  </SortableContext>
                  <DragOverlay>
                    {activeDragEpic && (
                      <HStack gap={2} align="center" padding={3}>
                        {colorDot(activeDragEpic.color)}
                        <Text type="body" weight="medium">{activeDragEpic.title}</Text>
                      </HStack>
                    )}
                  </DragOverlay>
                </DndContext>
              )}
            </LayoutContent>
          }
        />
      }
    />

    {createOpen && (
      <EpicFormDialog
        labels={labels}
        onClose={() => setCreateOpen(false)}
        onSave={async (data) => {
          await createEpic(workspace.id, projectId!, {
            ...data,
            projectId: projectId!,
            position: epics.length,
            createdBy: user.uid,
          });
          setCreateOpen(false);
          toast.success("Epic created");
        }}
      />
    )}
    {editingEpic && (
      <EpicFormDialog
        epic={editingEpic}
        labels={labels}
        onClose={() => setEditingEpic(null)}
        onSave={async (data) => {
          await updateEpic(workspace.id, projectId!, editingEpic.id, data);
          setEditingEpic(null);
          toast.success("Epic updated");
        }}
      />
    )}
    </>
  );
}

// ─── Epic form dialog ─────────────────────────────────────────────────────────

interface EpicFormDialogProps {
  epic?: Epic;
  labels: LabelType[];
  onClose: () => void;
  onSave: (data: { title: string; description: string; color: string; status: EpicStatus; labelIds: string[]; leadId: string | null; startDate: null; targetDate: null }) => Promise<void>;
}

function EpicFormDialog({ epic, labels, onClose, onSave }: EpicFormDialogProps) {
  const [title, setTitle] = useState(epic?.title ?? "");
  const [description, setDescription] = useState(epic?.description ?? "");
  const [color, setColor] = useState(epic?.color ?? LABEL_COLORS[0]);
  const [status, setStatus] = useState<EpicStatus>(epic?.status ?? "not_started");
  const [labelIds, setLabelIds] = useState<string[]>(epic?.labelIds ?? []);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave({ title: title.trim(), description: description.trim(), color, status, labelIds, leadId: null, startDate: null, targetDate: null });
    } catch {
      toast.error("Failed to save epic");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog isOpen onOpenChange={(v) => !v && onClose()} purpose="form" width={480}>
      <Layout
        header={<DialogHeader title={epic ? "Edit Epic" : "Create Epic"} onOpenChange={(v) => !v && onClose()} />}
        content={
          <LayoutContent padding={4}>
            <FormLayout>
              <TextInput label="Title" isRequired value={title} onChange={setTitle} placeholder="Epic title" hasAutoFocus />
              <TextArea label="Description" value={description} onChange={setDescription} placeholder="What's this epic about?" rows={3} isOptional />
              <Selector
                label="Status"
                value={status}
                onChange={(v) => setStatus(v as EpicStatus)}
                options={(Object.entries(EPIC_STATUS_LABELS) as [EpicStatus, string][]).map(([value, label]) => ({ value, label }))}
              />
              <Field label="Color" inputID="epic-color">
                <HStack gap={1} wrap="wrap">
                  {LABEL_COLORS.map((c) => (
                    <IconButton
                      key={c}
                      label={`Color ${c}`}
                      variant={color === c ? "secondary" : "ghost"}
                      icon={colorCircle(c, color === c)}
                      onClick={() => setColor(c)}
                    />
                  ))}
                </HStack>
              </Field>
              {labels.length > 0 && (
                <Field label="Labels" inputID="epic-labels">
                  <LabelPicker labels={labels} selectedIds={labelIds} onChange={setLabelIds} />
                </Field>
              )}
            </FormLayout>
          </LayoutContent>
        }
        footer={
          <LayoutFooter hasDivider>
            <HStack gap={2} hAlign="end">
              <Button label="Cancel" variant="secondary" onClick={onClose} />
              <Button label={epic ? "Save" : "Create"} variant="primary" isLoading={saving} isDisabled={!title.trim()} clickAction={handleSubmit} />
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  );
}
