/**
 * Firestore collection/document path helpers.
 * Centralises all path logic so components never construct paths manually.
 */
import {
  collection,
  collectionGroup,
  doc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  setDoc,
  updateDoc,
  getDocs,
  getDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  arrayUnion,
  arrayRemove,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import type {
  Workspace,
  UserProfile,
  WorkspaceMember,
  Project,
  ProjectMember,
  ProjectNote,
  Task,
  TaskAttachment,
  Subtask,
  TaskEvent,
  Comment,
  Invite,
  Notification,
  Label,
  Epic,
  Sprint,
  ClockEntry,
  CalendarEvent,
  EventRegistration,
  SprintStatus,
  Role,
  ProjectRole,
  TaskEventType,
  TaskPriority,
} from "./types";

// ─── Collection refs ──────────────────────────────────────────────────────────

export const workspacesCol = () => collection(db, "workspaces");
export const workspaceDoc = (wsId: string) => doc(db, "workspaces", wsId);

export const membersCol = (wsId: string) =>
  collection(db, "workspaces", wsId, "members");
export const memberDoc = (wsId: string, uid: string) =>
  doc(db, "workspaces", wsId, "members", uid);

export const invitesCol = (wsId: string) =>
  collection(db, "workspaces", wsId, "invites");
export const inviteDoc = (wsId: string, invId: string) =>
  doc(db, "workspaces", wsId, "invites", invId);

export const projectsCol = (wsId: string) =>
  collection(db, "workspaces", wsId, "projects");
export const projectDoc = (wsId: string, projId: string) =>
  doc(db, "workspaces", wsId, "projects", projId);

export const projectMembersCol = (wsId: string, projId: string) =>
  collection(db, "workspaces", wsId, "projects", projId, "project_members");
export const projectMemberDoc = (wsId: string, projId: string, uid: string) =>
  doc(db, "workspaces", wsId, "projects", projId, "project_members", uid);

export const labelsCol = (wsId: string, projId: string) =>
  collection(db, "workspaces", wsId, "projects", projId, "labels");
export const labelDoc = (wsId: string, projId: string, labelId: string) =>
  doc(db, "workspaces", wsId, "projects", projId, "labels", labelId);

export const epicsCol = (wsId: string, projId: string) =>
  collection(db, "workspaces", wsId, "projects", projId, "epics");
export const epicDoc = (wsId: string, projId: string, epicId: string) =>
  doc(db, "workspaces", wsId, "projects", projId, "epics", epicId);

export const sprintsCol = (wsId: string, projId: string) =>
  collection(db, "workspaces", wsId, "projects", projId, "sprints");
export const sprintDoc = (wsId: string, projId: string, sprintId: string) =>
  doc(db, "workspaces", wsId, "projects", projId, "sprints", sprintId);

export const tasksCol = (wsId: string, projId: string) =>
  collection(db, "workspaces", wsId, "projects", projId, "tasks");
export const taskDoc = (wsId: string, projId: string, taskId: string) =>
  doc(db, "workspaces", wsId, "projects", projId, "tasks", taskId);

export const subtasksCol = (wsId: string, projId: string, taskId: string) =>
  collection(
    db,
    "workspaces",
    wsId,
    "projects",
    projId,
    "tasks",
    taskId,
    "subtasks"
  );

export const eventsCol = (wsId: string, projId: string, taskId: string) =>
  collection(
    db,
    "workspaces",
    wsId,
    "projects",
    projId,
    "tasks",
    taskId,
    "events"
  );

export const commentsCol = (wsId: string, projId: string, taskId: string) =>
  collection(
    db,
    "workspaces",
    wsId,
    "projects",
    projId,
    "tasks",
    taskId,
    "comments"
  );

export const usersCol = () => collection(db, "users");
export const userDoc = (uid: string) => doc(db, "users", uid);

export const notesCol = (wsId: string, projId: string) =>
  collection(db, "workspaces", wsId, "projects", projId, "notes");
export const noteDoc = (wsId: string, projId: string, noteId: string) =>
  doc(db, "workspaces", wsId, "projects", projId, "notes", noteId);

export const notificationsCol = (uid: string) =>
  collection(db, "users", uid, "notifications");

export const attendanceCol = (wsId: string) =>
  collection(db, "workspaces", wsId, "attendance");
export const attendanceDoc = (wsId: string, entryId: string) =>
  doc(db, "workspaces", wsId, "attendance", entryId);

export const calendarEventsCol = (wsId: string) =>
  collection(db, "workspaces", wsId, "calendar_events");
export const calendarEventDoc = (wsId: string, eventId: string) =>
  doc(db, "workspaces", wsId, "calendar_events", eventId);
export const registrationsCol = (wsId: string, eventId: string) =>
  collection(db, "workspaces", wsId, "calendar_events", eventId, "registrations");
export const registrationDoc = (wsId: string, eventId: string, regId: string) =>
  doc(db, "workspaces", wsId, "calendar_events", eventId, "registrations", regId);

// ─── Workspace ops ────────────────────────────────────────────────────────────

export async function createWorkspace(
  name: string,
  slug: string,
  userId: string
): Promise<Workspace> {
  const wsRef = doc(workspacesCol());
  const ws = {
    id: wsRef.id,
    name,
    slug,
    createdAt: serverTimestamp(),
  };
  const batch = writeBatch(db);
  batch.set(wsRef, ws);
  batch.set(memberDoc(wsRef.id, userId), {
    userId,
    role: "admin",
    joinedAt: serverTimestamp(),
  });
  await batch.commit();
  return ws as unknown as Workspace;
}

export async function getWorkspaceBySlug(
  slug: string
): Promise<Workspace | null> {
  const q = query(workspacesCol(), where("slug", "==", slug));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as Workspace;
}

export async function getUserWorkspace(
  userId: string
): Promise<{ workspace: Workspace; role: Role } | null> {
  // Find workspaces where user is a member (search across all workspaces)
  // We store a denormalized workspaceIds array on user profile for fast lookup
  const userSnap = await getDoc(userDoc(userId));
  if (!userSnap.exists()) {
    console.warn("[getUserWorkspace] no user profile for", userId);
    return null;
  }
  const userData = userSnap.data() as UserProfile & {
    workspaceIds?: string[];
  };
  if (!userData.workspaceIds?.length) {
    console.warn("[getUserWorkspace] no workspaceIds for", userId);
    return null;
  }

  const wsId = userData.workspaceIds[0];
  const [wsSnap, memberSnap] = await Promise.all([
    getDoc(workspaceDoc(wsId)),
    getDoc(memberDoc(wsId, userId)),
  ]);
  if (!wsSnap.exists() || !memberSnap.exists()) {
    console.warn("[getUserWorkspace] workspace or member doc missing", { wsId, wsExists: wsSnap.exists(), memberExists: memberSnap.exists() });
    return null;
  }
  return {
    workspace: { id: wsSnap.id, ...wsSnap.data() } as Workspace,
    role: memberSnap.data().role as Role,
  };
}

export async function updateWorkspace(
  wsId: string,
  changes: Partial<Workspace>
): Promise<void> {
  await updateDoc(workspaceDoc(wsId), changes);
}

// ─── User profile ops ─────────────────────────────────────────────────────────

export async function upsertUserProfile(
  uid: string,
  data: Partial<UserProfile & { workspaceIds?: string[] }>
): Promise<void> {
  await setDoc(userDoc(uid), data, { merge: true });
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(userDoc(uid));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as UserProfile;
}

export async function getMemberProfiles(
  userIds: string[]
): Promise<Map<string, UserProfile>> {
  // js-index-maps rule: build Map for O(1) lookups
  const map = new Map<string, UserProfile>();
  if (userIds.length === 0) return map;
  // Batch in groups of 10 (Firestore 'in' limit)
  const chunks: string[][] = [];
  for (let i = 0; i < userIds.length; i += 10) {
    chunks.push(userIds.slice(i, i + 10));
  }
  await Promise.all(
    chunks.map(async (chunk) => {
      const q = query(usersCol(), where("id", "in", chunk));
      const snap = await getDocs(q);
      snap.docs.forEach((d) => map.set(d.id, { id: d.id, ...d.data() } as UserProfile));
    })
  );
  return map;
}

// ─── Project ops ─────────────────────────────────────────────────────────────

export async function createProject(
  wsId: string,
  data: Omit<Project, "id" | "createdAt" | "memberIds">
): Promise<Project> {
  const ref = doc(projectsCol(wsId));
  const project = {
    ...data,
    id: ref.id,
    memberIds: [data.createdBy],
    createdAt: serverTimestamp(),
  };
  const batch = writeBatch(db);
  batch.set(ref, project);
  // Auto-add creator as project_admin
  batch.set(projectMemberDoc(wsId, ref.id, data.createdBy), {
    userId: data.createdBy,
    role: "project_admin" as ProjectRole,
    addedAt: serverTimestamp(),
    addedBy: data.createdBy,
  });
  await batch.commit();
  return project as unknown as Project;
}

export function subscribeToProjects(
  wsId: string,
  callback: (projects: Project[]) => void
) {
  const q = query(
    projectsCol(wsId),
    where("status", "==", "active"),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Project));
  });
}

