import { Icon } from "@astryxdesign/core/Icon";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";

export type PasswordCheck = {
  label: string;
  met: boolean;
};

export function validatePassword(password: string): PasswordCheck[] {
  return [
    { label: "At least 6 characters", met: password.length >= 6 },
    { label: "Uppercase letter", met: /[A-Z]/.test(password) },
    { label: "Lowercase letter", met: /[a-z]/.test(password) },
    { label: "Number", met: /[0-9]/.test(password) },
    { label: "Special character", met: /[^A-Za-z0-9]/.test(password) },
  ];
}

export function isPasswordValid(password: string): boolean {
  return validatePassword(password).every((c) => c.met);
}

export default function PasswordRequirements({ password }: { password: string }) {
  const checks = validatePassword(password);
  if (!password) return null;

  return (
    <VStack gap={1}>
      {checks.map((c) => (
        <HStack key={c.label} gap={1.5} align="center">
          <Icon icon={c.met ? "check" : "close"} size="xsm" color={c.met ? "success" : "error"} />
          <Text type="supporting" color="secondary">
            {c.label}
          </Text>
        </HStack>
      ))}
    </VStack>
  );
}
