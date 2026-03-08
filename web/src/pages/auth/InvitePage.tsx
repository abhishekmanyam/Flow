import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { getInviteByToken, acceptInvite, upsertUserProfile, getUserWorkspace } from "@/lib/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import PasswordRequirements, { isPasswordValid } from "@/components/auth/PasswordRequirements";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { Invite } from "@/lib/types";

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, signIn, signUp, signOut, loading: authLoading } = useAuthStore();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [fetching, setFetching] = useState(true);
  const [invalid, setInvalid] = useState(false);
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [accepting, setAccepting] = useState(false);
  const [mode, setMode] = useState<"signup" | "login">("signup");

  useEffect(() => {
    if (!token) return;
    getInviteByToken(token)
      .then((inv) => {
        if (!inv) setInvalid(true);
        else setInvite(inv as unknown as Invite);
      })
      .catch((err) => { console.error("[InvitePage] invite lookup failed:", err); setInvalid(true); })
      .finally(() => setFetching(false));
  }, [token]);

  const emailMatch = user?.email?.toLowerCase() === invite?.email?.toLowerCase();

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invite) return;
    setAccepting(true);
    try {
      let uid = user?.uid;
      const isNewSignup = !uid && mode === "signup";

      if (!uid) {
        uid = mode === "signup"
          ? await signUp(invite.email, password)
          : await signIn(invite.email, password);
      }
      if (!uid) throw new Error("Authentication failed");

      // For new signups, create profile first (before acceptInvite which needs the user doc)
      if (isNewSignup) {
        await upsertUserProfile(uid, {
          id: uid,
          name,
          email: invite.email,
          avatarUrl: null,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
      }

      // acceptInvite adds member doc + uses arrayUnion for workspaceIds (safe for existing users)
      await acceptInvite(invite, uid);
      const result = await getUserWorkspace(uid);
      if (result) useAuthStore.getState().setWorkspace(result.workspace, result.role);
      toast.success(`Welcome to ${invite.workspaceName}!`);
      navigate(`/`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to accept invite");
    } finally {
      setAccepting(false);
    }
  };

  if (fetching) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="space-y-2 w-64">
        <Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );

  if (invalid) return (
    <div className="min-h-screen flex items-center justify-center text-center px-4">
      <div className="space-y-3">
        <h1 className="text-xl font-semibold">Invalid or expired invite</h1>
        <p className="text-sm text-muted-foreground">Ask your admin to send a new invite link.</p>
        <Button onClick={() => navigate("/login")}>Go to login</Button>
      </div>
    </div>
  );

  // Logged in but as the wrong user
  if (user && !emailMatch) return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="flex items-center justify-center mb-6">
          <img src="/flowtask.png" alt="FlowTask" className="h-12" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Wrong account</h1>
          <p className="text-sm text-muted-foreground">
            This invite is for <span className="font-medium text-foreground">{invite?.email}</span>, but you&apos;re signed in as <span className="font-medium text-foreground">{user.email}</span>.
          </p>
        </div>
        <Button className="w-full" onClick={() => signOut()}>
          Sign out &amp; continue
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center mb-6">
            <img src="/flowtask.png" alt="FlowTask" className="h-12" />
          </div>
          <h1 className="text-2xl font-semibold">You&apos;re invited</h1>
          <p className="text-sm text-muted-foreground">
            Join <span className="font-medium text-foreground">{invite?.workspaceName}</span> on FlowTask
          </p>
        </div>
        <form onSubmit={handleAccept} className="space-y-4">
          {user && emailMatch && (
            <p className="text-sm text-center text-muted-foreground">
              Signed in as <span className="font-medium text-foreground">{user.email}</span>
            </p>
          )}
          {!user && (
            <>
              {mode === "signup" && (
                <div className="space-y-2">
                  <Label>Your name</Label>
                  <Input placeholder="Jane Smith" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
              )}
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={invite?.email ?? ""} disabled />
              </div>
              <div className="space-y-2">
                <Label>{mode === "signup" ? "Create a password" : "Password"}</Label>
                <Input type="password" placeholder="••••••••" value={password}
                  onChange={(e) => setPassword(e.target.value)} required minLength={mode === "signup" ? 6 : 1} />
                {mode === "signup" && <PasswordRequirements password={password} />}
              </div>
              <p className="text-xs text-center text-muted-foreground">
                {mode === "signup" ? (
                  <>Already have an account?{" "}
                    <button type="button" className="text-primary underline" onClick={() => setMode("login")}>
                      Sign in instead
                    </button>
                  </>
                ) : (
                  <>Don&apos;t have an account?{" "}
                    <button type="button" className="text-primary underline" onClick={() => setMode("signup")}>
                      Create one
                    </button>
                  </>
                )}
              </p>
            </>
          )}
          <Button type="submit" className="w-full" disabled={accepting || authLoading || (!user && mode === "signup" && !isPasswordValid(password))}>
            {(accepting || authLoading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {user ? "Accept invite & join workspace" : mode === "signup" ? "Sign up & join workspace" : "Sign in & join workspace"}
          </Button>
        </form>
      </div>
    </div>
  );
}
