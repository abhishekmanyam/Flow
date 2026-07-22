import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { getInviteByToken, acceptInvite, upsertUserProfile, getUserWorkspace } from "@/lib/firestore";
import PasswordRequirements, { isPasswordValid } from "@/components/auth/PasswordRequirements";
import { toast } from "@/components/system/toast";
import type { Invite } from "@/lib/types";
import { AppShell } from "@astryxdesign/core/AppShell";
import { Center } from "@astryxdesign/core/Center";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Card } from "@astryxdesign/core/Card";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { FormLayout } from "@astryxdesign/core/FormLayout";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Button } from "@astryxdesign/core/Button";
import { Spinner } from "@astryxdesign/core/Spinner";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Thumbnail } from "@astryxdesign/core/Thumbnail";

/** Shared full-bleed centered shell for every InvitePage state. */
function InviteShell({ children }: { children: ReactNode }) {
  return (
    <AppShell contentPadding={4}>
      <Center axis="both" height="100%">
        <VStack gap={4} hAlign="center" width="100%" maxWidth={400}>
          {children}
        </VStack>
      </Center>
    </AppShell>
  );
}

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

  const handleAccept = async (e: FormEvent) => {
    e.preventDefault();
    if (!invite) return;
    if (!user) {
      if (mode === "signup" && !name.trim()) {
        toast.error("Enter your name");
        return;
      }
      if (!password) {
        toast.error("Enter a password");
        return;
      }
    }
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

  if (fetching) {
    return (
      <InviteShell>
        <Spinner size="lg" label="Loading invite..." />
      </InviteShell>
    );
  }

  if (invalid) {
    return (
      <InviteShell>
        <EmptyState
          title="Invalid or expired invite"
          description="Ask your admin to send a new invite link."
          actions={<Button label="Go to login" variant="primary" onClick={() => navigate("/login")} />}
        />
      </InviteShell>
    );
  }

  // Logged in but as the wrong user
  if (user && !emailMatch) {
    return (
      <InviteShell>
        <Thumbnail src="/flowtask.png" alt="FlowTask" label="FlowTask" />
        <EmptyState
          title="Wrong account"
          description={`This invite is for ${invite?.email}, but you're signed in as ${user.email}.`}
          actions={<Button label="Sign out & continue" variant="primary" clickAction={() => signOut()} />}
        />
      </InviteShell>
    );
  }

  return (
    <InviteShell>
      <VStack gap={2} hAlign="center">
        <Thumbnail src="/flowtask.png" alt="FlowTask" label="FlowTask" />
        <Heading level={1}>You&apos;re invited</Heading>
        <Text type="supporting" color="secondary" justify="center">
          Join {invite?.workspaceName} on FlowTask
        </Text>
      </VStack>

      <Card padding={8} width="100%">
        <form onSubmit={handleAccept}>
          <FormLayout>
            {user && emailMatch && (
              <Text type="supporting" color="secondary" justify="center">
                Signed in as {user.email}
              </Text>
            )}
            {!user && (
              <>
                {mode === "signup" && (
                  <TextInput
                    label="Your name"
                    placeholder="Jane Smith"
                    value={name}
                    onChange={setName}
                    isRequired
                    hasAutoFocus
                  />
                )}
                <TextInput label="Email" type="email" value={invite?.email ?? ""} isDisabled />
                <VStack gap={1}>
                  <TextInput
                    label={mode === "signup" ? "Create a password" : "Password"}
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={setPassword}
                    isRequired
                  />
                  {mode === "signup" && <PasswordRequirements password={password} />}
                </VStack>
                <HStack gap={1} justify="center">
                  <Text type="supporting" color="secondary">
                    {mode === "signup" ? "Already have an account?" : "Don't have an account?"}
                  </Text>
                  <Button
                    label={mode === "signup" ? "Sign in instead" : "Create one"}
                    variant="ghost"
                    size="sm"
                    onClick={() => setMode(mode === "signup" ? "login" : "signup")}
                  />
                </HStack>
              </>
            )}
            <Button
              type="submit"
              label={user ? "Accept invite & join workspace" : mode === "signup" ? "Sign up & join workspace" : "Sign in & join workspace"}
              variant="primary"
              width="100%"
              isLoading={accepting || authLoading}
              isDisabled={!user && mode === "signup" && !isPasswordValid(password)}
            />
          </FormLayout>
        </form>
      </Card>
    </InviteShell>
  );
}
