import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

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
    <ul className="space-y-1 mt-2">
      {checks.map((c) => (
        <li key={c.label} className="flex items-center gap-1.5 text-xs">
          {c.met ? (
            <Check className="h-3 w-3 text-green-500 shrink-0" />
          ) : (
            <X className="h-3 w-3 text-destructive shrink-0" />
          )}
          <span className={cn(c.met ? "text-muted-foreground" : "text-destructive")}>
            {c.label}
          </span>
        </li>
      ))}
    </ul>
  );
}
