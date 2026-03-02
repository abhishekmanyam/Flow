# Flow — Project Management with Memory

A full-stack project management platform built for teams. The defining feature is **persistent memory** — every action, comment, and change is permanently recorded, giving teams a complete, queryable history of every project decision ever made.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Drag & Drop | @dnd-kit |
| Rich Text | Tiptap |
| State | Zustand + TanStack Query |
| Backend | Firebase (Firestore + Auth + Cloud Functions) |
| Hosting | Firebase Hosting |

## Features

- **Kanban Board** — Drag-and-drop task management with status columns (Backlog, Todo, In Progress, In Review, Done)
- **Persistent Memory** — Every field change, status update, and assignment is recorded as an immutable event
- **Workspaces & Projects** — Multi-project support within a team workspace
- **Subtasks & Epics** — Break work into subtasks; group tasks into epics
- **Comments** — Threaded comments with @mentions and rich text (Tiptap)
- **Activity Feed** — Per-task, per-project, and workspace-level activity timelines
- **Team Management** — Invite-only access with Admin / Member / Viewer roles
- **Labels & Filters** — Custom labels per project, filter board by assignee, priority, label, or due date
- **Notifications** — In-app notification bell with unread count
- **Backlog View** — Table view for triaging tasks outside the board
- **Shared Notes** — Collaborative project notes
- **Timesheet** — Time tracking per workspace
- **Search** — Global command palette search (cmdk)
- **Dark Mode** — Theme toggle via next-themes

## Project Structure

```
├── web/                    # React + Vite frontend
│   └── src/
│       ├── components/     # UI components by feature
│       ├── pages/          # Route page components
│       ├── hooks/          # Custom React hooks
│       ├── lib/            # Firebase init, Firestore CRUD, types
│       └── store/          # Zustand stores
├── functions/              # Firebase Cloud Functions (Node 20)
├── firestore.rules         # Firestore security rules (role-based)
├── storage.rules           # Firebase Storage rules
└── firebase.json           # Firebase project config
```

## Getting Started

### Prerequisites

- Node.js 20+
- A Firebase project ([console.firebase.google.com](https://console.firebase.google.com))

### Setup

1. **Clone the repo**

   ```bash
   git clone https://github.com/<your-username>/flow.git
   cd flow
   ```

2. **Create a Firebase project** and enable:
   - Firestore Database
   - Authentication (Email/Password provider)
   - Firebase Hosting (optional)

3. **Add environment variables**

   Create `web/.env.local` with your Firebase config:

   ```env
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id

   # Optional — leave empty to disable
   VITE_GOOGLE_CLIENT_ID=
   VITE_EMAILJS_PUBLIC_KEY=
   VITE_EMAILJS_SERVICE_ID=
   VITE_EMAILJS_TEMPLATE_ID=
   ```

4. **Deploy Firestore security rules**

   ```bash
   firebase deploy --only firestore:rules
   ```

5. **Install dependencies and run**

   ```bash
   cd web
   npm install
   npm run dev
   ```

   The app will be available at `http://localhost:5173`.

### Build

```bash
cd web
npm run build
```

### Deploy

```bash
# Build frontend
cd web && npm run build && cd ..

# Deploy everything (hosting + functions + rules)
firebase deploy
```

## Firestore Data Model

```
workspaces/{wsId}
  ├── projects/{projId}
  │     ├── tasks/{taskId}
  │     │     ├── events/{eventId}       ← immutable memory
  │     │     ├── subtasks/{subtaskId}
  │     │     └── comments/{commentId}
  │     └── ...
  └── ...
```

Events in the `events` subcollection are **immutable** — Firestore rules block updates and deletes, ensuring a complete audit trail.

## Roles & Permissions

| Role | Permissions |
|------|-------------|
| Admin | Full access — manage members, projects, settings, delete anything |
| Member | Create/edit tasks and projects, comment, view all |
| Viewer | Read-only access to assigned projects |

## License

MIT