export function subscribeToMyProjects(
  wsId: string,
  userId: string,
  callback: (projects: Project[]) => void
) {
  const q = query(
    projectsCol(wsId),
    where("status", "==", "active"),
    where("memberIds", "array-contains", userId),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Project));
  });
}

export function subscribeToAccessibleProjects(
  wsId: string,
  userId: string,
  workspaceRole: Role,
  callback: (projects: Project[]) => void
) {
  if (workspaceRole === "admin") {
    return subscribeToProjects(wsId, callback);
  }
  return subscribeToMyProjects(wsId, userId, callback);
}

// ─── Project member ops ──────────────────────────────────────────────────────

export async function addProjectMember(
  wsId: string,
  projId: string,
  userId: string,
  role: ProjectRole,
  addedBy: string
): Promise<void> {
  const batch = writeBatch(db);
  batch.set(projectMemberDoc(wsId, projId, userId), {
    userId,
    role,
    addedAt: serverTimestamp(),
    addedBy,
  });
  batch.update(projectDoc(wsId, projId), {
    memberIds: arrayUnion(userId),
  });
  await batch.commit();
}

export async function removeProjectMember(
  wsId: string,
  projId: string,
  userId: string
): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(projectMemberDoc(wsId, projId, userId));
  batch.update(projectDoc(wsId, projId), {
    memberIds: arrayRemove(userId),
  });
  await batch.commit();
}

