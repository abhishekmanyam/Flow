import { useState, type FormEvent } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
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
import { Link } from "@astryxdesign/core/Link";
import { Icon } from "@astryxdesign/core/Icon";
import { Thumbnail } from "@astryxdesign/core/Thumbnail";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Enter your email address");
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setSent(true);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to send reset email"
      );
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
            <Heading level={1}>Reset your password</Heading>
            <Text type="supporting" color="secondary" justify="center">
              Enter your email and we&apos;ll send you a reset link
            </Text>
          </VStack>

          {sent ? (
            <VStack gap={3} hAlign="center" width="100%">
              <Icon icon="success" color="success" size="lg" />
              <Text type="supporting" color="secondary" justify="center">
                Check your inbox for a password reset link. It may take a
                minute to arrive.
              </Text>
            </VStack>
          ) : (
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
                  <Button
                    type="submit"
                    label="Send reset link"
                    variant="primary"
                    width="100%"
                    isLoading={loading}
                  />
                </FormLayout>
              </form>
            </Card>
          )}

          <Text type="supporting" color="secondary">
            <Link href="/login">Back to sign in</Link>
          </Text>
        </VStack>
      </Center>
    </AppShell>
  );
}
