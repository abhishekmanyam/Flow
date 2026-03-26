import { useState, useEffect } from "react";
import { format, startOfDay, isBefore } from "date-fns";
import { toast } from "sonner";
import {
  MapPin,
  Pencil,
  Trash2,
  CalendarDays,
  Clock,
  Globe,
  Users,
  ExternalLink,
  Repeat,
  CircleDashed,
  Check,
  X,
  HelpCircle,
} from "lucide-react";
import { Timestamp } from "firebase/firestore";
import type { CalendarEvent, EventRSVP, RSVPStatus } from "@/lib/types";
import {
  deleteCalendarEvent,
  excludeCalendarEventOccurrence,
  submitRSVP,
  subscribeToEventRSVPs,
} from "@/lib/firestore";
import { useAuthStore } from "@/store/auth";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import EventCategoryBadge from "./EventCategoryBadge";
import RegistrationTable from "./RegistrationTable";
import CreateEventDialog from "./CreateEventDialog";

interface EventDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wsId: string;
  workspaceName: string;
  userId: string;
  event: CalendarEvent;
  canEdit: boolean;
  canDelete: boolean;
  canViewRegistrations: boolean;
}

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

export default function EventDetailSheet({
  open,
  onOpenChange,
  wsId,
  workspaceName,
  userId,
  event,
  canEdit,
  canDelete,
  canViewRegistrations,
}: EventDetailSheetProps) {
  const { user } = useAuthStore();
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [rsvps, setRsvps] = useState<EventRSVP[]>([]);
  const [myRsvpStatus, setMyRsvpStatus] = useState<RSVPStatus | null>(null);
  const [rsvpLoading, setRsvpLoading] = useState(false);

  const startDate = toDate(event.startDate);
  const endDate = toDate(event.endDate);

  // RSVP subscription
  const rsvpEventId = event.isRepeating && event.id.includes("_")
    ? event.id.substring(0, event.id.lastIndexOf("_"))
    : event.id;

  useEffect(() => {
    if (!event.rsvpEnabled) return;
    const unsub = subscribeToEventRSVPs(wsId, rsvpEventId, (data) => {
      setRsvps(data);
      const mine = data.find((r) => r.userId === user?.uid);
      setMyRsvpStatus(mine?.status ?? null);
    });
    return unsub;
  }, [wsId, rsvpEventId, event.rsvpEnabled, user?.uid]);

  const handleRsvp = async (status: RSVPStatus) => {
    if (!user?.uid) return;
    setRsvpLoading(true);
    try {
      await submitRSVP(wsId, rsvpEventId, user.uid, status);
      toast.success(
        status === "accepted" ? "Accepted" : status === "declined" ? "Declined" : "Marked as tentative"
      );
    } catch {
      toast.error("Failed to update RSVP");
    } finally {
      setRsvpLoading(false);
    }
  };

  const rsvpDeadlinePassed = event.rsvpDeadline
    ? isBefore(toDate(event.rsvpDeadline), new Date())
    : false;

  // Occurrence IDs look like "baseId_timestamp"
  const isOccurrence = event.isRepeating && event.id.includes("_");
  const baseEventId = isOccurrence
    ? event.id.substring(0, event.id.lastIndexOf("_"))
    : event.id;

  const handleDeleteSeries = async () => {
    setDeleting(true);
    try {
      await deleteCalendarEvent(wsId, baseEventId);
      toast.success("Entire series deleted");
      onOpenChange(false);
    } catch {
      toast.error("Failed to delete series");
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteOccurrence = async () => {
    setDeleting(true);
    try {
      const dayStart = startOfDay(startDate);
      await excludeCalendarEventOccurrence(
        wsId,
        baseEventId,
        Timestamp.fromDate(dayStart)
      );
      toast.success("Occurrence removed");
      onOpenChange(false);
    } catch {
      toast.error("Failed to remove occurrence");
    } finally {
      setDeleting(false);
    }
  };

  const handleDelete = event.isRepeating
    ? handleDeleteSeries
    : async () => {
        setDeleting(true);
        try {
          await deleteCalendarEvent(wsId, event.id);
          toast.success("Event deleted");
          onOpenChange(false);
        } catch {
          toast.error("Failed to delete event");
        } finally {
          setDeleting(false);
        }
      };

  const showRegistrationsTab = event.isPublic && canViewRegistrations;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <div className="flex items-center gap-2 mb-1">
              <EventCategoryBadge category={event.category} />
              {event.isPublic && (
                <Badge variant="outline" className="gap-1">
                  <Globe className="h-3 w-3" />
                  Public
                </Badge>
              )}
            </div>
            <SheetTitle className="text-xl">{event.title}</SheetTitle>
            <SheetDescription className="sr-only">
              Event details for {event.title}
            </SheetDescription>
          </SheetHeader>

          <div className="px-4 pb-4">
            <Tabs defaultValue="details">
              <TabsList className="w-full">
                <TabsTrigger value="details" className="flex-1">
                  Details
                </TabsTrigger>
                {showRegistrationsTab && (
                  <TabsTrigger
                    value="registrations"
                    className="flex-1 gap-1"
                  >
                    <Users className="h-3.5 w-3.5" />
                    Registrations
                  </TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="details" className="space-y-4 pt-4">
                {/* Info rows */}
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {format(startDate, "EEEE, MMMM d, yyyy")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {event.allDay
                          ? "All day"
                          : `${format(startDate, "h:mm a")} – ${format(endDate, "h:mm a")}`}
                      </p>
                    </div>
                  </div>

                  {!event.allDay && (
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {(() => {
                            const diff =
                              endDate.getTime() - startDate.getTime();
                            const hours = Math.floor(
                              diff / (1000 * 60 * 60)
                            );
                            const mins = Math.floor(
                              (diff % (1000 * 60 * 60)) / (1000 * 60)
                            );
                            if (hours > 0 && mins > 0)
                              return `${hours}h ${mins}m`;
                            if (hours > 0) return `${hours}h`;
                            return `${mins}m`;
                          })()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Duration
                        </p>
                      </div>
                    </div>
                  )}

                  {event.isRepeating && event.repeatingType && (
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Repeat className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium capitalize">
                          {event.repeatingType}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {event.repeatingEndDate
                            ? `Until ${format(toDate(event.repeatingEndDate), "MMM d, yyyy")}`
                            : "Repeats indefinitely"}
                        </p>
                      </div>
                    </div>
                  )}

                  {event.location && (
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {event.location}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Location
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Description */}
                {event.description && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                        Description
                      </p>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">
                        {event.description}
                      </p>
                    </div>
                  </>
                )}

                {/* RSVP */}
                {event.rsvpEnabled && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          RSVP
                        </p>
                        {event.isOptional && (
                          <Badge variant="outline" className="gap-1">
                            <CircleDashed className="h-3 w-3" />
                            Optional
                          </Badge>
                        )}
                      </div>

                      {rsvpDeadlinePassed ? (
                        <p className="text-xs text-muted-foreground">
                          RSVP deadline has passed
                        </p>
                      ) : (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant={myRsvpStatus === "accepted" ? "default" : "outline"}
                            className="flex-1 gap-1.5"
                            disabled={rsvpLoading}
                            onClick={() => handleRsvp("accepted")}
                          >
                            <Check className="h-3.5 w-3.5" />
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant={myRsvpStatus === "tentative" ? "default" : "outline"}
                            className="flex-1 gap-1.5"
                            disabled={rsvpLoading}
                            onClick={() => handleRsvp("tentative")}
                          >
                            <HelpCircle className="h-3.5 w-3.5" />
                            Maybe
                          </Button>
                          <Button
                            size="sm"
                            variant={myRsvpStatus === "declined" ? "destructive" : "outline"}
                            className="flex-1 gap-1.5"
                            disabled={rsvpLoading}
                            onClick={() => handleRsvp("declined")}
                          >
                            <X className="h-3.5 w-3.5" />
                            Decline
                          </Button>
                        </div>
                      )}

                      {event.rsvpDeadline && !rsvpDeadlinePassed && (
                        <p className="text-xs text-muted-foreground">
                          RSVP by {format(toDate(event.rsvpDeadline), "MMM d, yyyy")}
                        </p>
                      )}

                      {/* RSVP summary for admins */}
                      {canViewRegistrations && rsvps.length > 0 && (
                        <div className="flex gap-3 text-xs text-muted-foreground pt-1">
                          <span className="flex items-center gap-1">
                            <Check className="h-3 w-3 text-green-500" />
                            {rsvps.filter((r) => r.status === "accepted").length} accepted
                          </span>
                          <span className="flex items-center gap-1">
                            <HelpCircle className="h-3 w-3 text-yellow-500" />
                            {rsvps.filter((r) => r.status === "tentative").length} maybe
                          </span>
                          <span className="flex items-center gap-1">
                            <X className="h-3 w-3 text-red-500" />
                            {rsvps.filter((r) => r.status === "declined").length} declined
                          </span>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Optional badge (if not RSVP-enabled but still optional) */}
                {!event.rsvpEnabled && event.isOptional && (
                  <>
                    <Separator />
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="gap-1">
                        <CircleDashed className="h-3 w-3" />
                        Optional event
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Shows as tentative in external calendars
                      </span>
                    </div>
                  </>
                )}

                {/* Status */}
                <Separator />
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Status
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {event.isPublic ? (
                      <Badge variant="secondary" className="gap-1">
                        <Globe className="h-3 w-3" />
                        Public event
                      </Badge>
                    ) : (
                      <Badge variant="outline">Internal only</Badge>
                    )}
                    {event.isPublic && (
                      <Badge
                        variant={
                          event.registrationOpen ? "default" : "outline"
                        }
                      >
                        {event.registrationOpen
                          ? "Registration open"
                          : "Registration closed"}
                      </Badge>
                    )}
                    {event.maxRegistrations != null && (
                      <Badge variant="outline">
                        Max {event.maxRegistrations} spots
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Public link */}
                {event.isPublic && canEdit && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Public Link
                      </p>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-muted px-2 py-1.5 rounded flex-1 truncate">
                          /events/{wsId}/{event.id}
                        </code>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const url = `${window.location.origin}/events/${wsId}/${event.id}`;
                            navigator.clipboard.writeText(url);
                            toast.success("Link copied to clipboard");
                          }}
                        >
                          <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                          Copy
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </TabsContent>

              {showRegistrationsTab && (
                <TabsContent value="registrations" className="pt-4">
                  <RegistrationTable wsId={wsId} event={event} />
                </TabsContent>
              )}
            </Tabs>

            {canEdit && (
              <>
                <Separator className="my-4" />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditOpen(true)}
                    className="flex-1"
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                  {canDelete && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete event</AlertDialogTitle>
                          <AlertDialogDescription>
                            {event.isRepeating
                              ? `Do you want to remove just this occurrence (${format(startDate, "MMM d")}) or delete the entire series?`
                              : `Are you sure you want to delete "${event.title}"? This action cannot be undone.`}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          {event.isRepeating ? (
                            <>
                              <AlertDialogAction
                                variant="outline"
                                onClick={handleDeleteOccurrence}
                                disabled={deleting}
                              >
                                This occurrence
                              </AlertDialogAction>
                              <AlertDialogAction
                                variant="destructive"
                                onClick={handleDeleteSeries}
                                disabled={deleting}
                              >
                                Entire series
                              </AlertDialogAction>
                            </>
                          ) : (
                            <AlertDialogAction
                              variant="destructive"
                              onClick={handleDelete}
                              disabled={deleting}
                            >
                              {deleting ? "Deleting..." : "Delete"}
                            </AlertDialogAction>
                          )}
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <CreateEventDialog
        key={event.id}
        open={editOpen}
        onOpenChange={setEditOpen}
        wsId={wsId}
        workspaceName={workspaceName}
        userId={userId}
        event={event}
      />
    </>
  );
}