export async function updateProjectMemberRole(
  wsId: string,
  projId: string,
  userId: string,
  newRole: ProjectRole
): Promise<void> {
  await updateDoc(projectMemberDoc(wsId, projId, userId), { role: newRole });
}

export async function getProjectMembers(
  wsId: string,
  projId: string
): Promise<ProjectMember[]> {
  const snap = await getDocs(projectMembersCol(wsId, projId));
  const members = snap.docs.map((d) => ({ ...d.data() }) as ProjectMember);
  const userIds = members.map((m) => m.userId);
  const profileMap = await getMemberProfiles(userIds);
  return members.map((m) => ({ ...m, profile: profileMap.get(m.userId) }));
}

export function subscribeToProjectMembers(
  wsId: string,
  projId: string,
  callback: (members: ProjectMember[]) => void
) {
  return onSnapshot(projectMembersCol(wsId, projId), async (snap) => {
    const members = snap.docs.map((d) => ({ ...d.data() }) as ProjectMember);
    const userIds = members.map((m) => m.userId);
    const profileMap = await getMemberProfiles(userIds);
    callback(members.map((m) => ({ ...m, profile: profileMap.get(m.userId) })));
  });
}

export async function getProjectMemberRole(
  wsId: string,
  projId: string,
  userId: string
): Promise<ProjectRole | null> {
  const snap = await getDoc(projectMemberDoc(wsId, projId, userId));
  if (!snap.exists()) return null;
  return snap.data().role as ProjectRole;
}

// ─── Task ops ────────────────────────────────────────────────────────────────

