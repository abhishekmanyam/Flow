import { useEffect, useState, useCallback, useMemo } from "react";
import Markdown from "react-markdown";
import { Dialog } from "@astryxdesign/core/Dialog";
import { Layout, LayoutContent } from "@astryxdesign/core/Layout";
import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { MetadataList, MetadataListItem } from "@astryxdesign/core/MetadataList";
import { TabList, Tab } from "@astryxdesign/core/TabList";
import { Selector } from "@astryxdesign/core/Selector";
import { DateInput } from "@astryxdesign/core/DateInput";
import { Button } from "@astryxdesign/core/Button";
import { IconButton } from "@astryxdesign/core/IconButton";
import { TextInput } from "@astryxdesign/core/TextInput";
import { TextArea } from "@astryxdesign/core/TextArea";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { Avatar } from "@astryxdesign/core/Avatar";
import { Badge } from "@astryxdesign/core/Badge";
import { Icon } from "@astryxdesign/core/Icon";
import { Spinner } from "@astryxdesign/core/Spinner";
import { Divider } from "@astryxdesign/core/Divider";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Timestamp as TimestampText } from "@astryxdesign/core/Timestamp";
import { format } from "date-fns";
import {
  MessageSquare, ListChecks, History, Paperclip, Signal, User, Hash, Tag, Layers, Zap,
  Copy, Trash2, Send, Plus, Pencil, Calendar, X,
} from "lucide-react";
import { parseLocalDate } from "@/lib/date-utils";
import LabelPicker from "@/components/labels/LabelPicker";
import EpicPicker from "@/components/epics/EpicPicker";
import SprintPicker from "@/components/sprints/SprintPicker";
import SubtaskRow from "./SubtaskRow";
import MentionInput from "./MentionInput";
import TaskAttachments from "./TaskAttachments";
import { toast } from "@/components/system/toast";
import { useAuthStore } from "@/store/auth";
import {
  subscribeToSubtasks, subscribeToComments, subscribeToTaskEvents,
  addSubtask, toggleSubtask, updateSubtask, deleteSubtask, addComment, updateTask, duplicateTask, softDeleteTask, getMemberProfiles, taskDoc,
} from "@/lib/firestore";
import { getDoc } from "firebase/firestore";
import { TASK_STATUS_LABELS, TASK_PRIORITY_LABELS, STORY_POINT_OPTIONS } from "@/lib/types";
import type { Task, Subtask, Comment, TaskEvent, Project, WorkspaceMember, Label, Epic, Sprint, TaskStatus, TaskPriority } from "@/lib/types";
import type { ISODateString } from "@astryxdesign/core/Calendar";

