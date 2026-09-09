import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Timestamp } from "firebase/firestore";
import { Globe, UserCheck, Repeat, CalendarCheck, CircleDashed } from "lucide-react";
import { toast } from "@/components/system/toast";
import type {
  CalendarEvent,
  EventCategory,
  RegistrationField,
  RepeatingType,
} from "@/lib/types";
import {
  EVENT_CATEGORY_LABELS,
  PROJECT_COLORS,
  DEFAULT_REGISTRATION_FIELDS,
} from "@/lib/types";
import { createCalendarEvent, updateCalendarEvent } from "@/lib/firestore";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import {
  Layout,
  LayoutContent,
  LayoutFooter,
} from "@astryxdesign/core/Layout";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { Divider } from "@astryxdesign/core/Divider";
import { Button } from "@astryxdesign/core/Button";
import { TextInput } from "@astryxdesign/core/TextInput";
import { TextArea } from "@astryxdesign/core/TextArea";
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { DateInput } from "@astryxdesign/core/DateInput";
import { TimeInput } from "@astryxdesign/core/TimeInput";
import type { ISODateString } from "@astryxdesign/core/Calendar";
import type { ISOTimeString } from "@astryxdesign/core/TimeInput";
import { Selector } from "@astryxdesign/core/Selector";
import { Token } from "@astryxdesign/core/Token";
import type { SelectorOptionData } from "@astryxdesign/core/Selector";
import RegistrationFormBuilder from "./RegistrationFormBuilder";

type TokenColor =
  | "default"
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "teal"
  | "cyan"
  | "blue"
  | "purple"
  | "pink"
  | "gray";

// Named + Astryx-token mapping for the fixed brand palette, so the color picker
// is a real Astryx Selector (Token swatches) rather than raw hex chips, while
// still storing the hex value the calendar / ICS export need.
const COLOR_META: Record<string, { label: string; token: TokenColor }> = {
  "#6366f1": { label: "Indigo", token: "blue" },
  "#8b5cf6": { label: "Violet", token: "purple" },
  "#ec4899": { label: "Pink", token: "pink" },
  "#f97316": { label: "Orange", token: "orange" },
  "#eab308": { label: "Yellow", token: "yellow" },
  "#22c55e": { label: "Green", token: "green" },
  "#14b8a6": { label: "Teal", token: "teal" },
  "#3b82f6": { label: "Blue", token: "blue" },
  "#ef4444": { label: "Red", token: "red" },
  "#a855f7": { label: "Purple", token: "purple" },
};

const COLOR_OPTIONS = PROJECT_COLORS.map((c) => ({
  value: c,
  label: COLOR_META[c]?.label ?? c,
}));

const CATEGORY_OPTIONS = (
  Object.entries(EVENT_CATEGORY_LABELS) as [EventCategory, string][]
).map(([value, label]) => ({ value, label }));

const REPEAT_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const eventFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  startDate: z.string().min(1, "Start date is required"),
  startTime: z.string().optional(),
  endDate: z.string().min(1, "End date is required"),
  endTime: z.string().optional(),
  allDay: z.boolean(),
  location: z.string().optional(),
  category: z.enum(["meeting", "workshop", "webinar", "social", "other"]),
  color: z.string(),
  isRepeating: z.boolean(),
  repeatingType: z.enum(["daily", "weekly", "monthly"]).nullable(),
  repeatingEndDate: z.string().optional(),
  rsvpEnabled: z.boolean(),
  rsvpDeadline: z.string().optional(),
  isOptional: z.boolean(),
  isPublic: z.boolean(),
  registrationOpen: z.boolean(),
  maxRegistrations: z.string().optional(),
});

type EventFormValues = z.infer<typeof eventFormSchema>;

function toDate(val: unknown): Date {
  if (!val) return new Date();
  if (val instanceof Date) return val;
  if (typeof val === "object" && "toDate" in (val as Record<string, unknown>))
    return (val as { toDate: () => Date }).toDate();
  return new Date(val as string);
}

function formatDateForInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatTimeForInput(date: Date): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

// Firestore rejects `undefined` field values outright — a single
// `options: undefined` left behind by a type change (e.g. Dropdown → Phone
// Number) fails the whole event write. Rebuild each field with only the keys
// that actually carry a value.
function sanitizeRegistrationFields(
  fields: RegistrationField[]
): RegistrationField[] {
  return fields.map((f) => {
    const clean: RegistrationField = {
      name: f.name,
      label: f.label.trim(),
      type: f.type,
      required: f.required,
    };
    if (f.type === "select") {
      clean.options = (f.options ?? []).map((o) => o.trim()).filter(Boolean);
    }
    if (f.placeholder) clean.placeholder = f.placeholder;
    return clean;
  });
}

interface CreateEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wsId: string;
  workspaceName: string;
  userId: string;
  event?: CalendarEvent;
  defaultDate?: Date;
}

export default function CreateEventDialog({
  open,
  onOpenChange,
  wsId,
  workspaceName,
  userId,
  event,
  defaultDate,
}: CreateEventDialogProps) {
  const isEditing = !!event;
  const [loading, setLoading] = useState(false);
  const [registrationFields, setRegistrationFields] = useState<
    RegistrationField[]
  >(event?.registrationFields ?? [...DEFAULT_REGISTRATION_FIELDS]);

  const defaultStartDate = event
    ? toDate(event.startDate)
    : defaultDate ?? new Date();
  const defaultEndDate = event ? toDate(event.endDate) : defaultStartDate;

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: event?.title ?? "",
      description: event?.description ?? "",
      startDate: formatDateForInput(defaultStartDate),
      startTime: event ? formatTimeForInput(toDate(event.startDate)) : "09:00",
      endDate: formatDateForInput(defaultEndDate),
      endTime: event ? formatTimeForInput(toDate(event.endDate)) : "10:00",
      allDay: event?.allDay ?? false,
      location: event?.location ?? "",
      category: event?.category ?? "meeting",
      color: event?.color ?? PROJECT_COLORS[0],
      isRepeating: event?.isRepeating ?? false,
      repeatingType: event?.repeatingType ?? null,
      repeatingEndDate: event?.repeatingEndDate
        ? formatDateForInput(toDate(event.repeatingEndDate))
        : "",
      rsvpEnabled: event?.rsvpEnabled ?? false,
      rsvpDeadline: event?.rsvpDeadline
        ? formatDateForInput(toDate(event.rsvpDeadline))
        : "",
      isOptional: event?.isOptional ?? false,
      isPublic: event?.isPublic ?? false,
      registrationOpen: event?.registrationOpen ?? false,
      maxRegistrations:
        event?.maxRegistrations != null ? String(event.maxRegistrations) : "",
    },
  });

  const allDay = form.watch("allDay");
  const isRepeating = form.watch("isRepeating");
  const rsvpEnabled = form.watch("rsvpEnabled");
  const isPublic = form.watch("isPublic");

  const handleSubmit = async (values: EventFormValues) => {
    const cleanFields = sanitizeRegistrationFields(registrationFields);

    if (values.isPublic && values.registrationOpen) {
      const unlabeled = cleanFields.find((f) => !f.label);
      if (unlabeled) {
        toast.error("Every registration field needs a label");
        return;
      }
      const emptySelect = cleanFields.find(
        (f) => f.type === "select" && (f.options?.length ?? 0) === 0
      );
      if (emptySelect) {
        toast.error(`"${emptySelect.label}" needs at least one dropdown option`);
        return;
      }
    }

    setLoading(true);
    try {
      const startDateStr = values.allDay
        ? `${values.startDate}T00:00:00`
        : `${values.startDate}T${values.startTime || "00:00"}`;
      const endDateStr = values.allDay
        ? `${values.endDate}T23:59:59`
        : `${values.endDate}T${values.endTime || "23:59"}`;

      const startTimestamp = Timestamp.fromDate(new Date(startDateStr));
      const endTimestamp = Timestamp.fromDate(new Date(endDateStr));

      const maxReg =
        !values.maxRegistrations || values.maxRegistrations.trim() === ""
          ? null
          : Number(values.maxRegistrations);

      if (isEditing && event) {
        const baseEventId = event.id.includes("_")
          ? event.id.substring(0, event.id.lastIndexOf("_"))
          : event.id;
        await updateCalendarEvent(wsId, baseEventId, {
          title: values.title,
          description: values.description ?? "",
          startDate: startTimestamp,
          endDate: endTimestamp,
          allDay: values.allDay,
          location: values.location || null,
          category: values.category,
          color: values.color,
          isRepeating: values.isRepeating,
          repeatingType: values.isRepeating
            ? (values.repeatingType as RepeatingType)
            : null,
          repeatingEndDate:
            values.isRepeating && values.repeatingEndDate
              ? Timestamp.fromDate(new Date(`${values.repeatingEndDate}T23:59:59`))
              : null,
          rsvpEnabled: values.rsvpEnabled,
          rsvpDeadline:
            values.rsvpEnabled && values.rsvpDeadline
              ? Timestamp.fromDate(new Date(`${values.rsvpDeadline}T23:59:59`))
              : null,
          isOptional: values.isOptional,
          isPublic: values.isPublic,
          registrationOpen: values.registrationOpen,
          maxRegistrations: maxReg,
          registrationFields: cleanFields,
        });
        toast.success("Event updated");
      } else {
        await createCalendarEvent(wsId, {
          workspaceId: wsId,
          title: values.title,
          description: values.description ?? "",
          startDate: startTimestamp,
          endDate: endTimestamp,
          allDay: values.allDay,
          location: values.location || null,
          category: values.category,
          color: values.color,
          isRepeating: values.isRepeating,
          repeatingType: values.isRepeating
            ? (values.repeatingType as RepeatingType)
            : null,
          repeatingEndDate:
            values.isRepeating && values.repeatingEndDate
              ? Timestamp.fromDate(new Date(`${values.repeatingEndDate}T23:59:59`))
              : null,
          rsvpEnabled: values.rsvpEnabled,
          rsvpDeadline:
            values.rsvpEnabled && values.rsvpDeadline
              ? Timestamp.fromDate(new Date(`${values.rsvpDeadline}T23:59:59`))
              : null,
          isOptional: values.isOptional,
          isPublic: values.isPublic,
          registrationOpen: values.registrationOpen,
          maxRegistrations: maxReg,
          excludedDates: [],
          registrationFields: cleanFields,
          workspaceName,
          createdBy: userId,
        });
        toast.success("Event created");
      }
      onOpenChange(false);
    } catch (err) {
      console.error("Event save error:", err);
      toast.error(
        isEditing ? "Failed to update event" : "Failed to create event"
      );
    } finally {
      setLoading(false);
    }
  };

  const renderColorOption = (option: SelectorOptionData) => (
    <Token
      label={option.label ?? option.value}
      color={COLOR_META[option.value]?.token ?? "default"}
      size="sm"
    />
  );

  const sectionLabel = (label: string) => (
    <VStack gap={2}>
      <Divider />
      <Text type="label" color="secondary" weight="semibold">
        {label}
      </Text>
    </VStack>
  );

  return (
    <Dialog isOpen={open} onOpenChange={onOpenChange} purpose="form" width={600}>
      <Layout
        header={
          <DialogHeader
            title={isEditing ? "Edit event" : "New event"}
            subtitle={
              isEditing
                ? "Update the event details below."
                : "Fill in the details to create a new event."
            }
            onOpenChange={onOpenChange}
          />
        }
        content={
          <LayoutContent>
            <form id="event-form" onSubmit={form.handleSubmit(handleSubmit)}>
              <VStack gap={4}>
                {/* Basic info */}
                <Controller
                  control={form.control}
                  name="title"
                  render={({ field, fieldState }) => (
                    <TextInput
                      label="Title"
                      isRequired
                      placeholder="Event title"
                      value={field.value}
                      onChange={field.onChange}
                      status={
                        fieldState.error
                          ? { type: "error", message: fieldState.error.message }
                          : undefined
                      }
                    />
                  )}
                />

                <Controller
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <TextArea
                      label="Description"
                      isOptional
                      rows={3}
                      placeholder="What's this event about?"
                      value={field.value ?? ""}
                      onChange={field.onChange}
                    />
                  )}
                />

                {/* Date & time */}
                {sectionLabel("Date & time")}

                <Controller
                  control={form.control}
                  name="allDay"
                  render={({ field }) => (
                    <CheckboxInput
                      label="All day event"
                      value={field.value}
                      onChange={(checked) => field.onChange(checked)}
                    />
                  )}
                />

                <HStack gap={3} align="start">
                  <Controller
                    control={form.control}
                    name="startDate"
                    render={({ field, fieldState }) => (
                      <DateInput
                        label="Start date"
                        value={field.value as ISODateString}
                        onChange={(v) => field.onChange(v ?? "")}
                        status={
                          fieldState.error
                            ? { type: "error", message: fieldState.error.message }
                            : undefined
                        }
                      />
                    )}
                  />
                  {!allDay && (
                    <Controller
                      control={form.control}
                      name="startTime"
                      render={({ field }) => (
                        <TimeInput
                          label="Start time"
                          value={(field.value ?? "") as ISOTimeString}
                          onChange={(v) => field.onChange(v ?? "")}
                        />
                      )}
                    />
                  )}
                </HStack>

                <HStack gap={3} align="start">
                  <Controller
                    control={form.control}
                    name="endDate"
                    render={({ field, fieldState }) => (
                      <DateInput
                        label="End date"
                        value={field.value as ISODateString}
                        onChange={(v) => field.onChange(v ?? "")}
                        status={
                          fieldState.error
                            ? { type: "error", message: fieldState.error.message }
                            : undefined
                        }
                      />
                    )}
                  />
                  {!allDay && (
                    <Controller
                      control={form.control}
                      name="endTime"
                      render={({ field }) => (
                        <TimeInput
                          label="End time"
                          value={(field.value ?? "") as ISOTimeString}
                          onChange={(v) => field.onChange(v ?? "")}
                        />
                      )}
                    />
                  )}
                </HStack>

                {/* Recurrence */}
                <Controller
                  control={form.control}
                  name="isRepeating"
                  render={({ field }) => (
                    <CheckboxInput
                      label="Recurring event"
                      labelIcon={Repeat}
                      description="This event repeats on a schedule"
                      value={field.value}
                      onChange={(checked) => {
                        field.onChange(checked);
                        form.setValue("repeatingType", checked ? "weekly" : null);
                      }}
                    />
                  )}
                />

                {isRepeating && (
                  <VStack gap={4}>
                    <Controller
                      control={form.control}
                      name="repeatingType"
                      render={({ field }) => (
                        <Selector
                          label="Repeat frequency"
                          options={REPEAT_OPTIONS}
                          value={field.value ?? "weekly"}
                          onChange={field.onChange}
                        />
                      )}
                    />
                    <Controller
                      control={form.control}
                      name="repeatingEndDate"
                      render={({ field }) => (
                        <DateInput
                          label="Repeat until"
                          isOptional
                          description="Leave empty to repeat indefinitely"
                          hasClear
                          value={(field.value || undefined) as ISODateString | undefined}
                          onChange={(v) => field.onChange(v ?? "")}
                        />
                      )}
                    />
                  </VStack>
                )}

                {/* RSVP & attendance */}
                {sectionLabel("RSVP & attendance")}

                <Controller
                  control={form.control}
                  name="rsvpEnabled"
                  render={({ field }) => (
                    <CheckboxInput
                      label="Enable RSVP"
                      labelIcon={CalendarCheck}
                      description="Allow members to accept, decline, or mark as tentative"
                      value={field.value}
                      onChange={(checked) => field.onChange(checked)}
                    />
                  )}
                />

                {rsvpEnabled && (
                  <Controller
                    control={form.control}
                    name="rsvpDeadline"
                    render={({ field }) => (
                      <DateInput
                        label="RSVP deadline"
                        isOptional
                        description="Leave empty for no deadline"
                        hasClear
                        value={(field.value || undefined) as ISODateString | undefined}
                        onChange={(v) => field.onChange(v ?? "")}
                      />
                    )}
                  />
                )}

                <Controller
                  control={form.control}
                  name="isOptional"
                  render={({ field }) => (
                    <CheckboxInput
                      label="Optional event"
                      labelIcon={CircleDashed}
                      description="Shows as tentative in external calendars"
                      value={field.value}
                      onChange={(checked) => field.onChange(checked)}
                    />
                  )}
                />

                {/* Details */}
                {sectionLabel("Details")}

                <Controller
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <TextInput
                      label="Location"
                      isOptional
                      placeholder="Room, address, or meeting link"
                      value={field.value ?? ""}
                      onChange={field.onChange}
                    />
                  )}
                />

                <HStack gap={3} align="start">
                  <Controller
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <Selector
                        label="Category"
                        options={CATEGORY_OPTIONS}
                        value={field.value}
                        onChange={(v) => field.onChange(v as EventCategory)}
                      />
                    )}
                  />
                  <Controller
                    control={form.control}
                    name="color"
                    render={({ field }) => (
                      <Selector
                        label="Color"
                        options={COLOR_OPTIONS}
                        value={field.value}
                        onChange={field.onChange}
                        renderOption={renderColorOption}
                      />
                    )}
                  />
                </HStack>

                {/* Visibility & registration */}
                {sectionLabel("Visibility & registration")}

                <Controller
                  control={form.control}
                  name="isPublic"
                  render={({ field }) => (
                    <CheckboxInput
                      label="Public event"
                      labelIcon={Globe}
                      description="Visible on the public calendar and accessible via link"
                      value={field.value}
                      onChange={(checked) => field.onChange(checked)}
                    />
                  )}
                />

                {isPublic && (
                  <VStack gap={4}>
                    <Controller
                      control={form.control}
                      name="registrationOpen"
                      render={({ field }) => (
                        <CheckboxInput
                          label="Accept registrations"
                          labelIcon={UserCheck}
                          description="Allow visitors to register for this event"
                          value={field.value}
                          onChange={(checked) => field.onChange(checked)}
                        />
                      )}
                    />
                    <Controller
                      control={form.control}
                      name="maxRegistrations"
                      render={({ field }) => (
                        <TextInput
                          label="Max registrations"
                          isOptional
                          placeholder="Leave empty for unlimited"
                          value={field.value ?? ""}
                          onChange={field.onChange}
                        />
                      )}
                    />
                    <VStack gap={1}>
                      <Text type="label" weight="medium">
                        Registration form fields
                      </Text>
                      <Text type="supporting" color="secondary">
                        Customize the information you collect from registrants
                      </Text>
                    </VStack>
                    <RegistrationFormBuilder
                      fields={registrationFields}
                      onChange={setRegistrationFields}
                    />
                  </VStack>
                )}
              </VStack>
            </form>
          </LayoutContent>
        }
        footer={
          <LayoutFooter>
            <HStack gap={2} hAlign="end">
              <Button
                label="Cancel"
                variant="ghost"
                type="button"
                onClick={() => onOpenChange(false)}
              />
              <Button
                label={isEditing ? "Save changes" : "Create event"}
                variant="primary"
                type="submit"
                form="event-form"
                isLoading={loading}
              />
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  );
}