export async function createTask(
  wsId: string,
  projId: string,
  data: Omit<Task, "id" | "createdAt" | "updatedAt">
): Promise<Task> {
  const ref = doc(tasksCol(wsId, projId));
  const task = {
    ...data,
    id: ref.id,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const batch = writeBatch(db);
  batch.set(ref, task);
  // Log creation event
  const eventRef = doc(eventsCol(wsId, projId, ref.id));
  batch.set(eventRef, {
    id: eventRef.id,
    taskId: ref.id,
    projectId: projId,
    workspaceId: wsId,
    userId: data.createdBy,
    eventType: "created" as TaskEventType,
    field: null,
    oldValue: null,
    newValue: null,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
  return task as unknown as Task;
}

export async function duplicateTask(
  wsId: string,
  projId: string,
  original: Task,
  userId: string
): Promise<Task> {
  const ref = doc(tasksCol(wsId, projId));
  const task = {
    projectId: original.projectId,
    workspaceId: original.workspaceId,
    title: `${original.title} (copy)`,
    description: original.description,
    status: original.status,
    priority: original.priority,
    assigneeId: original.assigneeId,
    dueDate: original.dueDate,
    position: 9999,
    labelIds: original.labelIds ?? [],
    storyPoints: original.storyPoints,
    epicId: original.epicId,
    sprintId: original.sprintId,
    attachments: [],
    createdBy: userId,
    deletedAt: null,
    id: ref.id,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const batch = writeBatch(db);
  batch.set(ref, task);
  const eventRef = doc(eventsCol(wsId, projId, ref.id));
  batch.set(eventRef, {
    id: eventRef.id,
    taskId: ref.id,
    projectId: projId,
    workspaceId: wsId,
    userId,
    eventType: "created" as TaskEventType,
    field: null,
    oldValue: null,
    newValue: null,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
  return task as unknown as Task;
}

export async function updateTask(
  wsId: string,
  projId: string,
  taskId: string,
  changes: Partial<Task>,
  userId: string,
  originalTask: Task,
  context?: { actorName: string }
): Promise<void> {
  const batch = writeBatch(db);
  const ref = taskDoc(wsId, projId, taskId);
  batch.update(ref, { ...changes, updatedAt: serverTimestamp() });

  // Log events for changed fields
  const fieldEventMap: Record<string, TaskEventType> = {
    status: "status_changed",
    priority: "priority_changed",
    assigneeId: "assignee_changed",
    dueDate: "due_date_changed",
    title: "title_changed",
    description: "description_changed",
    labelIds: "label_changed",
    storyPoints: "story_points_changed",
    epicId: "epic_changed",
    sprintId: "sprint_changed",
  };

  for (const [field, eventType] of Object.entries(fieldEventMap)) {
    const key = field as keyof Task;
    if (key in changes && changes[key] !== originalTask[key]) {
      const eventRef = doc(eventsCol(wsId, projId, taskId));
      batch.set(eventRef, {
        id: eventRef.id,
        taskId,
        projectId: projId,
        workspaceId: wsId,
        userId,
        eventType,
        field,
        oldValue: String(originalTask[key] ?? ""),
        newValue: String(changes[key] ?? ""),
        createdAt: serverTimestamp(),
      });
    }
  }

  // Notify on assignee change (task_assigned)
  if (
    context &&
    "assigneeId" in changes &&
    changes.assigneeId &&
    changes.assigneeId !== originalTask.assigneeId &&
    changes.assigneeId !== userId
  ) {
    const notifRef = doc(notificationsCol(changes.assigneeId));
    batch.set(notifRef, {
      id: notifRef.id,
      userId: changes.assigneeId,
      type: "task_assigned",
      taskId,
      projectId: projId,
      workspaceId: wsId,
      commentId: null,
      readAt: null,
      createdAt: serverTimestamp(),
      taskTitle: changes.title ?? originalTask.title,
      actorName: context.actorName,
    });
  }

  await batch.commit();
}

export function subscribeToTasks(
  wsId: string,
  projId: string,
  callback: (tasks: Task[]) => void
) {
  const q = query(
    tasksCol(wsId, projId),
    where("deletedAt", "==", null),
    orderBy("position", "asc")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Task));
  });
}

export async function softDeleteTask(
  wsId: string,
  projId: string,
  taskId: string
): Promise<void> {
  await updateDoc(taskDoc(wsId, projId, taskId), {
    deletedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

// ─── Subtask ops ─────────────────────────────────────────────────────────────

export async function addSubtask(
  wsId: string,
  projId: string,
  taskId: string,
  title: string,
  position: number
): Promise<Subtask> {
  const ref = doc(subtasksCol(wsId, projId, taskId));
  const subtask = {
    id: ref.id,
    taskId,
    title,
    description: "",
    status: "open" as const,
    priority: "none" as TaskPriority,
    assigneeId: null,
    dueDate: null,
    position,
    createdAt: serverTimestamp(),
  };
  await setDoc(ref, subtask);
  return subtask as unknown as Subtask;
}

export async function toggleSubtask(
  wsId: string,
  projId: string,
  taskId: string,
  subtaskId: string,
  status: "open" | "closed"
): Promise<void> {
  await updateDoc(
    doc(subtasksCol(wsId, projId, taskId), subtaskId),
    { status }
  );
}

export async function updateSubtask(
  wsId: string,
  projId: string,
  taskId: string,
  subtaskId: string,
  changes: Partial<Subtask>
): Promise<void> {
  await updateDoc(doc(subtasksCol(wsId, projId, taskId), subtaskId), changes);
}

export async function deleteSubtask(
  wsId: string,
  projId: string,
  taskId: string,
  subtaskId: string
): Promise<void> {
  await deleteDoc(doc(subtasksCol(wsId, projId, taskId), subtaskId));
}

export function subscribeToSubtasks(
  wsId: string,
  projId: string,
  taskId: string,
  callback: (subtasks: Subtask[]) => void
) {
  const q = query(
    subtasksCol(wsId, projId, taskId),
    orderBy("position", "asc")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Subtask));
  });
}

// ─── Comment ops ─────────────────────────────────────────────────────────────

export async function addComment(
  wsId: string,
  projId: string,
  taskId: string,
  userId: string,
  body: string,
  context?: { actorName: string; taskTitle: string; memberNameToId: Map<string, string> }
): Promise<Comment> {
  const ref = doc(commentsCol(wsId, projId, taskId));
  const comment = {
    id: ref.id,
    taskId,
    userId,
    body,
    editedAt: null,
    deletedAt: null,
    createdAt: serverTimestamp(),
  };
  // Also log a commented event
  const eventRef = doc(eventsCol(wsId, projId, taskId));
  const batch = writeBatch(db);
  batch.set(ref, comment);
  batch.set(eventRef, {
    id: eventRef.id,
    taskId,
    projectId: projId,
    workspaceId: wsId,
    userId,
    eventType: "commented" as TaskEventType,
    field: null,
    oldValue: null,
    newValue: ref.id,
    createdAt: serverTimestamp(),
  });

  // Notify @mentioned users
  if (context) {
    const mentioned = new Set<string>();
    const mentionPattern = /@(\S+(?:\s\S+)?)/g;
    let match: RegExpExecArray | null;
    while ((match = mentionPattern.exec(body)) !== null) {
      const name = match[1];
      const uid = context.memberNameToId.get(name);
      if (uid && uid !== userId && !mentioned.has(uid)) {
        mentioned.add(uid);
        const notifRef = doc(notificationsCol(uid));
        batch.set(notifRef, {
          id: notifRef.id,
          userId: uid,
          type: "mentioned",
          taskId,
          projectId: projId,
          workspaceId: wsId,
          commentId: ref.id,
          readAt: null,
          createdAt: serverTimestamp(),
          taskTitle: context.taskTitle,
          actorName: context.actorName,
        });
      }
    }
  }

  await batch.commit();
  return comment as unknown as Comment;
}

export function subscribeToComments(
  wsId: string,
  projId: string,
  taskId: string,
  callback: (comments: Comment[]) => void
) {
  const q = query(
    commentsCol(wsId, projId, taskId),
    where("deletedAt", "==", null),
    orderBy("createdAt", "asc")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Comment));
  });
}

