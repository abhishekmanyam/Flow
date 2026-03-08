import type { Timestamp } from "firebase/firestore";

// ─── Attachment Types ─────────────────────────────────────────────────────────

export type AttachmentType = "google_drive" | "link";

export type TaskAttachment = {
  id: string;
  type: AttachmentType;
  name: string;
  url: string;
  mimeType?: string;
  iconUrl?: string;
  addedBy: string;
  addedAt: Timestamp;
};

// ─── Domain Types ─────────────────────────────────────────────────────────────

export type Workspace = {
  id: string;
  name: string;
  slug: string;
  allowedTimesheetIp: string | null;
  createdAt: Timestamp;
};

export type UserProfile = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  timezone: string;
  createdAt: Timestamp;
};

export type WorkspaceMember = {
  userId: string;
  role: Role;
  joinedAt: Timestamp;
  profile?: UserProfile;
};

export type Invite = {
  id: string;
  workspaceId: string;
  workspaceName: string;
  email: string;
  role: Role;
  token: string;
  invitedBy: string;
  acceptedAt: Timestamp | null;
  expiresAt: Timestamp;
  createdAt: Timestamp;
};

export type ProjectRole = "project_admin" | "member" | "viewer";

export type ProjectMember = {
  userId: string;
  role: ProjectRole;
  addedAt: Timestamp;
  addedBy: string;
  profile?: UserProfile;
};

export type Project = {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  color: string;
  status: "active" | "archived";
  memberIds: string[];
  miroBoardUrl?: string;
  createdBy: string;
  createdAt: Timestamp;
};

export type Task = {
  id: string;
  projectId: string;
  workspaceId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string | null;
  dueDate: Timestamp | null;
  position: number;
  labelIds: string[];
  storyPoints: number | null;
  epicId: string | null;
  sprintId: string | null;
  attachments?: TaskAttachment[];
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt: Timestamp | null;
};

export type Subtask = {
  id: string;
  taskId: string;
  title: string;
  description: string;
  status: "open" | "closed";
  priority: TaskPriority;
  assigneeId: string | null;
  dueDate: Timestamp | null;
  position: number;
  createdAt: Timestamp;
};

export type TaskEvent = {
  id: string;
  taskId: string;
  projectId?: string;
  workspaceId?: string;
  userId: string | null;
  eventType: TaskEventType;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: Timestamp;
  // joined
  user?: Pick<UserProfile, "name" | "avatarUrl"> | null;
};

export type Comment = {
  id: string;
  taskId: string;
  userId: string;
  body: string;
  editedAt: Timestamp | null;
  deletedAt: Timestamp | null;
  createdAt: Timestamp;
  // joined
  author?: Pick<UserProfile, "name" | "avatarUrl">;
};

export type Label = {
  id: string;
  projectId: string;
  name: string;
  color: string;
};

export type Epic = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  color: string;
  status: EpicStatus;
  labelIds: string[];
  leadId: string | null;
  startDate: Timestamp | null;
  targetDate: Timestamp | null;
  position: number;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type Sprint = {
  id: string;
  projectId: string;
  name: string;
  goal: string;
  status: SprintStatus;
  startDate: Timestamp | null;
  endDate: Timestamp | null;
  position: number;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  completedAt: Timestamp | null;
};

export type Notification = {
  id: string;
  userId: string;
  type: NotificationType;
  taskId: string | null;
  projectId: string | null;
  workspaceId: string;
  commentId: string | null;
  readAt: Timestamp | null;
  createdAt: Timestamp;
  // metadata for display
  taskTitle?: string;
  actorName?: string;
};

// ─── Note Types ─────────────────────────────────────────────────────────────

export type ProjectNote = {
  id: string;
  title: string;
  content: string;
  createdBy: string;
  updatedBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

// ─── Presence Types ──────────────────────────────────────────────────────────

export type BoardPresence = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  lastSeen: number;
};

// ─── Attendance Types ────────────────────────────────────────────────────────

