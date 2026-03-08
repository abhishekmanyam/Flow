import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { format } from "date-fns";
import {
  CalendarDays,
  MapPin,
  ArrowLeft,
  Loader2,
  Users,
  Clock,
  Globe,
} from "lucide-react";
import type { CalendarEvent } from "@/lib/types";
import {
  getCalendarEvent,
  getRegistrationCount,
} from "@/lib/firestore";
import PublicLayout from "@/components/calendar/PublicLayout";
import PublicRegistrationForm from "@/components/calendar/PublicRegistrationForm";
import EventCategoryBadge from "@/components/calendar/EventCategoryBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";

function toDate(val: unknown): Date {
  if (!val) return new Date();
  if (val instanceof Date) return val;
  if (
    typeof val === "object" &&
    "toDate" in (val as Record<string, unknown>)
  ) {
    return (val as { toDate: () => Date }).toDate();
  }
  return new Date(val as string);
}

export default function PublicEventPage() {
  const { workspaceId, eventId } = useParams<{
    workspaceId: string;
    eventId: string;
  }>();

  const [event, setEvent] = useState<CalendarEvent | null>(null);
  const [registrationCount, setRegistrationCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!workspaceId || !eventId) return;

    async function load() {
      try {
        const eventData = await getCalendarEvent(workspaceId!, eventId!);

        if (!eventData) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        setEvent(eventData);

        try {
          const count = await getRegistrationCount(workspaceId!, eventId!);
          setRegistrationCount(count);
        } catch {
          // Silently fail — spots info won't be shown
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [workspaceId, eventId]);

  if (loading) {
    return (
      <PublicLayout>
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading event...</p>
        </div>
      </PublicLayout>
    );
  }

  if (notFound || !event) {
    return (
      <PublicLayout>
        <div className="text-center py-20 space-y-4">
          <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
            <CalendarDays className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold">Event not found</h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            This event does not exist or is no longer available.
          </p>
          <Link
            to={`/events/${workspaceId}`}
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline mt-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to all events
          </Link>
        </div>
      </PublicLayout>
    );
  }

  const spotsLeft = event.maxRegistrations
    ? event.maxRegistrations - registrationCount
    : null;
  const spotsPercent = event.maxRegistrations
    ? Math.min((registrationCount / event.maxRegistrations) * 100, 100)
    : 0;

  const start = toDate(event.startDate);
  const end = toDate(event.endDate);

  return (
    <PublicLayout workspaceName={event.workspaceName}>
      {/* Back link */}
      <Link
        to={`/events/${workspaceId}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        All events
      </Link>

      {/* Event banner card */}
      <Card className="overflow-hidden mb-6">
        <div className="h-2" style={{ backgroundColor: event.color }} />
        <CardContent className="pt-6 pb-6">
          {/* Category + status badges */}
          <div className="flex items-center gap-2 mb-3">
            <EventCategoryBadge category={event.category} />
            {event.isPublic && (
              <Badge variant="outline" className="gap-1">
                <Globe className="h-3 w-3" />
                Public
              </Badge>
            )}
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold tracking-tight">{event.title}</h1>

          {/* Info rows */}
          <div className="grid gap-3 mt-5">
            {/* Date */}
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <CalendarDays className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  {format(start, "EEEE, MMMM d, yyyy")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {event.allDay
                    ? "All day"
                    : `${format(start, "h:mm a")} – ${format(end, "h:mm a")}`}
                </p>
              </div>
            </div>

            {/* Duration */}
            {!event.allDay && (
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {format(start, "h:mm a")} – {format(end, "h:mm a")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(() => {
                      const diff = end.getTime() - start.getTime();
                      const hours = Math.floor(diff / (1000 * 60 * 60));
                      const mins = Math.floor(
                        (diff % (1000 * 60 * 60)) / (1000 * 60)
                      );
                      if (hours > 0 && mins > 0)
                        return `${hours}h ${mins}m duration`;
                      if (hours > 0) return `${hours}h duration`;
                      return `${mins}m duration`;
                    })()}
                  </p>
                </div>
              </div>
            )}

            {/* Location */}
            {event.location && (
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <MapPin className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">{event.location}</p>
                  <p className="text-xs text-muted-foreground">Location</p>
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          {event.description && (
            <>
              <Separator className="my-5" />
              <div>
                <h3 className="text-sm font-semibold mb-2">About this event</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {event.description}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Registration section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Registration</h2>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            {spotsLeft !== null ? (
              <Badge variant={spotsLeft > 0 ? "secondary" : "destructive"}>
                {spotsLeft > 0
                  ? `${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left`
                  : "Event is full"}
              </Badge>
            ) : (
              <Badge variant="secondary">Open registration</Badge>
            )}
          </div>
        </div>

        {/* Capacity progress bar */}
        {event.maxRegistrations != null && (
          <div className="space-y-1.5">
            <Progress value={spotsPercent} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {registrationCount} / {event.maxRegistrations} registered
            </p>
          </div>
        )}

        {event.registrationOpen && event.isPublic ? (
          <PublicRegistrationForm
            wsId={workspaceId!}
            eventId={eventId!}
            fields={event.registrationFields}
            closed={!event.registrationOpen}
            spotsLeft={spotsLeft}
          />
        ) : (
          <Card>
            <CardContent className="py-10 text-center space-y-2">
              <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mx-auto">
                <CalendarDays className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">
                {!event.registrationOpen
                  ? "Registration is closed"
                  : "Not open for registration"}
              </p>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                {!event.registrationOpen
                  ? "Registration for this event has ended. Contact the organizer for more information."
                  : "This event is not accepting public registrations at this time."}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </PublicLayout>
  );
}