// ─── Task event ops ───────────────────────────────────────────────────────────

export function subscribeToTaskEvents(
  wsId: string,
  projId: string,
  taskId: string,
  callback: (events: TaskEvent[]) => void
) {
  const q = query(
    eventsCol(wsId, projId, taskId),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TaskEvent));
  });
}

// ─── Label ops ───────────────────────────────────────────────────────────────

export async function createLabel(
  wsId: string,
  projId: string,
  name: string,
  color: string
): Promise<Label> {
  const ref = doc(labelsCol(wsId, projId));
  const label: Label = { id: ref.id, projectId: projId, name, color };
  await setDoc(ref, label);
  return label;
}

export async function updateLabel(
  wsId: string,
  projId: string,
  labelId: string,
  changes: Partial<Pick<Label, "name" | "color">>
): Promise<void> {
  await updateDoc(labelDoc(wsId, projId, labelId), changes);
}

export async function deleteLabel(
  wsId: string,
  projId: string,
  labelId: string
): Promise<void> {
  await deleteDoc(labelDoc(wsId, projId, labelId));
}

export function subscribeToLabels(
  wsId: string,
  projId: string,
  callback: (labels: Label[]) => void
) {
  return onSnapshot(labelsCol(wsId, projId), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Label));
  });
}

// ─── Epic ops ────────────────────────────────────────────────────────────────

export async function createEpic(
  wsId: string,
  projId: string,
  data: Omit<Epic, "id" | "createdAt" | "updatedAt">
): Promise<Epic> {
  const ref = doc(epicsCol(wsId, projId));
  const epic = {
    ...data,
    id: ref.id,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, epic);
  return epic as unknown as Epic;
}

export async function updateEpic(
  wsId: string,
  projId: string,
  epicId: string,
  changes: Partial<Epic>
): Promise<void> {
  await updateDoc(epicDoc(wsId, projId, epicId), { ...changes, updatedAt: serverTimestamp() });
}

export async function deleteEpic(
  wsId: string,
  projId: string,
  epicId: string
): Promise<void> {
  await deleteDoc(epicDoc(wsId, projId, epicId));
}

export function subscribeToEpics(
  wsId: string,
  projId: string,
  callback: (epics: Epic[]) => void
) {
  const q = query(epicsCol(wsId, projId), orderBy("position", "asc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Epic));
  });
}

// ─── Sprint ops ──────────────────────────────────────────────────────────────

export async function createSprint(
  wsId: string,
  projId: string,
  data: Omit<Sprint, "id" | "createdAt" | "updatedAt">
): Promise<Sprint> {
  const ref = doc(sprintsCol(wsId, projId));
  const sprint = {
    ...data,
    id: ref.id,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, sprint);
  return sprint as unknown as Sprint;
}

export async function updateSprint(
  wsId: string,
  projId: string,
  sprintId: string,
  changes: Partial<Sprint>
): Promise<void> {
  await updateDoc(sprintDoc(wsId, projId, sprintId), { ...changes, updatedAt: serverTimestamp() });
}

export async function startSprint(
  wsId: string,
  projId: string,
  sprintId: string,
  startDate: Date,
  endDate: Date
): Promise<void> {
  await updateDoc(sprintDoc(wsId, projId, sprintId), {
    status: "active" as SprintStatus,
    startDate,
    endDate,
    updatedAt: serverTimestamp(),
  });
}

