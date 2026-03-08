import { useMemo, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, CheckCircle, PartyPopper } from "lucide-react";
import { toast } from "sonner";
import type { RegistrationField } from "@/lib/types";
import { submitRegistration } from "@/lib/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface PublicRegistrationFormProps {
  wsId: string;
  eventId: string;
  fields: RegistrationField[];
  closed?: boolean;
  spotsLeft?: number | null;
}

function buildSchema(fields: RegistrationField[]) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of fields) {
    let v: z.ZodTypeAny = z.string();
    if (f.type === "email") v = z.string().email("Invalid email address");
    if (f.required) v = (v as z.ZodString).min(1, `${f.label} is required`);
    else v = v.optional().or(z.literal(""));
    shape[f.name] = v;
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

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const isSubmitting = form.formState.isSubmitting;

  if (closed || spotsLeft === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center space-y-2">
          <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mx-auto">
            <CheckCircle className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">
            {spotsLeft === 0
              ? "This event is full"
              : "Registration is closed"}
          </p>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            {spotsLeft === 0
              ? "All spots have been filled. Contact the organizer to join the waitlist."
              : "Registration for this event has ended."}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (registered) {
    return (
      <Card className="border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20">
        <CardContent className="py-10 text-center space-y-3">
          <div className="h-14 w-14 rounded-2xl bg-green-100 dark:bg-green-900/40 flex items-center justify-center mx-auto">
            <PartyPopper className="h-7 w-7 text-green-600 dark:text-green-400" />
          </div>
          <h3 className="text-lg font-semibold">You're registered!</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Your spot has been confirmed. We'll be in touch with more details
            soon.
          </p>
        </CardContent>
      </Card>
    );
  }

  async function onSubmit(values: Record<string, unknown>) {
    const data = values as Record<string, string>;
    try {
      await submitRegistration(wsId, eventId, data, data.email || "");
      toast.success("Registration confirmed!");
      form.reset();
      setRegistered(true);
    } catch {
      toast.error("Registration failed. Please try again.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Register for this event</CardTitle>
        <CardDescription>
          Fill out the form below to secure your spot
        </CardDescription>
      </CardHeader>
      <Separator />
      <CardContent className="pt-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {fields.map((field) => (
              <FormField
                key={field.name}
                control={form.control}
                name={field.name}
                render={({ field: formField }) => {
                  const val = (formField.value ?? "") as string;
                  return (
                    <FormItem>
                      <FormLabel>
                        {field.label}
                        {field.required && (
                          <span className="text-destructive ml-0.5">*</span>
                        )}
                      </FormLabel>
                      <FormControl>
                        {field.type === "select" ? (
                          <Select
                            onValueChange={formField.onChange}
                            value={val}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue
                                placeholder={
                                  field.placeholder || `Select ${field.label}`
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {field.options?.map((option) => (
                                <SelectItem key={option} value={option}>
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : field.type === "textarea" ? (
                          <Textarea
                            placeholder={field.placeholder}
                            rows={3}
                            {...formField}
                            value={val}
                          />
                        ) : (
                          <Input
                            type={
                              field.type === "email"
                                ? "email"
                                : field.type === "phone"
                                  ? "tel"
                                  : "text"
                            }
                            placeholder={field.placeholder}
                            {...formField}
                            value={val}
                          />
                        )}
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            ))}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isSubmitting ? "Registering..." : "Register"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
