import { useEffect, useState } from "react";
import { Mail, Trash2 } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import {
  subscribeToMembers,
  createInvite,
  getPendingInvites,
  deleteInvite,
  updateMemberRole,
  removeWorkspaceMember,
} from "@/lib/firestore";
import { toast } from "@/components/system/toast";
import type { WorkspaceMember, Role, Invite } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/types";
import { sendInviteEmail } from "@/lib/email";
import { Layout, LayoutHeader, LayoutContent } from "@astryxdesign/core/Layout";
import { HStack } from "@astryxdesign/core/HStack";
import { VStack } from "@astryxdesign/core/VStack";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { Button } from "@astryxdesign/core/Button";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Avatar } from "@astryxdesign/core/Avatar";
import { Token } from "@astryxdesign/core/Token";
import { Selector } from "@astryxdesign/core/Selector";
import { Divider } from "@astryxdesign/core/Divider";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Table, proportional, pixel } from "@astryxdesign/core/Table";
import type { TableColumn } from "@astryxdesign/core/Table";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { LayoutFooter } from "@astryxdesign/core/Layout";
import { FormLayout } from "@astryxdesign/core/FormLayout";
import { TextInput } from "@astryxdesign/core/TextInput";
import { AlertDialog } from "@astryxdesign/core/AlertDialog";

interface MemberRow extends WorkspaceMember, Record<string, unknown> {}
interface InviteRow extends Invite, Record<string, unknown> {}

const ROLE_TOKEN_COLOR: Record<Role, "purple" | "blue" | "gray" | "teal"> = {
  admin: "purple",
  manager: "blue",
  member: "gray",
  hr: "teal",
  viewer: "gray",
};

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "member", label: "Member" },
  { value: "hr", label: "HR" },
  { value: "viewer", label: "Viewer" },
];

const INVITE_ROLE_OPTIONS = [
  { value: "admin", label: "Admin — full access" },
  { value: "manager", label: "Manager — create & manage projects" },
  { value: "member", label: "Member — edit tasks" },
  { value: "hr", label: "HR — view attendance & read-only projects" },
  { value: "viewer", label: "Viewer — read only" },
];

