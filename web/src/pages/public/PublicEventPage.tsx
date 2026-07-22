import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  format,
  isSameDay,
  isSameMonth,
  isSameYear,
  differenceInCalendarDays,
  startOfDay,
} from "date-fns";
import { CalendarDays, MapPin, ArrowLeft } from "lucide-react";
import type { CalendarEvent, EventCategory } from "@/lib/types";
import { EVENT_CATEGORY_LABELS } from "@/lib/types";
import { getCalendarEvent, getRegistrationCount } from "@/lib/firestore";
import PublicLayout from "@/components/calendar/PublicLayout";
import PublicRegistrationForm from "@/components/calendar/PublicRegistrationForm";
import { Center } from "@astryxdesign/core/Center";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { Link } from "@astryxdesign/core/Link";
import { Icon } from "@astryxdesign/core/Icon";
import { Token } from "@astryxdesign/core/Token";
import { Badge } from "@astryxdesign/core/Badge";
import { Spinner } from "@astryxdesign/core/Spinner";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Divider } from "@astryxdesign/core/Divider";
import { Timestamp } from "@astryxdesign/core/Timestamp";
import { Markdown } from "@astryxdesign/core/Markdown";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { Banner } from "@astryxdesign/core/Banner";
import { MetadataList, MetadataListItem } from "@astryxdesign/core/MetadataList";

type TokenColor = "blue" | "purple" | "orange" | "green" | "gray";

const CATEGORY_TOKEN_COLOR: Record<EventCategory, TokenColor> = {
  meeting: "blue",
  workshop: "purple",
  webinar: "orange",
  social: "green",
  other: "gray",
};

function toDate(val: unknown): Date {
  if (!val) return new Date();
  if (val instanceof Date) return val;
  if (typeof val === "object" && "toDate" in (val as Record<string, unknown>)) {
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
        <Center axis="horizontal" height={240}>
          <Spinner size="lg" label="Loading event…" />
        </Center>
      </PublicLayout>
    );
  }

  if (notFound || !event) {
    return (
      <PublicLayout>
        <EmptyState
          icon={<Icon icon={CalendarDays} size="lg" />}
          title="Event not found"
          description="This event does not exist or is no longer available."
          actions={
            <Link href={`/events/${workspaceId}`}>Back to all events</Link>
          }
        />
      </PublicLayout>
    );
  }

  const spotsLeft = event.maxRegistrations
    ? event.maxRegistrations - registrationCount
    : null;

  const start = toDate(event.startDate);
  const end = toDate(event.endDate);
  const multi = !isSameDay(start, end);
  const days = differenceInCalendarDays(end, start) + 1;
  const diffFromToday = differenceInCalendarDays(
    startOfDay(start),
    startOfDay(new Date())
  );

  let dateLabel: string;
  if (!multi) {
    dateLabel = format(start, "EEEE, MMMM d, yyyy");
  } else if (isSameMonth(start, end)) {
    dateLabel = `${format(start, "MMM d")} – ${format(end, "d")}, ${format(start, "yyyy")}`;
  } else if (isSameYear(start, end)) {
    dateLabel = `${format(start, "MMM d")} – ${format(end, "MMM d")}, ${format(start, "yyyy")}`;
  } else {
    dateLabel = `${format(start, "MMM d, yyyy")} – ${format(end, "MMM d, yyyy")}`;
  }

  let timeLabel: string;
  if (event.allDay) {
    timeLabel = multi ? `All day · ${days} days` : "All day";
  } else if (multi) {
    timeLabel = `${format(start, "h:mm a")} – ${format(end, "h:mm a")} daily · ${days} days`;
  } else {
    const diffMs = end.getTime() - start.getTime();
    const hours = Math.floor(diffMs / 3_600_000);
    const mins = Math.floor((diffMs % 3_600_000) / 60_000);
    const dur =
      hours > 0 && mins > 0
        ? `${hours}h ${mins}m`
        : hours > 0
          ? `${hours}h`
          : `${mins}m`;
    timeLabel = `${format(start, "h:mm a")} – ${format(end, "h:mm a")} · ${dur}`;
  }

  let relLabel = "";
  if (diffFromToday === 0) relLabel = "Today";
  else if (diffFromToday === 1) relLabel = "Tomorrow";
  else if (diffFromToday > 1 && diffFromToday <= 7)
    relLabel = `In ${diffFromToday} days`;
  else if (diffFromToday > 7 && diffFromToday <= 14) relLabel = "Next week";
  else if (diffFromToday < 0) relLabel = "Past event";

  return (
    <PublicLayout workspaceName={event.workspaceName}>
      <Link href={`/events/${workspaceId}`}>
        <HStack gap={1} align="center">
          <Icon icon={ArrowLeft} size="sm" />
          <Text type="supporting">All events</Text>
        </HStack>
      </Link>

      {/* Header */}
      <VStack gap={3}>
        <HStack gap={2} align="center" wrap="wrap">
          <Token
            label={EVENT_CATEGORY_LABELS[event.category]}
            color={CATEGORY_TOKEN_COLOR[event.category]}
          />
          {event.isPublic && <Badge variant="blue" label="Public" />}
          {relLabel && <Badge variant="neutral" label={relLabel} />}
        </HStack>
        <Heading level={1} type="display-3">
          {event.title}
        </Heading>
      </VStack>

      {/* Details */}
      <MetadataList columns="single" label={{ position: "start", width: 120 }}>
        <MetadataListItem label="When" icon={<Icon icon="calendar" size="sm" />}>
          <VStack gap={0.5}>
            <Timestamp
              value={start.toISOString()}
              format={event.allDay ? "date" : "date_time"}
              type="body"
              color="primary"
            />
            <Text type="supporting">{`${dateLabel} · ${timeLabel}`}</Text>
          </VStack>
        </MetadataListItem>
        {event.location && (
          <MetadataListItem label="Where" icon={<Icon icon={MapPin} size="sm" />}>
            <Text>{event.location}</Text>
          </MetadataListItem>
        )}
      </MetadataList>

      {/* Description */}
      {event.description && (
        <VStack gap={2}>
          <Divider />
          <Heading level={3}>About this event</Heading>
          <Markdown>{event.description}</Markdown>
        </VStack>
      )}

      <Divider />

      {/* Registration */}
      <VStack gap={4}>
        <HStack justify="between" align="center" wrap="wrap" gap={2}>
          <Heading level={2}>Registration</Heading>
          {spotsLeft !== null ? (
            <Badge
              variant={spotsLeft > 0 ? "info" : "error"}
              label={
                spotsLeft > 0
                  ? `${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left`
                  : "Event is full"
              }
            />
          ) : (
            <Badge variant="info" label="Open registration" />
          )}
        </HStack>

        {event.maxRegistrations != null && (
          <ProgressBar
            label="Registration capacity"
            value={registrationCount}
            max={event.maxRegistrations}
            hasValueLabel
            formatValueLabel={(v, m) => `${v} / ${m} registered`}
            variant={
              spotsLeft !== null && spotsLeft <= 0 ? "error" : "accent"
            }
          />
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
          <Banner
            status="info"
            title={
              !event.registrationOpen
                ? "Registration is closed"
                : "Not open for registration"
            }
            description={
              !event.registrationOpen
                ? "Registration for this event has ended. Contact the organizer for more information."
                : "This event is not accepting public registrations at this time."
            }
          />
        )}
      </VStack>
    </PublicLayout>
  );
}
