import { useEffect, useState, useCallback, useMemo } from "react";
import { motion } from "motion/react";
import Markdown from "react-markdown";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Send, Clock, MessageSquare, ListChecks, History, Paperclip, Calendar, Signal, User, Hash, Tag, Layers, Zap, Copy, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseLocalDate } from "@/lib/date-utils";
import LabelPicker from "@/components/labels/LabelPicker";
import EpicPicker from "@/components/epics/EpicPicker";
import SprintPicker from "@/components/sprints/SprintPicker";
import SubtaskRow from "./SubtaskRow";
import MentionInput from "./MentionInput";
import TaskAttachments from "./TaskAttachments";
import { useAuthStore } from "@/store/auth";
import {
  subscribeToSubtasks, subscribeToComments, subscribeToTaskEvents,
  addSubtask, toggleSubtask, updateSubtask, deleteSubtask, addComment, updateTask, duplicateTask, softDeleteTask, getMemberProfiles, taskDoc,
} from "@/lib/firestore";
import { getDoc } from "firebase/firestore";
import { TASK_STATUS_LABELS, TASK_PRIORITY_LABELS, STORY_POINT_OPTIONS } from "@/lib/types";
import type { Task, Subtask, Comment, TaskEvent, Project, WorkspaceMember, Label, Epic, Sprint, TaskStatus, TaskPriority } from "@/lib/types";

function tsToDate(ts: unknown): Date {
  if (!ts) return new Date();
  if (typeof (ts as { toDate?: () => Date }).toDate === "function") return (ts as { toDate: () => Date }).toDate();
  if (typeof ts === "object" && ts !== null && "seconds" in ts) return new Date((ts as { seconds: number }).seconds * 1000);
  const d = new Date(ts as string | number);
  return isNaN(d.getTime()) ? new Date() : d;
}

function getInitials(name: string | null | undefined) {
  if (!name) return "?";
  return name.split(/\s/).map((s) => s[0]?.toUpperCase()).slice(0, 2).join("");
}

function eventLabel(ev: TaskEvent, members: Map<string, string>): string {
  const who = members.get(ev.userId ?? "") ?? "Someone";
  switch (ev.eventType) {
    case "created": return `${who} created this task`;
    case "status_changed": return `${who} moved to ${TASK_STATUS_LABELS[ev.newValue as TaskStatus] ?? ev.newValue}`;
    case "priority_changed": return `${who} set priority to ${TASK_PRIORITY_LABELS[ev.newValue as TaskPriority] ?? ev.newValue}`;
    case "assignee_changed": return `${who} changed assignee`;
    case "due_date_changed": return ev.newValue ? `${who} set due date to ${format(new Date(ev.newValue), "MMM d, yyyy")}` : `${who} removed due date`;
    case "title_changed": return `${who} renamed task`;
    case "label_changed": return `${who} updated labels`;
    case "story_points_changed": return `${who} set story points to ${ev.newValue ?? "none"}`;
    case "epic_changed": return `${who} changed epic`;
    case "sprint_changed": return `${who} changed sprint`;
    case "commented": return `${who} added a comment`;
    case "attachment_added": return `${who} attached "${ev.newValue}"`;
    case "attachment_removed": return `${who} removed "${ev.oldValue}"`;
    default: return `${who} updated the task`;
  }
}

