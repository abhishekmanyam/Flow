import { useMemo, useState } from "react";
import { z } from "zod";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "@/components/system/toast";
import type { RegistrationField } from "@/lib/types";
import { submitRegistration } from "@/lib/firestore";
import { VStack } from "@astryxdesign/core/VStack";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { Button } from "@astryxdesign/core/Button";
import { TextInput } from "@astryxdesign/core/TextInput";
import { TextArea } from "@astryxdesign/core/TextArea";
import { Selector } from "@astryxdesign/core/Selector";
import { FormLayout } from "@astryxdesign/core/FormLayout";
import { Banner } from "@astryxdesign/core/Banner";

interface PublicRegistrationFormProps {
  wsId: string;
  eventId: string;
  fields: RegistrationField[];
  closed?: boolean;
  spotsLeft?: number | null;
}

// Lenient on purpose: digits plus the usual separators, so international
// formats like "+91 98765 43210" and "(555) 123-4567" both pass.
const PHONE_RE = /^\+?[\d\s().-]{7,20}$/;

function buildSchema(fields: RegistrationField[]) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of fields) {
    let s = z.string();
    // Required check first so an empty field reports "is required" rather than
    // a format complaint.
    if (f.required) s = s.min(1, `${f.label || "This field"} is required`);
    if (f.type === "email") s = s.email("Invalid email address");
    if (f.type === "phone") s = s.regex(PHONE_RE, "Enter a valid phone number");
    shape[f.name] = f.required ? s : s.optional().or(z.literal(""));
  }
  return z.object(shape);
}

export default function PublicRegistrationForm({
  wsId,
  eventId,
  fields,
  closed,
  spotsLeft,
}: PublicRegistrationFormProps) {
  const [registered, setRegistered] = useState(false);

  const schema = useMemo(() => buildSchema(fields), [fields]);

  const defaultValues = useMemo(() => {
    const values: Record<string, string> = {};
    for (const f of fields) {
      values[f.name] = "";
    }
    return values;
  }, [fields]);

  const { control, handleSubmit, reset, formState } = useForm({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const isSubmitting = formState.isSubmitting;

  if (closed || spotsLeft === 0) {
    return (
      <Banner
        status="info"
        title={spotsLeft === 0 ? "This event is full" : "Registration is closed"}
        description={
          spotsLeft === 0
            ? "All spots have been filled. Contact the organizer to join the waitlist."
            : "Registration for this event has ended."
        }
      />
    );
  }

  if (registered) {
    return (
      <Banner
        status="success"
        title="You're registered!"
        description="Your spot has been confirmed. We'll be in touch with more details soon."
      />
    );
  }

  async function onSubmit(values: Record<string, unknown>) {
    const data = values as Record<string, string>;
    try {
      await submitRegistration(wsId, eventId, data, data.email || "");
      toast.success("Registration confirmed!");
      reset();
      setRegistered(true);
    } catch {
      toast.error("Registration failed. Please try again.");
    }
  }

  return (
    <VStack gap={5}>
      <VStack gap={1}>
        <Heading level={2}>Register for this event</Heading>
        <Text type="supporting">Fill out the form below to secure your spot.</Text>
      </VStack>

      <form onSubmit={handleSubmit(onSubmit)}>
        <FormLayout>
          {fields.map((field) => (
            <Controller
              key={field.name}
              name={field.name}
              control={control}
              render={({ field: rhf, fieldState }) => {
                const value = (rhf.value ?? "") as string;
                const status = fieldState.error
                  ? { type: "error" as const, message: fieldState.error.message }
                  : undefined;

                if (field.type === "select") {
                  return (
                    <Selector
                      label={field.label}
                      isRequired={field.required}
                      isOptional={!field.required}
                      placeholder={field.placeholder || `Select ${field.label}`}
                      options={field.options ?? []}
                      hasSearch={(field.options?.length ?? 0) > 8}
                      value={value}
                      onChange={rhf.onChange}
                      status={status}
                    />
                  );
                }

                if (field.type === "textarea") {
                  return (
                    <TextArea
                      label={field.label}
                      isRequired={field.required}
                      isOptional={!field.required}
                      placeholder={field.placeholder}
                      rows={3}
                      value={value}
                      onChange={rhf.onChange}
                      onBlur={rhf.onBlur}
                      status={status}
                    />
                  );
                }

                return (
                  <TextInput
                    label={field.label}
                    type={field.type === "email" ? "email" : "text"}
                    isRequired={field.required}
                    isOptional={!field.required}
                    placeholder={field.placeholder}
                    value={value}
                    onChange={rhf.onChange}
                    status={status}
                  />
                );
              }}
            />
          ))}

          <Button
            type="submit"
            variant="primary"
            width="100%"
            label={isSubmitting ? "Registering..." : "Register"}
            isLoading={isSubmitting}
          />
        </FormLayout>
      </form>
    </VStack>
  );
}