export async function completeSprint(
  wsId: string,
  projId: string,
  sprintId: string,
  moveToSprintId: string | null,
  incompleteTasks: Task[]
): Promise<void> {
  const batch = writeBatch(db);
  batch.update(sprintDoc(wsId, projId, sprintId), {
    status: "completed" as SprintStatus,
    completedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  // Move incomplete tasks to next sprint or backlog (null)
  for (const task of incompleteTasks) {
    batch.update(taskDoc(wsId, projId, task.id), {
      sprintId: moveToSprintId,
      updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();
}

export function subscribeToSprints(
  wsId: string,
  projId: string,
  callback: (sprints: Sprint[]) => void
) {
  const q = query(sprintsCol(wsId, projId), orderBy("position", "asc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Sprint));
  });
}

// ─── Member ops ───────────────────────────────────────────────────────────────

export async function getWorkspaceMembers(
  wsId: string
): Promise<WorkspaceMember[]> {
  const snap = await getDocs(membersCol(wsId));
  const members = snap.docs.map(
    (d) => ({ ...d.data() } as WorkspaceMember)
  );
  // Fetch profiles in parallel (async-parallel rule)
  const userIds = members.map((m) => m.userId);
  const profileMap = await getMemberProfiles(userIds);
  return members.map((m) => ({ ...m, profile: profileMap.get(m.userId) }));
}

export function subscribeToMembers(
  wsId: string,
  callback: (members: WorkspaceMember[]) => void
) {
  return onSnapshot(membersCol(wsId), async (snap) => {
    const members = snap.docs.map((d) => ({ ...d.data() } as WorkspaceMember));
    const userIds = members.map((m) => m.userId);
    const profileMap = await getMemberProfiles(userIds);
    callback(members.map((m) => ({ ...m, profile: profileMap.get(m.userId) })));
  });
}

export async function updateMemberRole(
  wsId: string,
  userId: string,
  newRole: Role
): Promise<void> {
  await updateDoc(memberDoc(wsId, userId), { role: newRole });
}

export async function removeWorkspaceMember(
  wsId: string,
  userId: string
): Promise<void> {
  const batch = writeBatch(db);

  // 1. Delete workspace member doc
  batch.delete(memberDoc(wsId, userId));

  // 2. Remove wsId from user's workspaceIds
  batch.update(userDoc(userId), {
    workspaceIds: arrayRemove(wsId),
  });

  // 3. Remove from all projects they belong to
  const projectsSnap = await getDocs(
    query(projectsCol(wsId), where("memberIds", "array-contains", userId))
  );
  for (const projSnap of projectsSnap.docs) {
    batch.delete(projectMemberDoc(wsId, projSnap.id, userId));
    batch.update(projectDoc(wsId, projSnap.id), {
      memberIds: arrayRemove(userId),
    });
  }

  // 4. Unassign from tasks in those projects
  for (const projSnap of projectsSnap.docs) {
    const tasksSnap = await getDocs(
      query(tasksCol(wsId, projSnap.id), where("assigneeId", "==", userId))
    );
    for (const t of tasksSnap.docs) {
      batch.update(taskDoc(wsId, projSnap.id, t.id), {
        assigneeId: null,
        updatedAt: serverTimestamp(),
      });
    }
  }

  await batch.commit();
}

export async function createInvite(
  wsId: string,
  wsName: string,
  email: string,
  role: Role,
  invitedBy: string
): Promise<Invite> {
  const token = crypto.randomUUID().replace(/-/g, "");
  const ref = doc(invitesCol(wsId));
  const invite = {
    id: ref.id,
    workspaceId: wsId,
    workspaceName: wsName,
    email: email.toLowerCase(),
    role,
    token,
    invitedBy,
    acceptedAt: null,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: serverTimestamp(),
  };
  await setDoc(ref, invite);
  return invite as unknown as Invite;
}

export async function getInviteByToken(
  token: string
): Promise<(Invite & { workspaceId: string }) | null> {
  const q = query(
    collectionGroup(db, "invites"),
    where("token", "==", token),
    where("acceptedAt", "==", null)
  );
  const snap = await getDocs(q);
  if (snap.empty) {
    console.warn("[getInviteByToken] no invite found for token", token);
    return null;
  }
  const docData = snap.docs[0].data();
  const data = { id: snap.docs[0].id, ...docData } as Invite;
  // Derive workspaceId from document path: workspaces/{wsId}/invites/{invId}
  const wsId = snap.docs[0].ref.parent.parent?.id ?? data.workspaceId;
  return { ...data, workspaceId: wsId };
}

export async function deleteInvite(wsId: string, inviteId: string): Promise<void> {
  await deleteDoc(doc(invitesCol(wsId), inviteId));
}

export async function getPendingInvites(wsId: string): Promise<Invite[]> {
  const q = query(invitesCol(wsId), where("acceptedAt", "==", null));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Invite);
}

export async function acceptInvite(
  invite: Invite,
  userId: string
): Promise<void> {
  const batch = writeBatch(db);
  // Add member
  batch.set(memberDoc(invite.workspaceId, userId), {
    userId,
    role: invite.role,
    joinedAt: serverTimestamp(),
  });
  // Mark invite accepted
  batch.update(doc(invitesCol(invite.workspaceId), invite.id), {
    acceptedAt: serverTimestamp(),
  });
  // Add workspaceId to user profile
  batch.update(userDoc(userId), {
    workspaceIds: arrayUnion(invite.workspaceId),
  });
  await batch.commit();
}

// ─── Attachment ops ──────────────────────────────────────────────────────────

export async function addAttachment(
  wsId: string,
  projId: string,
  taskId: string,
  attachment: TaskAttachment,
  userId: string
): Promise<void> {
  const batch = writeBatch(db);
  const ref = taskDoc(wsId, projId, taskId);
  batch.update(ref, {
    attachments: arrayUnion(attachment),
    updatedAt: serverTimestamp(),
  });
  const eventRef = doc(eventsCol(wsId, projId, taskId));
  batch.set(eventRef, {
    id: eventRef.id,
    taskId,
    projectId: projId,
    workspaceId: wsId,
    userId,
    eventType: "attachment_added" as TaskEventType,
    field: "attachments",
    oldValue: null,
    newValue: attachment.name,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function removeAttachment(
  wsId: string,
  projId: string,
  taskId: string,
  attachment: TaskAttachment,
  userId: string
): Promise<void> {
  const batch = writeBatch(db);
  const ref = taskDoc(wsId, projId, taskId);
  batch.update(ref, {
    attachments: arrayRemove(attachment),
    updatedAt: serverTimestamp(),
  });
  const eventRef = doc(eventsCol(wsId, projId, taskId));
  batch.set(eventRef, {
    id: eventRef.id,
    taskId,
    projectId: projId,
    workspaceId: wsId,
    userId,
    eventType: "attachment_removed" as TaskEventType,
    field: "attachments",
    oldValue: attachment.name,
    newValue: null,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
}

// ─── CollectionGroup event subscriptions ──────────────────────────────────────

export function subscribeToProjectEvents(
  projId: string,
  maxResults: number,
  callback: (events: TaskEvent[]) => void
) {
  const q = query(
    collectionGroup(db, "events"),
    where("projectId", "==", projId),
    orderBy("createdAt", "desc"),
    limit(maxResults)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TaskEvent));
  });
}

export function subscribeToWorkspaceEvents(
  wsId: string,
  maxResults: number,
  callback: (events: TaskEvent[]) => void
) {
  const q = query(
    collectionGroup(db, "events"),
    where("workspaceId", "==", wsId),
    orderBy("createdAt", "desc"),
    limit(maxResults)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TaskEvent));
  });
}

// ─── Notification ops ─────────────────────────────────────────────────────────

export function subscribeToNotifications(
  userId: string,
  callback: (notifications: Notification[]) => void
) {
  const q = query(
    notificationsCol(userId),
    where("readAt", "==", null),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    callback(
      snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Notification)
    );
  });
}

export async function markNotificationRead(
  userId: string,
  notifId: string
): Promise<void> {
  await updateDoc(doc(notificationsCol(userId), notifId), {
    readAt: serverTimestamp(),
  });
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const q = query(notificationsCol(userId), where("readAt", "==", null));
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.update(d.ref, { readAt: serverTimestamp() }));
  await batch.commit();
}

