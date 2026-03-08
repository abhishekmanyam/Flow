import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Timestamp } from "firebase/firestore";
import { toast } from "sonner";
import { Loader2, Globe, UserCheck } from "lucide-react";
import type {
  CalendarEvent,
  EventCategory,
  RegistrationField,
} from "@/lib/types";
import {
  EVENT_CATEGORY_LABELS,
  PROJECT_COLORS,
  DEFAULT_REGISTRATION_FIELDS,
} from "@/lib/types";
import { createCalendarEvent, updateCalendarEvent } from "@/lib/firestore";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import RegistrationFormBuilder from "./RegistrationFormBuilder";

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
  isPublic: z.boolean(),
  registrationOpen: z.boolean(),
  maxRegistrations: z.string().optional(),
});

type EventFormValues = z.infer<typeof eventFormSchema>;

function toDate(val: unknown): Date {
  if (!val) return new Date();
  if (val instanceof Date) return val;
  if (
    typeof val === "object" &&
    "toDate" in (val as Record<string, unknown>)
  )
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
      startTime: event
        ? formatTimeForInput(toDate(event.startDate))
        : "09:00",
      endDate: formatDateForInput(defaultEndDate),
      endTime: event ? formatTimeForInput(toDate(event.endDate)) : "10:00",
      allDay: event?.allDay ?? false,
      location: event?.location ?? "",
      category: event?.category ?? "meeting",
      color: event?.color ?? PROJECT_COLORS[0],
      isPublic: event?.isPublic ?? false,
      registrationOpen: event?.registrationOpen ?? false,
      maxRegistrations:
        event?.maxRegistrations != null
          ? String(event.maxRegistrations)
          : "",
    },
  });

  const allDay = form.watch("allDay");
  const isPublic = form.watch("isPublic");
  const selectedColor = form.watch("color");

  const handleSubmit = async (values: EventFormValues) => {
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
        await updateCalendarEvent(wsId, event.id, {
          title: values.title,
          description: values.description ?? "",
          startDate: startTimestamp,
          endDate: endTimestamp,
          allDay: values.allDay,
          location: values.location || null,
          category: values.category,
          color: values.color,
          isPublic: values.isPublic,
          registrationOpen: values.registrationOpen,
          maxRegistrations: maxReg,
          registrationFields,
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
          isPublic: values.isPublic,
          registrationOpen: values.registrationOpen,
          maxRegistrations: maxReg,
          registrationFields,
          workspaceName,
          createdBy: userId,
        });
        toast.success("Event created");
      }
      onOpenChange(false);
    } catch {
      toast.error(
        isEditing ? "Failed to update event" : "Failed to create event"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Event" : "New Event"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the event details below."
              : "Fill in the details to create a new event."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-5"
          >
            {/* ── Basic Info ── */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Event title" {...field} autoFocus />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="What's this event about?"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* ── Date & Time ── */}
            <Separator />
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Date & Time
            </p>

            <FormField
              control={form.control}
              name="allDay"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center gap-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel className="font-normal">All day event</FormLabel>
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {!allDay && (
                <FormField
                  control={form.control}
                  name="startTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start time</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {!allDay && (
                <FormField
                  control={form.control}
                  name="endTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End time</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* ── Details ── */}
            <Separator />
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Details
            </p>

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Room, address, or meeting link"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(
                          Object.entries(EVENT_CATEGORY_LABELS) as [
                            EventCategory,
                            string,
                          ][]
                        ).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Color</FormLabel>
                    <FormControl>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {PROJECT_COLORS.map((color) => (
                          <button
                            key={color}
                            type="button"
                            className={cn(
                              "h-6 w-6 rounded-full transition-all",
                              selectedColor === color
                                ? "ring-2 ring-offset-2 ring-primary scale-110"
                                : "hover:scale-110"
                            )}
                            style={{ backgroundColor: color }}
                            onClick={() => field.onChange(color)}
                          />
                        ))}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* ── Public & Registration ── */}
            <Separator />
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Visibility & Registration
            </p>

            <FormField
              control={form.control}
              name="isPublic"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start gap-3 space-y-0 rounded-lg border p-3">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-0.5">
                    <FormLabel className="flex items-center gap-1.5">
                      <Globe className="h-3.5 w-3.5" />
                      Public event
                    </FormLabel>
                    <p className="text-xs text-muted-foreground">
                      Visible on the public calendar and accessible via link
                    </p>
                  </div>
                </FormItem>
              )}
            />

            {isPublic && (
              <div className="space-y-4 rounded-lg border p-4 bg-muted/20">
                <FormField
                  control={form.control}
                  name="registrationOpen"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start gap-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-0.5">
                        <FormLabel className="flex items-center gap-1.5">
                          <UserCheck className="h-3.5 w-3.5" />
                          Accept registrations
                        </FormLabel>
                        <p className="text-xs text-muted-foreground">
                          Allow visitors to register for this event
                        </p>
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="maxRegistrations"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max registrations</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          placeholder="Leave empty for unlimited"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />

                <div className="space-y-2">
                  <FormLabel>Registration form fields</FormLabel>
                  <p className="text-xs text-muted-foreground">
                    Customize the information you collect from registrants
                  </p>
                  <RegistrationFormBuilder
                    fields={registrationFields}
                    onChange={setRegistrationFields}
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isEditing ? "Save changes" : "Create event"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
