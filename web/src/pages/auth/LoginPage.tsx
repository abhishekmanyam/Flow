import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { toast } from "@/components/system/toast";
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
import { Link } from "@astryxdesign/core/Link";
import { Thumbnail } from "@astryxdesign/core/Thumbnail";

export default function LoginPage() {
  const navigate = useNavigate();
  const { signIn, loading } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error("Enter your email and password");
      return;
    }
    try {
      await signIn(email, password);
      navigate("/");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    }
  };

  return (
    <AppShell contentPadding={4}>
      <Center axis="both" height="100%">
        <VStack gap={4} hAlign="center" width="100%" maxWidth={400}>
          <VStack gap={2} hAlign="center">
            <Thumbnail src="/flowtask.png" alt="FlowTask" label="FlowTask" />
            <Heading level={1}>Welcome back</Heading>
            <Text type="supporting" color="secondary">
              Sign in to your workspace
            </Text>
          </VStack>

          <Card padding={8} width="100%">
            <form onSubmit={handleSubmit}>
              <FormLayout>
                <TextInput
                  label="Email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={setEmail}
                  isRequired
                  hasAutoFocus
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
                  <HStack justify="end">
                    <Link href="/forgot-password" isStandalone>
                      Forgot password?
                    </Link>
                  </HStack>
                </VStack>
                <Button
                  type="submit"
                  label="Sign in"
                  variant="primary"
                  width="100%"
                  isLoading={loading}
                />
              </FormLayout>
            </form>
          </Card>

          <Text type="supporting" color="secondary" justify="center">
            Access is invite-only. Contact your workspace admin for an invite.
          </Text>
        </VStack>
      </Center>
    </AppShell>
  );
}
