import { Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { useAuthStore } from "@/store/auth";
import { AppShell } from "@astryxdesign/core/AppShell";
import { Center } from "@astryxdesign/core/Center";
import { VStack } from "@astryxdesign/core/VStack";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { Spinner } from "@astryxdesign/core/Spinner";
import { Button } from "@astryxdesign/core/Button";

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
const InquiriesPage = lazy(() => import("@/pages/workspace/InquiriesPage"));
const PublicCalendarPage = lazy(() => import("@/pages/public/PublicCalendarPage"));
const PublicEventPage = lazy(() => import("@/pages/public/PublicEventPage"));

function PageLoader() {
  return (
    <Center axis="both" height="100vh">
      <Spinner size="lg" label="Loading..." />
    </Center>
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
    <AppShell contentPadding={4}>
      <Center axis="both" height="100%">
        <VStack gap={4} hAlign="center" width="100%" maxWidth={400}>
          <img src="/flowtask.png" alt="FlowTask" width={48} />
          <VStack gap={2} hAlign="center">
            <Heading level={1}>No workspace access</Heading>
            <Text type="supporting" color="secondary" justify="center">
              You don&apos;t belong to any workspace yet. Ask your admin to send you an invite link.
            </Text>
          </VStack>
          <Button label="Sign out" variant="secondary" width="100%" clickAction={() => signOut()} />
        </VStack>
      </Center>
    </AppShell>
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
          <Route path="inquiries" element={<InquiriesPage />} />
          <Route path="registrations" element={<Navigate to="../inquiries" replace />} />
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