// ─── Notes ops ───────────────────────────────────────────────────────────────

export async function createNote(
  wsId: string,
  projId: string,
  title: string,
  userId: string
): Promise<ProjectNote> {
  const ref = doc(notesCol(wsId, projId));
  const note = {
    id: ref.id,
    title,
    content: "",
    createdBy: userId,
    updatedBy: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, note);
  return note as unknown as ProjectNote;
}

export async function updateNote(
  wsId: string,
  projId: string,
  noteId: string,
  changes: Partial<Pick<ProjectNote, "title" | "content">>,
  userId: string
): Promise<void> {
  await updateDoc(noteDoc(wsId, projId, noteId), {
    ...changes,
    updatedBy: userId,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteNote(
  wsId: string,
  projId: string,
  noteId: string
): Promise<void> {
  await deleteDoc(noteDoc(wsId, projId, noteId));
}

export function subscribeToNotes(
  wsId: string,
  projId: string,
  callback: (notes: ProjectNote[]) => void
) {
  const q = query(notesCol(wsId, projId), orderBy("updatedAt", "desc"));
  return onSnapshot(q, (snap) => {
    callback(
      snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ProjectNote)
    );
  });
}

// ─── Attendance ops ──────────────────────────────────────────────────────────

export async function clockIn(
  wsId: string,
  userId: string,
  type: "office" | "remote"
): Promise<ClockEntry> {
  // Guard: prevent duplicate active clocks for the same user
  const existing = await getDocs(
    query(
      attendanceCol(wsId),
      where("userId", "==", userId),
      where("clockOut", "==", null)
    )
  );
  if (!existing.empty) throw new Error("Already clocked in");

  const ref = doc(attendanceCol(wsId));
  const entry = {
    id: ref.id,
    userId,
    type,
    clockIn: Timestamp.now(),
    clockOut: null,
    breakMinutes: 0,
    notes: "",
    totalHours: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, entry);
  return entry as unknown as ClockEntry;
}

export async function clockOut(
  wsId: string,
  entryId: string,
  clockInTime: Date,
  breakMinutes: number = 0
): Promise<void> {
  const now = new Date();
  const diffMs = now.getTime() - clockInTime.getTime();
  const totalHours = Math.max(0, (diffMs / (1000 * 60 * 60)) - (breakMinutes / 60));
  await updateDoc(attendanceDoc(wsId, entryId), {
    clockOut: Timestamp.now(),
    breakMinutes,
    totalHours: Math.round(totalHours * 100) / 100,
    updatedAt: serverTimestamp(),
  });
}

export async function updateClockEntry(
  wsId: string,
  entryId: string,
  changes: Partial<Pick<ClockEntry, "notes" | "breakMinutes">>
): Promise<void> {
  await updateDoc(attendanceDoc(wsId, entryId), {
    ...changes,
    updatedAt: serverTimestamp(),
  });
}

export function subscribeToMyAttendance(
  wsId: string,
  userId: string,
  callback: (entries: ClockEntry[]) => void
) {
  const q = query(
    attendanceCol(wsId),
    where("userId", "==", userId),
    orderBy("clockIn", "desc"),
    limit(30)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ClockEntry));
  });
}

