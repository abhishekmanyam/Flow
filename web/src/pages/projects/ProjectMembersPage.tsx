import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { useProjectAccess } from "@/hooks/useProjectAccess";
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
import { Layout, LayoutContent, LayoutHeader, LayoutFooter } from "@astryxdesign/core/Layout";
import { HStack } from "@astryxdesign/core/HStack";
import { VStack } from "@astryxdesign/core/VStack";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { Avatar } from "@astryxdesign/core/Avatar";
import { Token } from "@astryxdesign/core/Token";
import { Button } from "@astryxdesign/core/Button";
import { MoreMenu } from "@astryxdesign/core/MoreMenu";
import { Table, proportional, pixel } from "@astryxdesign/core/Table";
import { Selector } from "@astryxdesign/core/Selector";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { FormLayout } from "@astryxdesign/core/FormLayout";
import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { Banner } from "@astryxdesign/core/Banner";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { toast } from "@/components/system/toast";
import { Plus, Users } from "lucide-react";
import { PROJECT_ROLE_LABELS } from "@/lib/types";
import type { Project, ProjectMember, ProjectRole, WorkspaceMember } from "@/lib/types";

type MemberRow = ProjectMember & Record<string, unknown>;

const ROLE_TOKEN_COLOR: Record<ProjectRole, "purple" | "gray" | "default"> = {
  project_admin: "purple",
  member: "default",
  viewer: "gray",
};

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
  const [removing, setRemoving] = useState<ProjectMember | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);

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
      <Layout>
        <LayoutContent padding={4}>
          <VStack gap={3}><Skeleton height={28} width={200} /><Skeleton height={240} /></VStack>
        </LayoutContent>
      </Layout>
    );
  }

  if (!hasAccess) {
    return (
      <Layout>
        <LayoutContent padding={4}>
          <Banner status="error" title="Access denied" description="You don't have access to this project." />
        </LayoutContent>
      </Layout>
    );
  }

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

  const handleRemove = async () => {
    if (!removing) return;
    setRemoveLoading(true);
    try {
      await removeProjectMember(workspace.id, projectId!, removing.userId);
      toast.success("Member removed");
      setRemoving(null);
    } catch {
      toast.error("Failed to remove member");
    } finally {
      setRemoveLoading(false);
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

  const rows = projectMembers as MemberRow[];

  return (
    <>
    <Layout
      header={<ProjectHeader project={project} workspaceSlug={slug!} canEdit={canEdit} isProjectAdmin={isProjectAdmin} />}
      content={
        <Layout
          header={
            <LayoutHeader hasDivider>
              <HStack justify="between" align="center" paddingInline={4} paddingBlock={3}>
                <Heading level={2}>Members ({projectMembers.length})</Heading>
                {isProjectAdmin && (
                  <Button label="Add member" variant="primary" size="sm" icon={<Plus size={16} />} onClick={() => setAddDialogOpen(true)} />
                )}
              </HStack>
            </LayoutHeader>
          }
          content={
            <LayoutContent padding={0}>
              {projectMembers.length === 0 ? (
                <EmptyState icon={<Users size={28} />} title="No members yet" description="Add workspace members to this project." />
              ) : (
                <Table
                  data={rows}
                  idKey="userId"
                  hasHover
                  dividers="rows"
                  columns={[
                    {
                      key: "member",
                      header: "Member",
                      width: proportional(2),
                      renderCell: (m: MemberRow) => {
                        const isSelf = m.userId === user?.uid;
                        return (
                          <HStack gap={2} align="center">
                            <Avatar size="small" src={m.profile?.avatarUrl ?? undefined} name={m.profile?.name ?? "Unknown"} />
                            <VStack gap={0}>
                              <Text type="body" weight="medium">
                                {m.profile?.name || "Unknown"}{isSelf ? " (you)" : ""}
                              </Text>
                              {m.profile?.email && <Text type="supporting" color="secondary">{m.profile.email}</Text>}
                            </VStack>
                          </HStack>
                        );
                      },
                    },
                    {
                      key: "role",
                      header: "Role",
                      width: pixel(160),
                      renderCell: (m: MemberRow) => (
                        <Token label={PROJECT_ROLE_LABELS[m.role]} color={ROLE_TOKEN_COLOR[m.role]} />
                      ),
                    },
                    {
                      key: "actions",
                      header: "",
                      width: pixel(56),
                      align: "end",
                      renderCell: (m: MemberRow) => {
                        const isSelf = m.userId === user?.uid;
                        if (!isProjectAdmin || isSelf) return null;
                        const items = [
                          ...(m.role !== "project_admin" ? [{ label: "Make project admin", onClick: () => handleRoleChange(m.userId, "project_admin") }] : []),
                          ...(m.role !== "member" ? [{ label: "Set as member", onClick: () => handleRoleChange(m.userId, "member") }] : []),
                          ...(m.role !== "viewer" ? [{ label: "Set as viewer", onClick: () => handleRoleChange(m.userId, "viewer") }] : []),
                          { type: "divider" as const },
                          { label: "Remove from project", onClick: () => setRemoving(m) },
                        ];
                        return <MoreMenu label="Member actions" items={items} />;
                      },
                    },
                  ]}
                />
              )}
            </LayoutContent>
          }
        />
      }
    />

    {addDialogOpen && (
      <Dialog isOpen={addDialogOpen} onOpenChange={setAddDialogOpen} purpose="form" width={440}>
        <Layout
          header={<DialogHeader title="Add project member" onOpenChange={setAddDialogOpen} />}
          content={
            <LayoutContent padding={4}>
              {availableMembers.length === 0 ? (
                <Banner status="info" title="Everyone's already here" description="All workspace members are already in this project." />
              ) : (
                <FormLayout>
                  <Selector
                    label="Member"
                    placeholder="Select a member"
                    value={selectedUserId}
                    onChange={setSelectedUserId}
                    options={availableMembers.map((m) => ({ value: m.userId, label: m.profile?.name || m.profile?.email || m.userId }))}
                  />
                  <Selector
                    label="Role"
                    value={selectedRole}
                    onChange={(v) => setSelectedRole(v as ProjectRole)}
                    options={[
                      { value: "project_admin", label: "Project Admin" },
                      { value: "member", label: "Member" },
                      { value: "viewer", label: "Viewer" },
                    ]}
                  />
                </FormLayout>
              )}
            </LayoutContent>
          }
          footer={
            availableMembers.length === 0 ? undefined : (
              <LayoutFooter hasDivider>
                <HStack gap={2} hAlign="end">
                  <Button label="Cancel" variant="secondary" onClick={() => setAddDialogOpen(false)} />
                  <Button label="Add to project" variant="primary" isDisabled={!selectedUserId} isLoading={adding} clickAction={handleAdd} />
                </HStack>
              </LayoutFooter>
            )
          }
        />
      </Dialog>
    )}

    <AlertDialog
      isOpen={!!removing}
      onOpenChange={(v) => !v && setRemoving(null)}
      title="Remove member"
      description={`Remove ${removing?.profile?.name ?? "this member"} from the project? They will lose access to project resources.`}
      actionLabel="Remove"
      isActionLoading={removeLoading}
      onAction={handleRemove}
    />
    </>
  );
}
