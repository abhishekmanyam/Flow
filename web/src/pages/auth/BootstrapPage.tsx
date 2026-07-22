import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { createWorkspace, upsertUserProfile, getUserWorkspace } from "@/lib/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import PasswordRequirements, { isPasswordValid } from "@/components/auth/PasswordRequirements";
import { toast } from "@/components/system/toast";
import { AppShell } from "@astryxdesign/core/AppShell";
import { Center } from "@astryxdesign/core/Center";
import { VStack } from "@astryxdesign/core/VStack";
import { Card } from "@astryxdesign/core/Card";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { FormLayout } from "@astryxdesign/core/FormLayout";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Button } from "@astryxdesign/core/Button";
import { Thumbnail } from "@astryxdesign/core/Thumbnail";

export default function BootstrapPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [wsName, setWsName] = useState("CoreDefender AI");
  const [loading, setLoading] = useState(false);

  const slug = wsName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!wsName.trim() || !name.trim() || !email.trim() || !isPasswordValid(password)) {
      toast.error("Fill in all fields with a valid password");
      return;
    }
    setLoading(true);
    try {
      // 1. Create Firebase Auth account
      const { user } = await createUserWithEmailAndPassword(auth, email, password);

      // 2. Create workspace + admin member doc
      const workspace = await createWorkspace(wsName.trim(), slug, user.uid);

      // 3. Create user profile with workspace link
      await upsertUserProfile(user.uid, {
        id: user.uid,
        name,
        email,
        avatarUrl: null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        workspaceIds: [workspace.id],
      });

      // 4. Load workspace into store
      const result = await getUserWorkspace(user.uid);
      if (result) {
        useAuthStore.getState().setWorkspace(result.workspace, result.role);
      }

      toast.success("Admin account created!");
      navigate("/");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Bootstrap failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell contentPadding={4}>
      <Center axis="both" height="100%">
        <VStack gap={4} hAlign="center" width="100%" maxWidth={400}>
          <VStack gap={2} hAlign="center">
            <Thumbnail src="/flowtask.png" alt="FlowTask" label="FlowTask" />
            <Heading level={1}>Bootstrap Admin</Heading>
            <Text type="supporting" color="secondary">
              Create the first admin account and workspace
            </Text>
          </VStack>

          <Card padding={8} width="100%">
            <form onSubmit={handleSubmit}>
              <FormLayout>
                <TextInput
                  label="Workspace name"
                  value={wsName}
                  onChange={setWsName}
                  isRequired
                  description={slug ? `Slug: ${slug}` : undefined}
                />
                <TextInput label="Your name" placeholder="Abhishek" value={name} onChange={setName} isRequired />
                <TextInput
                  label="Email"
                  type="email"
                  placeholder="admin@company.com"
                  value={email}
                  onChange={setEmail}
                  isRequired
                />
                <VStack gap={1}>
                  <TextInput
                    label="Password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={setPassword}
                    isRequired
                  />
                  <PasswordRequirements password={password} />
                </VStack>
                <Button
                  type="submit"
                  label="Create admin account"
                  variant="primary"
                  width="100%"
                  isLoading={loading}
                  isDisabled={!isPasswordValid(password)}
                />
              </FormLayout>
            </form>
          </Card>
        </VStack>
      </Center>
    </AppShell>
  );
}