export function subscribeToActiveClocks(
  wsId: string,
  callback: (entries: ClockEntry[]) => void
) {
  const q = query(
    attendanceCol(wsId),
    where("clockOut", "==", null)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ClockEntry));
  });
}

export function subscribeToMyActiveClock(
  wsId: string,
  userId: string,
  callback: (entry: ClockEntry | null) => void
) {
  const q = query(
    attendanceCol(wsId),
    where("userId", "==", userId),
    where("clockOut", "==", null)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.empty ? null : ({ id: snap.docs[0].id, ...snap.docs[0].data() } as ClockEntry));
  });
}

export async function getMyAttendanceByRange(
  wsId: string,
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<ClockEntry[]> {
  const q = query(
    attendanceCol(wsId),
    where("userId", "==", userId),
    where("clockIn", ">=", Timestamp.fromDate(startDate)),
    where("clockIn", "<=", Timestamp.fromDate(endDate)),
    orderBy("clockIn", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ClockEntry);
}

export async function getAttendanceByRange(
  wsId: string,
  startDate: Date,
  endDate: Date
): Promise<ClockEntry[]> {
  const q = query(
    attendanceCol(wsId),
    where("clockIn", ">=", Timestamp.fromDate(startDate)),
    where("clockIn", "<=", Timestamp.fromDate(endDate)),
    orderBy("clockIn", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ClockEntry);
}

// ─── Calendar Events ─────────────────────────────────────────────────────────

export async function createCalendarEvent(
  wsId: string,
  data: Omit<CalendarEvent, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const ref = doc(calendarEventsCol(wsId));
  await setDoc(ref, {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateCalendarEvent(
  wsId: string,
  eventId: string,
  changes: Partial<CalendarEvent>
): Promise<void> {
  await updateDoc(calendarEventDoc(wsId, eventId), {
    ...changes,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteCalendarEvent(
  wsId: string,
  eventId: string
): Promise<void> {
  await deleteDoc(calendarEventDoc(wsId, eventId));
}

export function subscribeToCalendarEvents(
  wsId: string,
  callback: (events: CalendarEvent[]) => void
) {
  const q = query(calendarEventsCol(wsId), orderBy("startDate", "asc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CalendarEvent));
  });
}

export async function getPublicCalendarEvents(
  wsId: string
): Promise<CalendarEvent[]> {
  const q = query(
    calendarEventsCol(wsId),
    where("isPublic", "==", true)
  );
  const snap = await getDocs(q);
  const events = snap.docs.map(
    (d) => ({ id: d.id, ...d.data() }) as CalendarEvent
  );
  // Sort client-side to avoid needing a composite index
  events.sort((a, b) => {
    const aTime = a.startDate?.toDate?.() ?? new Date(a.startDate as unknown as string);
    const bTime = b.startDate?.toDate?.() ?? new Date(b.startDate as unknown as string);
    return aTime.getTime() - bTime.getTime();
  });
  return events;
}

export async function getCalendarEvent(
  wsId: string,
  eventId: string
): Promise<CalendarEvent | null> {
  const snap = await getDoc(calendarEventDoc(wsId, eventId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as CalendarEvent;
}

// ─── Event Registrations ─────────────────────────────────────────────────────

export async function submitRegistration(
  wsId: string,
  eventId: string,
  data: Record<string, string>,
  email: string
): Promise<string> {
  const ref = doc(registrationsCol(wsId, eventId));
  await setDoc(ref, {
    eventId,
    data,
    email: email.toLowerCase(),
    registeredAt: serverTimestamp(),
  });
  return ref.id;
}

export function subscribeToRegistrations(
  wsId: string,
  eventId: string,
  callback: (registrations: EventRegistration[]) => void
) {
  const q = query(registrationsCol(wsId, eventId), orderBy("registeredAt", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as EventRegistration));
  });
}

export async function getRegistrationCount(
  wsId: string,
  eventId: string
): Promise<number> {
  const snap = await getDocs(registrationsCol(wsId, eventId));
  return snap.size;
}

export async function getWorkspaceName(wsId: string): Promise<string | null> {
  const snap = await getDoc(workspaceDoc(wsId));
  if (!snap.exists()) return null;
  return (snap.data() as Workspace).name;
}

