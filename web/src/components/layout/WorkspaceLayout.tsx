import { useEffect } from "react";
import { Outlet, useParams, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import Sidebar from "./Sidebar";

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
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
