import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { useProjectAccess } from "@/hooks/useProjectAccess";
import { MotionPage } from "@/components/ui/motion-page";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { EmptyState } from "@/components/ui/empty-state";
import PriorityIcon from "@/components/tasks/PriorityIcon";
import LabelPicker from "@/components/labels/LabelPicker";
import LabelBadge from "@/components/labels/LabelBadge";
import { Plus, Pencil, Trash2, Loader2, Layers, ChevronRight, GripVertical, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { EPIC_STATUS_LABELS, LABEL_COLORS, STATUS_DOT_COLORS } from "@/lib/types";
import type { Project, Epic, Task, EpicStatus, Sprint, WorkspaceMember, Label as LabelType } from "@/lib/types";

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

  if (accessLoading || !workspace || !user || !project) return (
    <div className="p-6"><Skeleton className="h-8 w-48" /></div>
  );

  const getEpicStats = (epicId: string) => {
    const epicTasks = tasks.filter((t) => t.epicId === epicId);
    const done = epicTasks.filter((t) => t.status === "done").length;
    const total = epicTasks.length;
    const points = epicTasks.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);
    const donePoints = epicTasks.filter((t) => t.status === "done").reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);
    return { total, done, points, donePoints, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
  };

  const SortableEpicCard = ({ epic }: { epic: Epic }) => {
    const stats = getEpicStats(epic.id);
    const epicTasks = tasks.filter((t) => t.epicId === epic.id);
    const isExpanded = expandedEpics.has(epic.id);
    return (
      <SortableEpicCardInner
        epic={epic} stats={stats} epicTasks={epicTasks} isExpanded={isExpanded}
        toggleExpanded={toggleExpanded} canEdit={canEdit} availableSprints={availableSprints}
        memberMap={memberMap} labelMap={labelMap} navigate={navigate} slug={slug} projectId={projectId}
        workspace={workspace} setEditingEpic={setEditingEpic} pushEpicTasksToSprint={pushEpicTasksToSprint}
      />
    );
  };

  return (
    <MotionPage className="flex flex-col h-full">
      <ProjectHeader project={project} workspaceSlug={slug!} canEdit={canEdit} isProjectAdmin={isProjectAdmin} />
      <div className="flex items-center gap-2 px-6 py-3 border-b">
        {canEdit && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />Add epic
          </Button>
        )}
      </div>
      <DndContext sensors={canEdit ? sensors : undefined} collisionDetection={closestCenter} onDragStart={handleEpicDragStart} onDragEnd={handleEpicDragEnd}>
        <div className="flex-1 overflow-auto p-6">
          {epics.length === 0 ? (
            <EmptyState icon={Layers} title="No epics yet" description="Create one to group related tasks into larger goals" />
          ) : (
            <SortableContext items={epics.map((e) => e.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-3 max-w-3xl">
                {epics.map((epic) => (
                  <SortableEpicCard key={epic.id} epic={epic} />
                ))}
              </div>
            </SortableContext>
          )}
        </div>

        <DragOverlay>
          {activeDragEpic && (
            <div className="border rounded-lg bg-background shadow-lg p-4">
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 rounded-full shrink-0" style={{ backgroundColor: activeDragEpic.color }} />
                <h3 className="font-medium truncate">{activeDragEpic.title}</h3>
              </div>
            </div>
          )}
        </DragOverlay>
      </DndContext>

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
    </MotionPage>
  );
}

// ─── Sortable Epic Card (internal) ────────────────────────────────────────────

