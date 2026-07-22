import { useEffect } from "react";
import { Outlet, useParams, useNavigate } from "react-router-dom";
import { AppShell } from "@astryxdesign/core/AppShell";
import { useAuthStore } from "@/store/auth";
import Sidebar from "./Sidebar";

/**
 * Persistent workspace frame.
 *
 * Responsive contract (AppShell auto-mobile, breakpoint `md`):
 *   > 768px  SideNav 256px | content (edge-to-edge, contentPadding 0)
 *   <= 768px SideNav collapses into an auto mobile drawer with a top-bar
 *            hamburger (rendered by AppShell for sidenav-only layouts)
 *
 * contentPadding={0}: pages own their internal frame (canonical page scaffold).
 */
export default function WorkspaceLayout() {
  const { slug } = useParams<{ slug: string }>();
  const { workspace } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (workspace && slug && workspace.slug !== slug) {
      navigate(`/${workspace.slug}/dashboard`, { replace: true });
    }
  }, [workspace, slug, navigate]);

  if (!workspace) return null;

  return (
    <AppShell sideNav={<Sidebar />} contentPadding={0}>
      <Outlet />
    </AppShell>
  );
}
