import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth";
import { getProjectMemberRole } from "@/lib/firestore";
import type { ProjectRole } from "@/lib/types";

type ProjectAccess = {
  loading: boolean;
  hasAccess: boolean;
  canEdit: boolean;
  isProjectAdmin: boolean;
  projectRole: ProjectRole | null;
};

export function useProjectAccess(projectId: string | undefined): ProjectAccess {
  const { workspace, role: wsRole, user } = useAuthStore();
  const [projectRole, setProjectRole] = useState<ProjectRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspace || !user || !projectId) {
      setLoading(false);
      return;
    }

    // Workspace admins have full access without fetching project role
    if (wsRole === "admin") {
      setProjectRole("project_admin");
      setLoading(false);
      return;
    }

    getProjectMemberRole(workspace.id, projectId, user.uid)
      .then((role) => setProjectRole(role))
      .catch(() => setProjectRole(null))
      .finally(() => setLoading(false));
  }, [workspace?.id, user?.uid, projectId, wsRole]);

  const isWsAdmin = wsRole === "admin";
  const hasAccess = isWsAdmin || projectRole !== null;
  const canEdit = isWsAdmin || projectRole === "project_admin" || projectRole === "member";
  const isProjectAdmin = isWsAdmin || projectRole === "project_admin";

  return { loading, hasAccess, canEdit, isProjectAdmin, projectRole };
}