export default function MembersPage() {
  const { workspace, role, user } = useAuthStore();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("member");
  const [loading, setLoading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<WorkspaceMember | null>(null);
  const [pendingInvites, setPendingInvites] = useState<Invite[]>([]);
  const [invitesLoaded, setInvitesLoaded] = useState(false);

  useEffect(() => {
    if (!workspace) return;
    if (role === "admin") {
      getPendingInvites(workspace.id)
        .then(setPendingInvites)
        .finally(() => setInvitesLoaded(true));
    }
    setMembersLoaded(false);
    return subscribeToMembers(workspace.id, (m) => {
      setMembers(m);
      setMembersLoaded(true);
    });
  }, [workspace?.id, role]);

  if (!workspace || !user) return null;
  const isAdmin = role === "admin";

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const invite = await createInvite(workspace.id, workspace.name, inviteEmail, inviteRole, user.uid);
      setPendingInvites((prev) => [...prev, invite]);
      const inviteLink = `${window.location.origin}/invite/${invite.token}`;
      const emailSent = await sendInviteEmail({
        toEmail: inviteEmail,
        workspaceName: workspace.name,
        inviterName: user.displayName ?? "A team member",
        role: ROLE_LABELS[inviteRole],
        inviteLink,
      });
      toast.success(emailSent ? `Invite sent to ${inviteEmail}` : "Invite created — copy the link to share");
      setInviteEmail("");
      setInviteOpen(false);
    } catch {
      toast.error("Failed to create invite");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = (inv: Invite) => {
    const url = `${window.location.origin}/invite/${inv.token}`;
    navigator.clipboard.writeText(url);
    toast.success("Invite link copied to clipboard");
  };

  const handleDeleteInvite = async (inv: Invite) => {
    try {
      await deleteInvite(workspace.id, inv.id);
      setPendingInvites((prev) => prev.filter((i) => i.id !== inv.id));
      toast.success("Invite deleted");
    } catch {
      toast.error("Failed to delete invite");
    }
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;
    const m = memberToRemove;
    setRemovingId(m.userId);
    try {
      await removeWorkspaceMember(workspace.id, m.userId);
      toast.success(`${m.profile?.name ?? "Member"} has been removed`);
      setMemberToRemove(null);
    } catch {
      toast.error("Failed to remove member");
    } finally {
      setRemovingId(null);
    }
  };

  const memberColumns: TableColumn<MemberRow>[] = [
    {
      key: "member",
      header: "Member",
      width: proportional(2),
      renderCell: (m) => (
        <HStack gap={3} align="center">
          <Avatar size="small" src={m.profile?.avatarUrl ?? undefined} name={m.profile?.name} />
          <VStack gap={0}>
            <HStack gap={1.5} align="center">
              <Text weight="medium">{m.profile?.name || "Unknown"}</Text>
              {m.userId === user.uid && (
                <Text type="supporting" color="secondary">
                  (you)
                </Text>
              )}
            </HStack>
            <Text type="supporting" color="secondary">
              {m.profile?.email}
            </Text>
          </VStack>
        </HStack>
      ),
    },
    {
      key: "role",
      header: "Role",
      width: pixel(180),
      renderCell: (m) =>
        isAdmin && m.userId !== user.uid ? (
          <Selector
            label="Role"
            isLabelHidden
            size="sm"
            value={m.role}
            options={ROLE_OPTIONS}
            onChange={async (v) => {
              try {
                await updateMemberRole(workspace.id, m.userId, v as Role);
                toast.success("Role updated");
              } catch {
                toast.error("Failed to update role");
              }
            }}
          />
        ) : (
          <Token label={ROLE_LABELS[m.role]} color={ROLE_TOKEN_COLOR[m.role]} />
        ),
    },
    {
      key: "actions",
      header: "",
      width: pixel(56),
      align: "end",
      renderCell: (m) =>
        isAdmin && m.userId !== user.uid ? (
          <IconButton
            label="Remove member"
            tooltip="Remove member"
            variant="ghost"
            size="sm"
            icon={<Trash2 size={14} />}
            isLoading={removingId === m.userId}
            onClick={() => setMemberToRemove(m)}
          />
        ) : null,
    },
  ];

  const inviteColumns: TableColumn<InviteRow>[] = [
    {
      key: "invite",
      header: "Invite",
      width: proportional(2),
      renderCell: (inv) => (
        <HStack gap={3} align="center">
          <Mail size={16} />
          <VStack gap={0}>
            <Text weight="medium">{inv.email}</Text>
            <Text type="supporting" color="secondary" maxLines={1}>
              {window.location.origin}/invite/{inv.token}
            </Text>
          </VStack>
        </HStack>
      ),
    },
    {
      key: "role",
      header: "Role",
      width: pixel(140),
      renderCell: (inv) => <Token label={ROLE_LABELS[inv.role]} color={ROLE_TOKEN_COLOR[inv.role]} />,
    },
    {
      key: "actions",
      header: "",
      width: pixel(88),
      align: "end",
      renderCell: (inv) => (
        <HStack gap={1}>
          <IconButton
            label="Copy invite link"
            tooltip="Copy invite link"
            variant="ghost"
            size="sm"
            icon={<Mail size={14} />}
            onClick={() => handleCopyLink(inv)}
          />
          <IconButton
            label="Delete invite"
            tooltip="Delete invite"
            variant="ghost"
            size="sm"
            icon={<Trash2 size={14} />}
            onClick={() => handleDeleteInvite(inv)}
          />
        </HStack>
      ),
    },
  ];

  return (
    <Layout
      header={
        <LayoutHeader hasDivider>
          <HStack justify="between" align="center" paddingInline={4} paddingBlock={3}>
            <VStack gap={0}>
              <Heading level={1}>Members</Heading>
              <Text type="supporting" color="secondary">
                {members.length} member{members.length !== 1 ? "s" : ""}
              </Text>
            </VStack>
            {isAdmin && (
              <Button label="Invite member" variant="primary" onClick={() => setInviteOpen(true)} />
            )}
          </HStack>
        </LayoutHeader>
      }
    >
      <LayoutContent padding={0}>
        {!membersLoaded ? (
          <VStack padding={4} gap={2}>
            <Skeleton height={48} radius={2} />
            <Skeleton height={48} radius={2} />
            <Skeleton height={48} radius={2} />
          </VStack>
        ) : (
          <Table
            data={members as MemberRow[]}
            columns={memberColumns}
            idKey="userId"
            hasHover
            emptyState={
              <EmptyState
                title="No members yet"
                description="Invite teammates to collaborate in this workspace."
                isCompact
              />
            }
          />
        )}

        {isAdmin && invitesLoaded && pendingInvites.length > 0 && (
          <>
            <Divider />
            <VStack paddingInline={4} paddingBlock={3} gap={0}>
              <Heading level={3}>Pending invites ({pendingInvites.length})</Heading>
            </VStack>
            <Table data={pendingInvites as InviteRow[]} columns={inviteColumns} idKey="id" hasHover />
          </>
        )}
      </LayoutContent>

      <Dialog isOpen={inviteOpen} onOpenChange={setInviteOpen} purpose="form" width={440}>
        <Layout
          header={
            <DialogHeader
              title="Invite member"
              subtitle="Send an email invite to join this workspace."
              onOpenChange={setInviteOpen}
            />
          }
          content={
            <LayoutContent>
              <form id="invite-member-form" onSubmit={handleInvite}>
                <FormLayout>
                  <TextInput
                    label="Email address"
                    type="email"
                    placeholder="colleague@company.com"
                    value={inviteEmail}
                    onChange={setInviteEmail}
                    isRequired
                    hasAutoFocus
                  />
                  <Selector
                    label="Role"
                    value={inviteRole}
                    options={INVITE_ROLE_OPTIONS}
                    onChange={(v) => setInviteRole(v as Role)}
                  />
                </FormLayout>
              </form>
            </LayoutContent>
          }
          footer={
            <LayoutFooter>
              <HStack gap={2} justify="end">
                <Button label="Cancel" variant="secondary" onClick={() => setInviteOpen(false)} />
                <Button
                  label="Send invite"
                  variant="primary"
                  type="submit"
                  form="invite-member-form"
                  isLoading={loading}
                />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>

      <AlertDialog
        isOpen={!!memberToRemove}
        onOpenChange={(open) => !open && setMemberToRemove(null)}
        title="Remove member"
        description={`This will remove ${memberToRemove?.profile?.name ?? "this member"} from the workspace and all projects. They will be unassigned from any tasks. This action cannot be undone.`}
        actionLabel="Remove"
        isActionLoading={!!removingId}
        onAction={handleRemoveMember}
      />
    </Layout>
  );
}