function CommentBody({ body, memberNames }: { body: string; memberNames: Set<string> }) {
  // Split on @Name patterns and highlight matching ones
  const parts = body.split(/(@\S+(?:\s\S+)?)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("@")) {
          const name = part.slice(1);
          if (memberNames.has(name)) {
            return <span key={i} className="text-primary font-medium">{part}</span>;
          }
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

interface TaskDetailSheetProps {
  taskId: string | null;
  project: Project;
  workspaceId: string;
  members: WorkspaceMember[];
  labels: Label[];
  epics?: Epic[];
  sprints?: Sprint[];
  currentUserId: string;
  canEdit: boolean;
  isProjectAdmin?: boolean;
  onClose: () => void;
  onUpdated: (id: string, changes: Partial<Task>) => void;
}

export default function TaskDetailSheet({
  taskId, project, workspaceId, members, labels, epics = [], sprints = [], currentUserId, canEdit, isProjectAdmin = false, onClose, onUpdated,
}: TaskDetailSheetProps) {
  const [task, setTask] = useState<Task | null>(null);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [events, setEvents] = useState<TaskEvent[]>([]);
  const [memberNameMap, setMemberNameMap] = useState<Map<string, string>>(new Map());
  const memberNameSet = useMemo(() => {
    const s = new Set<string>();
    memberNameMap.forEach((name) => s.add(name));
    members.forEach((m) => { if (m.profile?.name) s.add(m.profile.name); });
    return s;
  }, [memberNameMap, members]);
  const memberAvatarMap = useMemo(() => {
    const m = new Map<string, string | undefined>();
    members.forEach((mem) => m.set(mem.userId, mem.profile?.avatarUrl ?? undefined));
    return m;
  }, [members]);
  const [commentText, setCommentText] = useState("");
  const [newSubtask, setNewSubtask] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState("comments");

  // Build member name map for event labels (js-index-maps rule)
  useEffect(() => {
    const ids = members.map((m) => m.userId);
    if (ids.length === 0) return;
    getMemberProfiles(ids).then((map) => {
      const nameMap = new Map<string, string>();
      map.forEach((p, id) => nameMap.set(id, p.name ?? "Unknown"));
      setMemberNameMap(nameMap);
    });
  }, [members]);

  useEffect(() => {
    if (!taskId) { setTask(null); return; }
    // Load initial task data
    getDoc(taskDoc(workspaceId, project.id, taskId)).then((snap) => {
      if (snap.exists()) {
        const t = { id: snap.id, ...snap.data() } as Task;
        setTask(t);
        setTitleDraft(t.title);
        setDescDraft(t.description ?? "");
      }
    });

    // Subscribe to subcollections in parallel
    const unsubs = [
      subscribeToSubtasks(workspaceId, project.id, taskId, setSubtasks),
      subscribeToComments(workspaceId, project.id, taskId, setComments),
      subscribeToTaskEvents(workspaceId, project.id, taskId, setEvents),
    ];
    return () => unsubs.forEach((u) => u());
  }, [taskId, workspaceId, project.id]);

  const updateField = useCallback(async (field: string, value: unknown) => {
    if (!task) return;
    const changes = { [field]: value } as Partial<Task>;
    const actorName = useAuthStore.getState().user?.displayName ?? "Someone";
    await updateTask(workspaceId, project.id, task.id, changes, currentUserId, task, { actorName });
    setTask((prev) => prev ? { ...prev, ...changes } : prev);
    onUpdated(task.id, changes);
  }, [task, workspaceId, project.id, currentUserId, onUpdated]);

  const handleTitleSave = async () => {
    if (!titleDraft.trim() || titleDraft === task?.title) { setEditingTitle(false); return; }
    await updateField("title", titleDraft.trim());
    setEditingTitle(false);
  };

  const handleDescSave = async () => {
    if (descDraft === (task?.description ?? "")) { setEditingDesc(false); return; }
    await updateField("description", descDraft.trim());
    setEditingDesc(false);
  };

  const handleSubtaskToggle = async (s: Subtask) => {
    const next = s.status === "open" ? "closed" : "open";
    await toggleSubtask(workspaceId, project.id, task!.id, s.id, next);
    setSubtasks((prev) => prev.map((st) => st.id === s.id ? { ...st, status: next } : st));
  };

  const handleAddSubtask = async () => {
    if (!newSubtask.trim() || !task) return;
    const s = await addSubtask(workspaceId, project.id, task.id, newSubtask.trim(), subtasks.length);
    setSubtasks((prev) => [...prev, s]);
    setNewSubtask("");
  };

  const handleSubtaskUpdate = async (subtaskId: string, changes: Partial<Subtask>) => {
    if (!task) return;
    await updateSubtask(workspaceId, project.id, task.id, subtaskId, changes);
    setSubtasks((prev) => prev.map((st) => st.id === subtaskId ? { ...st, ...changes } : st));
  };

  const handleSubtaskDelete = async (subtaskId: string) => {
    if (!task) return;
    await deleteSubtask(workspaceId, project.id, task.id, subtaskId);
    setSubtasks((prev) => prev.filter((st) => st.id !== subtaskId));
  };

  const handleDuplicate = async () => {
    if (!task) return;
    try {
      await duplicateTask(workspaceId, project.id, task, currentUserId);
      toast.success("Task duplicated");
    } catch { toast.error("Failed to duplicate task"); }
  };

  const handleDelete = async () => {
    if (!task) return;
    try {
      await softDeleteTask(workspaceId, project.id, task.id);
      toast.success("Task deleted");
      onClose();
    } catch { toast.error("Failed to delete task"); }
  };

  const handleComment = async () => {
    if (!commentText.trim() || !task) return;
    setSending(true);
    try {
      const actorName = useAuthStore.getState().user?.displayName ?? "Someone";
      const memberNameToId = new Map<string, string>();
      members.forEach((m) => { if (m.profile?.name) memberNameToId.set(m.profile.name, m.userId); });
      const c = await addComment(workspaceId, project.id, task.id, currentUserId, commentText.trim(), {
        actorName,
        taskTitle: task.title,
        memberNameToId,
      });
      setComments((prev) => [...prev, c]);
      setCommentText("");
    } catch { toast.error("Failed to post comment"); }
    finally { setSending(false); }
  };

  if (!taskId) return null;

  return (
    <Sheet open={!!taskId} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-3xl overflow-hidden flex flex-col p-0 gap-0">
        {!task ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-6 w-3/4" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="flex-1 overflow-hidden flex flex-col"
          >
            {/* Title header */}
            <div className="px-6 pt-5 pb-4 border-b shrink-0">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs text-muted-foreground">
                  Created {formatDistanceToNow(tsToDate(task.createdAt), { addSuffix: true })}
                </p>
                {canEdit && (
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleDuplicate}>
                      <Copy className="mr-1.5 h-3.5 w-3.5" />Duplicate
                    </Button>
                    {isProjectAdmin && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive">
                            <Trash2 className="mr-1.5 h-3.5 w-3.5" />Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete task</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will delete &ldquo;{task.title}&rdquo;. The task will be removed from all views.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                )}
              </div>
              {editingTitle ? (
                <Input value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={handleTitleSave} onKeyDown={(e) => e.key === "Enter" && handleTitleSave()}
                  className="text-lg font-semibold" autoFocus />
              ) : (
                <h2 className={cn("text-lg font-semibold leading-snug", canEdit && "cursor-pointer hover:text-primary transition-colors")}
                  onClick={() => canEdit && setEditingTitle(true)}>
                  {task.title}
                </h2>
              )}
            </div>

            {/* Two-panel layout */}
            <div className="flex-1 overflow-hidden flex">
              {/* Left panel — description + tabs */}
              <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto">
                  {/* Description */}
                  <div className="px-6 py-4">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Description</p>
                    {editingDesc ? (
                      <Textarea value={descDraft} onChange={(e) => setDescDraft(e.target.value)}
                        onBlur={handleDescSave} placeholder="Add a description..."
                        className="text-sm min-h-[80px]" autoFocus />
                    ) : task.description ? (
                      <div
                        className={cn("prose prose-sm dark:prose-invert max-w-none text-muted-foreground prose-headings:text-foreground prose-strong:text-foreground prose-code:text-foreground prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded-sm prose-code:before:content-none prose-code:after:content-none",
                          canEdit && "cursor-pointer hover:text-foreground transition-colors rounded-md")}
                        onClick={() => { if (canEdit) { setDescDraft(task.description ?? ""); setEditingDesc(true); } }}
                      >
                        <Markdown>{task.description}</Markdown>
                      </div>
                    ) : (
                      <p className={cn("text-sm text-muted-foreground italic",
                          canEdit && "cursor-pointer hover:text-foreground transition-colors rounded-md")}
                        onClick={() => { if (canEdit) { setDescDraft(task.description ?? ""); setEditingDesc(true); } }}>
                        {canEdit ? "Click to add a description..." : "No description"}
                      </p>
                    )}
                  </div>

                  <Separator />

                  {/* Tabs */}
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col">
                    <TabsList className="mx-6 mt-3 w-auto justify-start">
                      <TabsTrigger value="comments"><MessageSquare className="mr-1.5 h-3.5 w-3.5" />Comments ({comments.length})</TabsTrigger>
                      <TabsTrigger value="subtasks"><ListChecks className="mr-1.5 h-3.5 w-3.5" />Subtasks ({subtasks.length})</TabsTrigger>
                      <TabsTrigger value="attachments"><Paperclip className="mr-1.5 h-3.5 w-3.5" />Files ({task.attachments?.length ?? 0})</TabsTrigger>
                      <TabsTrigger value="history"><Clock className="mr-1.5 h-3.5 w-3.5" />History</TabsTrigger>
                    </TabsList>

                    <TabsContent value="comments" className="mt-0 px-6">
                      <div className="py-3">
                        {comments.length === 0 ? (
                          <EmptyState icon={MessageSquare} title="No comments yet" description="Start the conversation" className="py-6" />
                        ) : (
                          <div className="space-y-4">
                            {comments.map((c) => (
                              <div key={c.id} className="flex gap-3">
                                <Avatar className="h-7 w-7 shrink-0">
                                  <AvatarImage src={c.author?.avatarUrl ?? memberAvatarMap.get(c.userId)} />
                                  <AvatarFallback className="text-xs">{getInitials(c.author?.name ?? memberNameMap.get(c.userId))}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-baseline gap-2">
                                    <span className="text-sm font-medium">{c.author?.name ?? memberNameMap.get(c.userId) ?? "Unknown"}</span>
                                    <span className="text-xs text-muted-foreground">{formatDistanceToNow(tsToDate(c.createdAt), { addSuffix: true })}</span>
                                  </div>
                                  <p className="text-sm mt-0.5 text-muted-foreground">
                                    <CommentBody body={c.body} memberNames={memberNameSet} />
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent value="subtasks" className="mt-0 px-6">
                      <div className="py-3">
                        {subtasks.length === 0 ? (
                          <EmptyState icon={ListChecks} title="No subtasks yet" description="Break this task into smaller steps" className="py-6" />
                        ) : (
                          <div className="space-y-1">
                            {subtasks.map((s) => (
                              <SubtaskRow
                                key={s.id}
                                subtask={s}
                                members={members}
                                canEdit={canEdit}
                                onToggle={() => handleSubtaskToggle(s)}
                                onUpdate={(changes) => handleSubtaskUpdate(s.id, changes)}
                                onDelete={() => handleSubtaskDelete(s.id)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent value="attachments" className="mt-0 px-6">
                      <TaskAttachments
                        attachments={task.attachments ?? []}
                        workspaceId={workspaceId}
                        projectId={project.id}
                        taskId={task.id}
                        currentUserId={currentUserId}
                        canEdit={canEdit}
                        onAttachmentsChange={(updated) => setTask((prev) => prev ? { ...prev, attachments: updated } : prev)}
                      />
                    </TabsContent>

                    <TabsContent value="history" className="mt-0 px-6">
                      <div className="py-3">
                        {events.length === 0 ? (
                          <EmptyState icon={History} title="No history yet" description="Changes to this task will be tracked here" className="py-6" />
                        ) : (
                          <div className="space-y-3">
                            {events.map((ev) => (
                              <div key={ev.id} className="flex gap-3">
                                <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground mt-2 shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm">{eventLabel(ev, memberNameMap)}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">{formatDistanceToNow(tsToDate(ev.createdAt), { addSuffix: true })}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>

                {/* Fixed bottom input bars */}
                {activeTab === "comments" && (
                  <div className="shrink-0 py-3 flex gap-2 border-t px-6 bg-background">
                    <MentionInput
                      placeholder="Add a comment... (type @ to mention)"
                      value={commentText}
                      onChange={setCommentText}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleComment(); } }}
                      members={members}
                      className="flex-1"
                    />
                    <Button size="icon" onClick={handleComment} disabled={!commentText.trim() || sending}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                {activeTab === "subtasks" && canEdit && (
                  <div className="shrink-0 py-3 flex gap-2 border-t px-6 bg-background">
                    <Input placeholder="Add subtask..." value={newSubtask} onChange={(e) => setNewSubtask(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddSubtask()} className="flex-1" />
                    <Button size="icon" variant="outline" onClick={handleAddSubtask} disabled={!newSubtask.trim()}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Right sidebar — metadata */}
              <div className="w-64 shrink-0 border-l overflow-y-auto bg-muted/30">
                <div className="p-4 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Details</p>

                  {/* Status */}
                  <div className="flex items-center gap-2 py-1.5">
                    <Signal className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground w-16 shrink-0">Status</span>
                    <Select value={task.status} onValueChange={(v) => updateField("status", v)} disabled={!canEdit}>
                      <SelectTrigger className="h-7 text-xs flex-1 border-0 bg-transparent shadow-none px-1.5 hover:bg-muted"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.entries(TASK_STATUS_LABELS) as [string, string][]).map(([v, l]) => (
                          <SelectItem key={v} value={v}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Priority */}
                  <div className="flex items-center gap-2 py-1.5">
                    <Signal className="h-3.5 w-3.5 text-muted-foreground shrink-0 rotate-180" />
                    <span className="text-xs text-muted-foreground w-16 shrink-0">Priority</span>
                    <Select value={task.priority} onValueChange={(v) => updateField("priority", v)} disabled={!canEdit}>
                      <SelectTrigger className="h-7 text-xs flex-1 border-0 bg-transparent shadow-none px-1.5 hover:bg-muted"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.entries(TASK_PRIORITY_LABELS) as [string, string][]).map(([v, l]) => (
                          <SelectItem key={v} value={v}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Assignee */}
                  <div className="flex items-center gap-2 py-1.5">
                    <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground w-16 shrink-0">Assignee</span>
                    <Select value={task.assigneeId ?? "unassigned"} onValueChange={(v) => updateField("assigneeId", v === "unassigned" ? null : v)} disabled={!canEdit}>
                      <SelectTrigger className="h-7 text-xs flex-1 border-0 bg-transparent shadow-none px-1.5 hover:bg-muted"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {members.map((m) => <SelectItem key={m.userId} value={m.userId}>{m.profile?.name ?? "Unknown"}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Due date */}
                  <div className="flex items-center gap-2 py-1.5">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground w-16 shrink-0">Due date</span>
                    <Input type="date" className="h-7 text-xs flex-1 border-0 bg-transparent shadow-none px-1.5 hover:bg-muted"
                      value={task.dueDate ? format(tsToDate(task.dueDate), "yyyy-MM-dd") : ""}
                      onChange={(e) => updateField("dueDate", e.target.value ? parseLocalDate(e.target.value) : null)}
                      disabled={!canEdit} />
                  </div>

                  {/* Story Points */}
                  <div className="flex items-center gap-2 py-1.5">
                    <Hash className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground w-16 shrink-0">Points</span>
                    <Select
                      value={task.storyPoints != null ? String(task.storyPoints) : "none"}
                      onValueChange={(v) => updateField("storyPoints", v === "none" ? null : Number(v))}
                      disabled={!canEdit}
                    >
                      <SelectTrigger className="h-7 text-xs flex-1 border-0 bg-transparent shadow-none px-1.5 hover:bg-muted"><SelectValue placeholder="None" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {STORY_POINT_OPTIONS.map((v) => (
                          <SelectItem key={v} value={String(v)}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator className="my-2" />

                  {/* Labels */}
                  <div className="py-1.5">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs text-muted-foreground">Labels</span>
                    </div>
                    <LabelPicker
                      labels={labels}
                      selectedIds={task.labelIds ?? []}
                      onChange={(ids) => updateField("labelIds", ids)}
                      disabled={!canEdit}
                      workspaceId={workspaceId}
                      projectId={project.id}
                    />
                  </div>

                  {/* Epic */}
                  {epics.length > 0 && (
                    <div className="py-1.5">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Layers className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-xs text-muted-foreground">Epic</span>
                      </div>
                      <EpicPicker
                        epics={epics}
                        selectedId={task.epicId ?? null}
                        onChange={(id) => updateField("epicId", id)}
                        disabled={!canEdit}
                      />
                    </div>
                  )}

                  {/* Sprint */}
                  {sprints.length > 0 && (
                    <div className="py-1.5">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Zap className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-xs text-muted-foreground">Sprint</span>
                      </div>
                      <SprintPicker
                        sprints={sprints}
                        selectedId={task.sprintId ?? null}
                        onChange={(id) => updateField("sprintId", id)}
                        disabled={!canEdit}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </SheetContent>
    </Sheet>
  );
}
