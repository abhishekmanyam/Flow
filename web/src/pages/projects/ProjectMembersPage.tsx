import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { useProjectAccess } from "@/hooks/useProjectAccess";
import { MotionPage } from "@/components/ui/motion-page";
import { StaggerContainer, StaggerItem } from "@/components/ui/stagger";
import {
  getWorkspaceMembers,
  subscribeToProjectMembers,
  addProjectMember,
  removeProjectMember,
  updateProjectMemberRole,
} from "@/lib/firestore";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import ProjectHeader from "@/components/projects/ProjectHeader";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Loader2, MoreHorizontal, Plus, UserMinus, Shield, UserPlus } from "lucide-react";
import { PROJECT_ROLE_LABELS } from "@/lib/types";
import type { Project, ProjectMember, ProjectRole, WorkspaceMember } from "@/lib/types";

function getInitials(name: string | null | undefined) {
  if (!name) return "?";
  return name
    .split(/\s/)
    .map((s) => s[0]?.toUpperCase())
    .slice(0, 2)
    .join("");
}

export default function ProjectMembersPage() {
  const { slug, projectId } = useParams<{ slug: string; projectId: string }>();
  const { workspace, user } = useAuthStore();
  const { loading: accessLoading, hasAccess, canEdit, isProjectAdmin } = useProjectAccess(projectId);
  const [project, setProject] = useState<Project | null>(null);
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>([]);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState<ProjectRole>("member");
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    if (!workspace || !projectId || accessLoading || !hasAccess) return;
    getDoc(doc(db, "workspaces", workspace.id, "projects", projectId)).then((snap) => {
      if (snap.exists()) setProject({ id: snap.id, ...snap.data() } as Project);
    });
    if (isProjectAdmin) {
      getWorkspaceMembers(workspace.id).then(setWorkspaceMembers);
    }
    return subscribeToProjectMembers(workspace.id, projectId, setProjectMembers);
  }, [workspace?.id, projectId, accessLoading, hasAccess, isProjectAdmin]);

  if (accessLoading || !workspace || !project) {
    return (
      <div className="p-6">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-2">
          <h2 className="text-lg font-semibold">Access Denied</h2>
          <p className="text-sm text-muted-foreground">You don&apos;t have access to this project.</p>
        </div>
      </div>
    );
  }

  // Workspace members not yet in this project
  const projectMemberIds = new Set(projectMembers.map((m) => m.userId));
  const availableMembers = workspaceMembers.filter((m) => !projectMemberIds.has(m.userId));

  const handleAdd = async () => {
    if (!selectedUserId) return;
    setAdding(true);
    try {
      await addProjectMember(workspace.id, projectId!, selectedUserId, selectedRole, user!.uid);
      toast.success("Member added");
      setAddDialogOpen(false);
      setSelectedUserId("");
      setSelectedRole("member");
    } catch {
      toast.error("Failed to add member");
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (userId: string) => {
    setRemovingId(userId);
    try {
      await removeProjectMember(workspace.id, projectId!, userId);
      toast.success("Member removed");
    } catch {
      toast.error("Failed to remove member");
    } finally {
      setRemovingId(null);
    }
  };

  const handleRoleChange = async (userId: string, newRole: ProjectRole) => {
    try {
      await updateProjectMemberRole(workspace.id, projectId!, userId, newRole);
      toast.success("Role updated");
    } catch {
      toast.error("Failed to update role");
    }
  };

  const roleBadgeVariant = (role: ProjectRole) => {
    if (role === "project_admin") return "default" as const;
    return "secondary" as const;
  };

  return (
    <MotionPage className="flex flex-col h-full">
      <ProjectHeader project={project} workspaceSlug={slug!} canEdit={canEdit} isProjectAdmin={isProjectAdmin} />
      <div className="flex-1 overflow-auto p-6 max-w-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Members ({projectMembers.length})</h2>
          {isProjectAdmin && (
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add project member</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  {availableMembers.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      All workspace members are already in this project.
                    </p>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Member</label>
                        <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a member" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableMembers.map((m) => (
                              <SelectItem key={m.userId} value={m.userId}>
                                {m.profile?.name || m.profile?.email || m.userId}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Role</label>
                        <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as ProjectRole)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="project_admin">Project Admin</SelectItem>
                            <SelectItem value="member">Member</SelectItem>
                            <SelectItem value="viewer">Viewer</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={handleAdd} disabled={!selectedUserId || adding} className="w-full">
                        {adding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <UserPlus className="mr-2 h-4 w-4" />
                        Add to project
                      </Button>
                    </>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <StaggerContainer className="space-y-2">
          {projectMembers.map((m) => {
            const isSelf = m.userId === user?.uid;
            return (
              <StaggerItem key={m.userId} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={m.profile?.avatarUrl ?? undefined} />
                    <AvatarFallback className="text-sm">{getInitials(m.profile?.name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">
                      {m.profile?.name || "Unknown"}
                      {isSelf && <span className="text-muted-foreground ml-1">(you)</span>}
                    </p>
                    {m.profile?.email && (
                      <p className="text-xs text-muted-foreground">{m.profile.email}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={roleBadgeVariant(m.role)}>{PROJECT_ROLE_LABELS[m.role]}</Badge>
                  {isProjectAdmin && !isSelf && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          {removingId === m.userId ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <MoreHorizontal className="h-4 w-4" />
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {m.role !== "project_admin" && (
                          <DropdownMenuItem onClick={() => handleRoleChange(m.userId, "project_admin")}>
                            <Shield className="mr-2 h-4 w-4" />
                            Make project admin
                          </DropdownMenuItem>
                        )}
                        {m.role !== "member" && (
                          <DropdownMenuItem onClick={() => handleRoleChange(m.userId, "member")}>
                            <UserPlus className="mr-2 h-4 w-4" />
                            Set as member
                          </DropdownMenuItem>
                        )}
                        {m.role !== "viewer" && (
                          <DropdownMenuItem onClick={() => handleRoleChange(m.userId, "viewer")}>
                            <UserPlus className="mr-2 h-4 w-4" />
                            Set as viewer
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleRemove(m.userId)}
                        >
                          <UserMinus className="mr-2 h-4 w-4" />
                          Remove from project
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </StaggerItem>
            );
          })}
        </StaggerContainer>
      </div>
    </MotionPage>
  );
}