export type ClockEntry = {
  id: string;
  userId: string;
  type: "office" | "remote";
  clockIn: Timestamp;
  clockOut: Timestamp | null;
  breakMinutes: number;
  notes: string;
  totalHours: number | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

// ─── Enums ────────────────────────────────────────────────────────────────────

export type Role = "admin" | "manager" | "member" | "hr" | "viewer";

export type TaskStatus =
  | "backlog"
  | "todo"
  | "in_progress"
  | "in_review"
  | "done";

export type TaskPriority = "none" | "low" | "medium" | "high" | "urgent";

export type EpicStatus = "not_started" | "in_progress" | "done" | "cancelled";

export type SprintStatus = "planning" | "active" | "completed";

export type TaskEventType =
  | "created"
  | "status_changed"
  | "priority_changed"
  | "assignee_changed"
  | "due_date_changed"
  | "title_changed"
  | "description_changed"
  | "label_changed"
  | "story_points_changed"
  | "epic_changed"
  | "sprint_changed"
  | "commented"
  | "attachment_added"
  | "attachment_removed";

export type NotificationType = "task_assigned" | "mentioned" | "due_soon";

// ─── Constants ────────────────────────────────────────────────────────────────

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: "Backlog",
  todo: "Todo",
  in_progress: "In Progress",
  in_review: "In Review",
  done: "Done",
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  none: "None",
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  none: "text-muted-foreground",
  low: "text-blue-500",
  medium: "text-yellow-500",
  high: "text-orange-500",
  urgent: "text-red-500",
};

export const STATUS_COLORS: Record<TaskStatus, string> = {
  backlog: "bg-muted text-muted-foreground",
  todo: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  in_review: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  done: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
};

export const STATUS_DOT_COLORS: Record<TaskStatus, string> = {
  backlog: "bg-muted-foreground/50",
  todo: "bg-slate-400 dark:bg-slate-500",
  in_progress: "bg-blue-500",
  in_review: "bg-yellow-500",
  done: "bg-green-500",
};

export const EPIC_STATUS_LABELS: Record<EpicStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  done: "Done",
  cancelled: "Cancelled",
};

export const SPRINT_STATUS_LABELS: Record<SprintStatus, string> = {
  planning: "Planning",
  active: "Active",
  completed: "Completed",
};

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  manager: "Manager",
  member: "Member",
  hr: "HR",
  viewer: "Viewer",
};

export const PROJECT_ROLE_LABELS: Record<ProjectRole, string> = {
  project_admin: "Project Admin",
  member: "Member",
  viewer: "Viewer",
};

export const PROJECT_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#ef4444",
  "#a855f7",
];

export const LABEL_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899", "#64748b",
];

export const STORY_POINT_OPTIONS = [0, 0.5, 1, 2, 3, 5, 8, 13, 21] as const;

export const TASK_STATUSES: TaskStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "done",
];

// ─── Calendar Event Types ────────────────────────────────────────────────────

export type EventCategory = "meeting" | "workshop" | "webinar" | "social" | "other";

export type RegistrationFieldType = "text" | "email" | "phone" | "select" | "textarea";

export type RegistrationField = {
  name: string;
  label: string;
  type: RegistrationFieldType;
  required: boolean;
  options?: string[];
  placeholder?: string;
};

export type CalendarEvent = {
  id: string;
  workspaceId: string;
  title: string;
  description: string;
  startDate: Timestamp;
  endDate: Timestamp;
  allDay: boolean;
  location: string | null;
  category: EventCategory;
  color: string;
  isPublic: boolean;
  registrationOpen: boolean;
  maxRegistrations: number | null;
  registrationFields: RegistrationField[];
  workspaceName: string;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type EventRegistration = {
  id: string;
  eventId: string;
  data: Record<string, string>;
  email: string;
  registeredAt: Timestamp;
};

export const EVENT_CATEGORY_LABELS: Record<EventCategory, string> = {
  meeting: "Meeting",
  workshop: "Workshop",
  webinar: "Webinar",
  social: "Social",
  other: "Other",
};

export const EVENT_CATEGORY_COLORS: Record<EventCategory, string> = {
  meeting: "#3b82f6",
  workshop: "#8b5cf6",
  webinar: "#f97316",
  social: "#22c55e",
  other: "#6366f1",
};

export const REGISTRATION_FIELD_TYPE_LABELS: Record<RegistrationFieldType, string> = {
  text: "Short Text",
  email: "Email",
  phone: "Phone Number",
  select: "Dropdown",
  textarea: "Long Text",
};

export const DEFAULT_REGISTRATION_FIELDS: RegistrationField[] = [
  { name: "full_name", label: "Full Name", type: "text", required: true, placeholder: "John Doe" },
  { name: "email", label: "Email", type: "email", required: true, placeholder: "john@example.com" },
];