function tsToDate(ts: unknown): Date {
  if (!ts) return new Date();
  if (typeof (ts as { toDate?: () => Date }).toDate === "function") return (ts as { toDate: () => Date }).toDate();
  if (typeof ts === "object" && ts !== null && "seconds" in ts) return new Date((ts as { seconds: number }).seconds * 1000);
  const d = new Date(ts as string | number);
  return isNaN(d.getTime()) ? new Date() : d;
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
  const parts = body.split(/(@\S+(?:\s\S+)?)/g);
  return (
    <Text type="body">
      {parts.map((part, i) => {
        if (part.startsWith("@")) {
          const name = part.slice(1);
          if (memberNames.has(name)) {
            return <Text key={i} as="span" color="accent" weight="medium">{part}</Text>;
          }
        }
        return <Text key={i} as="span" color="secondary">{part}</Text>;
      })}
    </Text>
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
  const [deleteOpen, setDeleteOpen] = useState(false);

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
    getDoc(taskDoc(workspaceId, project.id, taskId)).then((snap) => {
      if (snap.exists()) {
        const t = { id: snap.id, ...snap.data() } as Task;
        setTask(t);
        setTitleDraft(t.title);
        setDescDraft(t.description ?? "");
      }
    });

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
      setDeleteOpen(false);
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
    <>
    <Dialog
      isOpen={!!taskId}
      onOpenChange={(v) => !v && onClose()}
      width={460}
      maxHeight="100vh"
      position={{ top: 0, right: 0, bottom: 0 }}
    >
      {!task ? (
        <VStack padding={6} gap={3} align="center" justify="center" minHeight={200}>
          <Spinner label="Loading task…" />
        </VStack>
      ) : (
        <Layout
          header={
            <VStack gap={2} padding={4}>
              <HStack justify="between" align="center">
                <HStack gap={1} align="center">
                  <Text type="supporting" color="secondary">Created</Text>
                  <TimestampText value={tsToDate(task.createdAt).toISOString()} format="relative" type="supporting" />
                </HStack>
                <HStack gap={1} align="center">
                  {canEdit && (
                    <Button label="Duplicate" variant="ghost" size="sm" icon={<Copy />} onClick={handleDuplicate} />
                  )}
                  {canEdit && isProjectAdmin && (
                    <IconButton label="Delete task" tooltip="Delete" variant="ghost" size="sm" icon={<Trash2 />} onClick={() => setDeleteOpen(true)} />
                  )}
                  <IconButton label="Close" tooltip="Close" variant="ghost" size="sm" icon={<X />} onClick={onClose} />
                </HStack>
              </HStack>
              {editingTitle && canEdit ? (
                <TextInput
                  label="Task title"
                  isLabelHidden
                  value={titleDraft}
                  onChange={setTitleDraft}
                  hasAutoFocus
                />
              ) : (
                <HStack gap={1} align="center" justify="between">
                  <Heading level={2} maxLines={3}>{task.title}</Heading>
                  {canEdit && (
                    <IconButton label="Edit title" tooltip="Edit title" variant="ghost" size="sm" icon={<Pencil />} onClick={() => { setTitleDraft(task.title); setEditingTitle(true); }} />
                  )}
                </HStack>
              )}
              {editingTitle && canEdit && (
                <HStack gap={2}>
                  <Button label="Save" variant="primary" size="sm" onClick={handleTitleSave} />
                  <Button label="Cancel" variant="ghost" size="sm" onClick={() => setEditingTitle(false)} />
                </HStack>
              )}
            </VStack>
          }
          content={
            <LayoutContent padding={4}>
              <VStack gap={4}>
                {/* Field rows */}
                <MetadataList label={{ position: "start", width: 96 }}>
                  <MetadataListItem label="Status" icon={<Icon icon={Signal} size="sm" />}>
                    <Selector
                      label="Status"
                      isLabelHidden
                      size="sm"
                      value={task.status}
                      onChange={(v) => updateField("status", v)}
                      isDisabled={!canEdit}
                      options={(Object.entries(TASK_STATUS_LABELS) as [string, string][]).map(([v, l]) => ({ value: v, label: l }))}
                    />
                  </MetadataListItem>
                  <MetadataListItem label="Priority" icon={<Icon icon={Signal} size="sm" />}>
                    <Selector
                      label="Priority"
                      isLabelHidden
                      size="sm"
                      value={task.priority}
                      onChange={(v) => updateField("priority", v)}
                      isDisabled={!canEdit}
                      options={(Object.entries(TASK_PRIORITY_LABELS) as [string, string][]).map(([v, l]) => ({ value: v, label: l }))}
                    />
                  </MetadataListItem>
                  <MetadataListItem label="Assignee" icon={<Icon icon={User} size="sm" />}>
                    <Selector
                      label="Assignee"
                      isLabelHidden
                      size="sm"
                      placeholder="Unassigned"
                      value={task.assigneeId ?? "unassigned"}
                      onChange={(v) => updateField("assigneeId", v === "unassigned" ? null : v)}
                      isDisabled={!canEdit}
                      options={[
                        { value: "unassigned", label: "Unassigned" },
                        ...members.map((m) => ({ value: m.userId, label: m.profile?.name ?? "Unknown" })),
                      ]}
                    />
                  </MetadataListItem>
                  <MetadataListItem label="Due date" icon={<Icon icon={Calendar} size="sm" />}>
                    <DateInput
                      label="Due date"
                      isLabelHidden
                      size="sm"
                      hasClear
                      value={task.dueDate ? (format(tsToDate(task.dueDate), "yyyy-MM-dd") as ISODateString) : undefined}
                      onChange={(v) => updateField("dueDate", v ? parseLocalDate(v) : null)}
                      isDisabled={!canEdit}
                    />
                  </MetadataListItem>
                  <MetadataListItem label="Points" icon={<Icon icon={Hash} size="sm" />}>
                    <Selector
                      label="Story points"
                      isLabelHidden
                      size="sm"
                      placeholder="None"
                      value={task.storyPoints != null ? String(task.storyPoints) : "none"}
                      onChange={(v) => updateField("storyPoints", v === "none" ? null : Number(v))}
                      isDisabled={!canEdit}
                      options={[{ value: "none", label: "None" }, ...STORY_POINT_OPTIONS.map((v) => ({ value: String(v), label: String(v) }))]}
                    />
                  </MetadataListItem>
                  <MetadataListItem label="Labels" icon={<Icon icon={Tag} size="sm" />}>
                    <LabelPicker
                      labels={labels}
                      selectedIds={task.labelIds ?? []}
                      onChange={(ids) => updateField("labelIds", ids)}
                      disabled={!canEdit}
                      workspaceId={workspaceId}
                      projectId={project.id}
                    />
                  </MetadataListItem>
                  {epics.length > 0 && (
                    <MetadataListItem label="Epic" icon={<Icon icon={Layers} size="sm" />}>
                      <EpicPicker epics={epics} selectedId={task.epicId ?? null} onChange={(id) => updateField("epicId", id)} disabled={!canEdit} />
                    </MetadataListItem>
                  )}
                  {sprints.length > 0 && (
                    <MetadataListItem label="Sprint" icon={<Icon icon={Zap} size="sm" />}>
                      <SprintPicker sprints={sprints} selectedId={task.sprintId ?? null} onChange={(id) => updateField("sprintId", id)} disabled={!canEdit} />
                    </MetadataListItem>
                  )}
                </MetadataList>

                <Divider />

                {/* Description */}
                <VStack gap={2}>
                  <Text type="label" color="secondary">Description</Text>
                  {editingDesc ? (
                    <VStack gap={2}>
                      <TextArea label="Description" isLabelHidden value={descDraft} onChange={setDescDraft} placeholder="Add a description..." rows={4} hasAutoFocus />
                      <HStack gap={2}>
                        <Button label="Save" variant="primary" size="sm" onClick={handleDescSave} />
                        <Button label="Cancel" variant="ghost" size="sm" onClick={() => setEditingDesc(false)} />
                      </HStack>
                    </VStack>
                  ) : task.description ? (
                    <HStack gap={2} align="start" justify="between">
                      <VStack gap={1}>
                        <Markdown>{task.description}</Markdown>
                      </VStack>
                      {canEdit && (
                        <IconButton label="Edit description" tooltip="Edit" variant="ghost" size="sm" icon={<Pencil />} onClick={() => { setDescDraft(task.description ?? ""); setEditingDesc(true); }} />
                      )}
                    </HStack>
                  ) : (
                    <Button
                      label={canEdit ? "Add a description..." : "No description"}
                      variant="ghost"
                      size="sm"
                      isDisabled={!canEdit}
                      onClick={() => { setDescDraft(task.description ?? ""); setEditingDesc(true); }}
                    />
                  )}
                </VStack>

                <Divider />

                {/* Activity tabs */}
                <TabList value={activeTab} onChange={setActiveTab} size="sm" hasDivider>
                  <Tab value="comments" label="Comments" icon={<MessageSquare />} endContent={comments.length ? <Badge variant="neutral" label={String(comments.length)} /> : undefined} />
                  <Tab value="subtasks" label="Subtasks" icon={<ListChecks />} endContent={subtasks.length ? <Badge variant="neutral" label={String(subtasks.length)} /> : undefined} />
                  <Tab value="attachments" label="Files" icon={<Paperclip />} endContent={task.attachments?.length ? <Badge variant="neutral" label={String(task.attachments.length)} /> : undefined} />
                  <Tab value="history" label="History" icon={<History />} />
                </TabList>

                {activeTab === "comments" && (
                  <VStack gap={3}>
                    {comments.length === 0 ? (
                      <EmptyState icon={<MessageSquare />} title="No comments yet" description="Start the conversation" isCompact />
                    ) : (
                      <VStack gap={3}>
                        {comments.map((c) => (
                          <HStack key={c.id} gap={2} align="start">
                            <Avatar size="small" name={c.author?.name ?? memberNameMap.get(c.userId) ?? undefined} src={c.author?.avatarUrl ?? memberAvatarMap.get(c.userId)} />
                            <VStack gap={0} width="fill">
                              <HStack gap={2} align="center">
                                <Text type="label">{c.author?.name ?? memberNameMap.get(c.userId) ?? "Unknown"}</Text>
                                <TimestampText value={tsToDate(c.createdAt).toISOString()} format="relative" type="supporting" size="2xs" />
                              </HStack>
                              <CommentBody body={c.body} memberNames={memberNameSet} />
                            </VStack>
                          </HStack>
                        ))}
                      </VStack>
                    )}
                    <HStack gap={2} align="end">
                      <HStack width="fill">
                        <MentionInput
                          placeholder="Add a comment... (type @ to mention)"
                          value={commentText}
                          onChange={setCommentText}
                          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleComment(); } }}
                          members={members}
                        />
                      </HStack>
                      <IconButton label="Send comment" tooltip="Send" variant="primary" icon={<Send />} isDisabled={!commentText.trim() || sending} isLoading={sending} onClick={handleComment} />
                    </HStack>
                  </VStack>
                )}

                {activeTab === "subtasks" && (
                  <VStack gap={2}>
                    {canEdit && (
                      <HStack gap={2} align="end">
                        <HStack width="fill">
                          <TextInput label="New subtask" isLabelHidden placeholder="Add subtask..." value={newSubtask} onChange={setNewSubtask} />
                        </HStack>
                        <IconButton label="Add subtask" tooltip="Add" variant="secondary" icon={<Plus />} isDisabled={!newSubtask.trim()} onClick={handleAddSubtask} />
                      </HStack>
                    )}
                    {subtasks.length === 0 ? (
                      <EmptyState icon={<ListChecks />} title="No subtasks yet" description="Break this task into smaller steps" isCompact />
                    ) : (
                      <VStack gap={1}>
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
                      </VStack>
                    )}
                  </VStack>
                )}

                {activeTab === "attachments" && (
                  <TaskAttachments
                    attachments={task.attachments ?? []}
                    workspaceId={workspaceId}
                    projectId={project.id}
                    taskId={task.id}
                    currentUserId={currentUserId}
                    canEdit={canEdit}
                    onAttachmentsChange={(updated) => setTask((prev) => prev ? { ...prev, attachments: updated } : prev)}
                  />
                )}

                {activeTab === "history" && (
                  events.length === 0 ? (
                    <EmptyState icon={<History />} title="No history yet" description="Changes to this task will be tracked here" isCompact />
                  ) : (
                    <VStack gap={2}>
                      {events.map((ev) => (
                        <HStack key={ev.id} gap={2} align="start">
                          <Icon icon={History} size="sm" color="secondary" />
                          <VStack gap={0} width="fill">
                            <Text type="body">{eventLabel(ev, memberNameMap)}</Text>
                            <TimestampText value={tsToDate(ev.createdAt).toISOString()} format="relative" type="supporting" size="2xs" />
                          </VStack>
                        </HStack>
                      ))}
                    </VStack>
                  )
                )}
              </VStack>
            </LayoutContent>
          }
        />
      )}
    </Dialog>

      <AlertDialog
        isOpen={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete task"
        description={task ? `This will delete "${task.title}". The task will be removed from all views.` : "This will delete the task."}
        actionLabel="Delete"
        onAction={handleDelete}
      />
    </>
  );
}
