import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { createWorkspace, upsertUserProfile } from "@/lib/firestore";
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

function slugify(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
}

export default function SetupPage() {
  const navigate = useNavigate();
  const { user, setWorkspace } = useAuthStore();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const slug = slugify(name);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !user) return;
    setLoading(true);
    try {
      const workspace = await createWorkspace(name.trim(), slug, user.uid);
      await upsertUserProfile(user.uid, { workspaceIds: [workspace.id] });
      setWorkspace(workspace, "admin");
      navigate(`/${workspace.slug}/dashboard`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create workspace");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell contentPadding={4}>
      <Center axis="both" height="100%">
        <VStack gap={4} hAlign="center" width="100%" maxWidth={440}>
          <VStack gap={2} hAlign="center">
            <Thumbnail src="/flowtask.png" alt="FlowTask" label="FlowTask" />
            <Heading level={1}>Create your workspace</Heading>
            <Text type="supporting" color="secondary">
              Set up your team&apos;s home base
            </Text>
          </VStack>

          <Card padding={8} width="100%">
            <form onSubmit={handleSubmit}>
              <FormLayout>
                <TextInput
                  label="Workspace name"
                  placeholder="Acme Corp"
                  value={name}
                  onChange={setName}
                  isRequired
                  hasAutoFocus
                  description={slug ? `URL: flowtask.app/${slug}` : undefined}
                />
                <Button
                  type="submit"
                  label="Create workspace"
                  variant="primary"
                  width="100%"
                  isLoading={loading}
                  isDisabled={!name.trim()}
                />
              </FormLayout>
            </form>
          </Card>
        </VStack>
      </Center>
    </AppShell>
  );
}
