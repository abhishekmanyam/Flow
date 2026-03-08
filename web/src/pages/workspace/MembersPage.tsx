import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth";
import { subscribeToMembers, createInvite, getPendingInvites, deleteInvite, updateMemberRole, removeWorkspaceMember } from "@/lib/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MotionPage } from "@/components/ui/motion-page";
import { StaggerContainer, StaggerItem } from "@/components/ui/stagger";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Loader2, Plus, Mail, Copy, Trash2 } from "lucide-react";
import type { WorkspaceMember, Role, Invite } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/types";
import { sendInviteEmail } from "@/lib/email";

function getInitials(name: string | null | undefined) {
  if (!name) return "?";
  return name.split(/\s/).map((s) => s[0]?.toUpperCase()).slice(0, 2).join("");
}

export default function MembersPage() {
  const { workspace, role, user } = useAuthStore();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("member");
  const [loading, setLoading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [pendingInvites, setPendingInvites] = useState<Invite[]>([]);

  useEffect(() => {
    if (!workspace) return;
    if (role === "admin") getPendingInvites(workspace.id).then(setPendingInvites);
    return subscribeToMembers(workspace.id, setMembers);
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

  const handleRemoveMember = async (m: WorkspaceMember) => {
    setRemovingId(m.userId);
    try {
      await removeWorkspaceMember(workspace.id, m.userId);
      toast.success(`${m.profile?.name ?? "Member"} has been removed`);
    } catch {
      toast.error("Failed to remove member");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <MotionPage className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Members</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{members.length} member{members.length !== 1 ? "s" : ""}</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setInviteOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />Invite member
          </Button>
        )}
      </div>

      <StaggerContainer className="space-y-2">
        {members.map((m) => (
          <StaggerItem key={m.userId} className="flex items-center justify-between p-3 rounded-lg border">
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9">
                <AvatarImage src={m.profile?.avatarUrl ?? undefined} />
                <AvatarFallback>{getInitials(m.profile?.name)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">
                  {m.profile?.name || "Unknown"}
                  {m.userId === user.uid && <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>}
                </p>
                <p className="text-xs text-muted-foreground">{m.profile?.email}</p>
              </div>
            </div>
            {isAdmin && m.userId !== user.uid ? (
              <div className="flex items-center gap-1.5">
                <Select
                  value={m.role}
                  onValueChange={async (v) => {
                    try {
                      await updateMemberRole(workspace.id, m.userId, v as Role);
                      toast.success("Role updated");
                    } catch {
                      toast.error("Failed to update role");
                    }
                  }}
                >
                  <SelectTrigger className="w-[140px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="hr">HR</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      disabled={removingId === m.userId}
                    >
                      {removingId === m.userId ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove member</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove <span className="font-medium text-foreground">{m.profile?.name ?? "this member"}</span> from
                        the workspace and all projects. They will be unassigned from any tasks. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleRemoveMember(m)}>
                        Remove
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ) : (
              <Badge variant="secondary" className="capitalize">{m.role}</Badge>
            )}
          </StaggerItem>
        ))}
      </StaggerContainer>

      {isAdmin && pendingInvites.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground">Pending invites ({pendingInvites.length})</h2>
            {pendingInvites.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg border border-dashed">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{inv.email}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {window.location.origin}/invite/{inv.token}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-3">
                  <Badge variant="outline" className="capitalize">{inv.role}</Badge>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleCopyLink(inv)}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Copy invite link</TooltipContent>
                  </Tooltip>
                  {isAdmin && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteInvite(inv)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete invite</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Invite member</DialogTitle></DialogHeader>
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="space-y-2">
              <Label>Email address</Label>
              <Input type="email" placeholder="colleague@company.com" value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)} required autoFocus />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as Role)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin — full access</SelectItem>
                  <SelectItem value="manager">Manager — create &amp; manage projects</SelectItem>
                  <SelectItem value="member">Member — edit tasks</SelectItem>
                  <SelectItem value="hr">HR — view attendance &amp; read-only projects</SelectItem>
                  <SelectItem value="viewer">Viewer — read only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Send invite
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </MotionPage>
  );
}