function SortableEpicCardInner({
  epic, stats, epicTasks, isExpanded, toggleExpanded, canEdit, availableSprints, memberMap, labelMap, navigate, slug, projectId, workspace, setEditingEpic, pushEpicTasksToSprint,
}: {
  epic: Epic; stats: { total: number; done: number; points: number; donePoints: number; pct: number };
  epicTasks: Task[]; isExpanded: boolean; toggleExpanded: (id: string) => void;
  canEdit: boolean; availableSprints: Sprint[]; memberMap: Map<string, WorkspaceMember>;
  labelMap: Map<string, LabelType>;
  navigate: ReturnType<typeof useNavigate>; slug: string | undefined; projectId: string | undefined;
  workspace: { id: string }; setEditingEpic: (e: Epic) => void;
  pushEpicTasksToSprint: (epicId: string, sprintId: string) => Promise<void>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: epic.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={style} {...attributes} className="border rounded-lg space-y-0">
      <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(epic.id)}>
        <div className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            {canEdit && (
              <button className="mt-1 shrink-0 cursor-grab active:cursor-grabbing touch-none" {...listeners}>
                <GripVertical className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
            <CollapsibleTrigger asChild>
              <button className="mt-1 shrink-0 p-0.5 rounded hover:bg-muted transition-colors">
                <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", isExpanded && "rotate-90")} />
              </button>
            </CollapsibleTrigger>
            <div className="h-4 w-4 rounded-full mt-0.5 shrink-0" style={{ backgroundColor: epic.color }} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-medium truncate">{epic.title}</h3>
                <span className={cn("text-xs px-1.5 py-0.5 rounded-full",
                  epic.status === "done" ? "bg-green-100 text-green-700" :
                  epic.status === "in_progress" ? "bg-blue-100 text-blue-700" :
                  epic.status === "cancelled" ? "bg-red-100 text-red-700" :
                  "bg-muted text-muted-foreground")}>
                  {EPIC_STATUS_LABELS[epic.status]}
                </span>
              </div>
              {epic.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{epic.description}</p>
              )}
              {(epic.labelIds?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {epic.labelIds.map((lid) => {
                    const label = labelMap.get(lid);
                    return label ? <LabelBadge key={lid} name={label.name} color={label.color} className="text-[10px] px-1.5 py-0" /> : null;
                  })}
                </div>
              )}
            </div>
            {canEdit && (
              <div className="flex gap-1 shrink-0">
                {availableSprints.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => e.stopPropagation()}>
                        <Zap className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      {availableSprints.map((s) => (
                        <DropdownMenuItem key={s.id} onClick={() => pushEpicTasksToSprint(epic.id, s.id)}>
                          Push to {s.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setEditingEpic(epic); }}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                  onClick={async (e) => {
                    e.stopPropagation();
                    await deleteEpic(workspace.id, projectId!, epic.id);
                    toast.success("Epic deleted");
                  }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{stats.done}/{stats.total} tasks done</span>
              <span>{stats.donePoints}/{stats.points} points</span>
            </div>
            <Progress value={stats.pct} className="h-2" />
          </div>
        </div>
        <CollapsibleContent>
          <div className="border-t">
            {epicTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground px-4 py-3">No tasks in this epic</p>
            ) : (
              <div className="divide-y">
                {epicTasks.map((task) => {
                  const mem = task.assigneeId ? memberMap.get(task.assigneeId) : null;
                  return (
                    <div
                      key={task.id}
                      className="flex items-center gap-2.5 px-4 py-2 hover:bg-muted/30 cursor-pointer"
                      onClick={() => navigate(`/${slug}/projects/${projectId}/board`)}
                    >
                      <span className={cn("h-2 w-2 rounded-full shrink-0", STATUS_DOT_COLORS[task.status])} />
                      <span className="text-sm flex-1 truncate">{task.title}</span>
                      <PriorityIcon priority={task.priority} className="h-3.5 w-3.5 shrink-0" />
                      {mem && (
                        <Avatar className="h-5 w-5 shrink-0">
                          <AvatarImage src={mem.profile?.avatarUrl ?? undefined} />
                          <AvatarFallback className="text-[9px]">{getInitials(mem.profile?.name)}</AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{epic ? "Edit Epic" : "Create Epic"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Title *</Label>
            <Input placeholder="Epic title" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea placeholder="What's this epic about?" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as EpicStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(EPIC_STATUS_LABELS) as [EpicStatus, string][]).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {LABEL_COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setColor(c)}
                    className={cn("h-5 w-5 rounded-full border-2 transition-all",
                      color === c ? "border-foreground scale-110" : "border-transparent hover:border-muted-foreground")}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
          </div>
          {labels.length > 0 && (
            <div className="space-y-2">
              <Label>Labels</Label>
              <LabelPicker labels={labels} selectedIds={labelIds} onChange={setLabelIds} />
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={saving || !title.trim()} className="flex-1">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {epic ? "Save" : "Create"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
