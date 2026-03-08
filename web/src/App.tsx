import { Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { motion } from "motion/react";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { BackgroundBeams } from "@/components/ui/background-beams";

// bundle-dynamic-imports: lazy-load heavy route chunks
const LoginPage = lazy(() => import("@/pages/auth/LoginPage"));
const ForgotPasswordPage = lazy(() => import("@/pages/auth/ForgotPasswordPage"));
const InvitePage = lazy(() => import("@/pages/auth/InvitePage"));
const BootstrapPage = lazy(() => import("@/pages/auth/BootstrapPage"));
const WorkspaceLayout = lazy(() => import("@/components/layout/WorkspaceLayout"));
const DashboardPage = lazy(() => import("@/pages/workspace/DashboardPage"));
const ProjectsPage = lazy(() => import("@/pages/workspace/ProjectsPage"));
const MembersPage = lazy(() => import("@/pages/workspace/MembersPage"));
const SettingsPage = lazy(() => import("@/pages/workspace/SettingsPage"));
const BoardPage = lazy(() => import("@/pages/projects/BoardPage"));
const ActivityPage = lazy(() => import("@/pages/projects/ActivityPage"));
const ProjectMembersPage = lazy(() => import("@/pages/projects/ProjectMembersPage"));
const ProjectSettingsPage = lazy(() => import("@/pages/projects/ProjectSettingsPage"));
const EpicsPage = lazy(() => import("@/pages/projects/EpicsPage"));
const BacklogPage = lazy(() => import("@/pages/projects/BacklogPage"));
const SharedNotesPage = lazy(() => import("@/pages/projects/SharedNotesPage"));
const WhiteboardPage = lazy(() => import("@/pages/projects/WhiteboardPage"));
const TimesheetPage = lazy(() => import("@/pages/workspace/TimesheetPage"));
const CalendarPage = lazy(() => import("@/pages/workspace/CalendarPage"));
const PublicCalendarPage = lazy(() => import("@/pages/public/PublicCalendarPage"));
const PublicEventPage = lazy(() => import("@/pages/public/PublicEventPage"));

function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <motion.div
        animate={{ scale: [1, 1.15, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        className="flex items-center justify-center"
      >
        <img src="/flowtask.png" alt="FlowTask" className="h-10" />
      </motion.div>
      <p className="text-xs text-muted-foreground">Loading...</p>
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, initialized } = useAuthStore();
  if (!initialized) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireNoAuth({ children }: { children: React.ReactNode }) {
  const { user, initialized, workspace } = useAuthStore();
  if (!initialized) return <PageLoader />;
  if (user && workspace) return <Navigate to={`/${workspace.slug}/dashboard`} replace />;
  if (user && !workspace) return <Navigate to="/" replace />;
  return <>{children}</>;
}

/** Shown when a user is logged in but has no workspace (not invited yet) */
function NoWorkspacePage() {
  const { signOut } = useAuthStore();
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 relative overflow-hidden">
      <BackgroundBeams className="z-0" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-sm space-y-6 text-center relative z-10"
      >
        <div className="flex items-center justify-center mb-6">
          <img src="/flowtask.png" alt="FlowTask" className="h-12" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">No workspace access</h1>
          <p className="text-sm text-muted-foreground">
            You don&apos;t belong to any workspace yet. Ask your admin to send you an invite link.
          </p>
        </div>
        <Button variant="outline" className="w-full" onClick={() => signOut()}>
          Sign out
        </Button>
      </motion.div>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<RequireNoAuth><LoginPage /></RequireNoAuth>} />
        <Route path="/forgot-password" element={<RequireNoAuth><ForgotPasswordPage /></RequireNoAuth>} />
        <Route path="/invite/:token" element={<InvitePage />} />
        <Route path="/bootstrap" element={<BootstrapPage />} />

        <Route path="/events/:workspaceId" element={<PublicCalendarPage />} />
        <Route path="/events/:workspaceId/:eventId" element={<PublicEventPage />} />

        <Route path="/:slug" element={<RequireAuth><WorkspaceLayout /></RequireAuth>}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="members" element={<MembersPage />} />
          <Route path="timesheet" element={<TimesheetPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="projects/:projectId/board" element={<BoardPage />} />
          <Route path="projects/:projectId/backlog" element={<BacklogPage />} />
          <Route path="projects/:projectId/epics" element={<EpicsPage />} />
          <Route path="projects/:projectId/activity" element={<ActivityPage />} />
          <Route path="projects/:projectId/members" element={<ProjectMembersPage />} />
          <Route path="projects/:projectId/notes" element={<SharedNotesPage />} />
          <Route path="projects/:projectId/whiteboard" element={<WhiteboardPage />} />
          <Route path="projects/:projectId/settings" element={<ProjectSettingsPage />} />
        </Route>

        <Route path="/" element={<RootRedirect />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

function RootRedirect() {
  const { user, workspace, initialized } = useAuthStore();
  if (!initialized) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (workspace) return <Navigate to={`/${workspace.slug}/dashboard`} replace />;
  return <NoWorkspacePage />;
}
