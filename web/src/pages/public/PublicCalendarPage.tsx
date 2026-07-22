import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useParams } from "react-router-dom";
import {
  format,
  addMonths,
  subMonths,
  isSameDay,
  isSameMonth,
  isSameYear,
  isAfter,
  startOfDay,
  differenceInCalendarDays,
} from "date-fns";
import { CalendarDays, List as ListIcon } from "lucide-react";
import type { CalendarEvent, EventCategory } from "@/lib/types";
import { EVENT_CATEGORY_LABELS } from "@/lib/types";
import { getPublicCalendarEvents } from "@/lib/firestore";
import PublicLayout from "@/components/calendar/PublicLayout";
import FullCalendarView from "@/components/calendar/FullCalendarView";
import { Center } from "@astryxdesign/core/Center";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { Icon } from "@astryxdesign/core/Icon";
import { Token } from "@astryxdesign/core/Token";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Card } from "@astryxdesign/core/Card";
import { Spinner } from "@astryxdesign/core/Spinner";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Divider } from "@astryxdesign/core/Divider";
import { List, ListItem } from "@astryxdesign/core/List";
import { TabList, Tab } from "@astryxdesign/core/TabList";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@astryxdesign/core/SegmentedControl";

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

/** Time-of-day only. Dates live in the section header. */
function formatEventTime(event: CalendarEvent): string {
  const start = toDate(event.startDate);
  const end = toDate(event.endDate);
  const multiDay = !isSameDay(start, end);
  if (event.allDay) return "All day";
  const t = (d: Date) => format(d, "h:mm a").replace(":00", "");
  return multiDay ? `${t(start)} – ${t(end)} daily` : `${t(start)} – ${t(end)}`;
}

/** Best-effort venue name from a freeform location string. */
function shortVenue(location: string | null | undefined): string | null {
  if (!location) return null;
  let s = location.split(",")[0]?.trim() ?? location;
  const digitMatch = s.match(/\s\d/);
  if (digitMatch && digitMatch.index !== undefined && digitMatch.index > 3) {
    s = s.slice(0, digitMatch.index).trim();
  }
  if (s.length > 40) s = s.slice(0, 38).trimEnd() + "…";
  return s || location;
}

/** Relative day label for headers — empty string if not within the window. */
function relativeDayLabel(date: Date): string {
  const diff = differenceInCalendarDays(date, startOfDay(new Date()));
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff > 1 && diff <= 7) return `In ${diff} days`;
  if (diff > 7 && diff <= 14) return "Next week";
  return "";
}

/** Stable identity for a "series": same shape event repeated across dates. */
function seriesKey(event: CalendarEvent): string {
  const start = toDate(event.startDate);
  const end = toDate(event.endDate);
  const days = differenceInCalendarDays(end, start) + 1;
  const title = event.title.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const venue = (shortVenue(event.location) ?? "").toLowerCase();
  return `${title}|${venue}|${format(start, "HHmm")}-${format(end, "HHmm")}|${event.allDay ? 1 : 0}|${days}`;
}

type Entry =
  | {
      kind: "single";
      event: CalendarEvent;
      anchorStart: Date;
      anchorEnd: Date;
    }
  | {
      kind: "series";
      key: string;
      events: CalendarEvent[];
      representative: CalendarEvent;
      anchorStart: Date;
      anchorEnd: Date;
    };

/** Collapse repeated-shape events into a single series entry. */
function buildEntries(events: CalendarEvent[]): Entry[] {
  const buckets = new Map<string, CalendarEvent[]>();
  for (const ev of events) {
    const k = seriesKey(ev);
    const arr = buckets.get(k);
    if (arr) arr.push(ev);
    else buckets.set(k, [ev]);
  }
  const entries: Entry[] = [];
  for (const [key, evs] of buckets) {
    if (evs.length >= 2) {
      const sorted = [...evs].sort(
        (a, b) => toDate(a.startDate).getTime() - toDate(b.startDate).getTime()
      );
      const rep = sorted[0];
      entries.push({
        kind: "series",
        key,
        events: sorted,
        representative: rep,
        anchorStart: toDate(rep.startDate),
        anchorEnd: toDate(rep.endDate),
      });
    } else {
      const ev = evs[0];
      entries.push({
        kind: "single",
        event: ev,
        anchorStart: toDate(ev.startDate),
        anchorEnd: toDate(ev.endDate),
      });
    }
  }
  entries.sort((a, b) => a.anchorStart.getTime() - b.anchorStart.getTime());
  return entries;
}

interface DateGroup {
  key: string;
  start: Date;
  end: Date;
  multi: boolean;
  entries: Entry[];
}

/** Group entries so same-day singles share a header; multi-day and series stand alone. */
function buildDateGroups(entries: Entry[]): DateGroup[] {
  const groups: DateGroup[] = [];
  let current: DateGroup | null = null;
  for (const entry of entries) {
    const s = entry.anchorStart;
    const e = entry.anchorEnd;
    const multi = !isSameDay(s, e);
    const key =
      entry.kind === "series"
        ? `s-${entry.key}`
        : multi
          ? `m-${entry.event.id}`
          : `d-${format(s, "yyyy-MM-dd")}`;
    if (current && current.key === key && entry.kind === "single" && !multi) {
      current.entries.push(entry);
    } else {
      current = { key, start: s, end: e, multi, entries: [entry] };
      groups.push(current);
    }
  }
  return groups;
}

function groupHeading(group: DateGroup): { primary: string; rel: string; secondary: string | null } {
  const { start, end, multi, entries } = group;
  const isSeries = entries.length === 1 && entries[0].kind === "series";
  const rel = relativeDayLabel(start);
  let primary: string;
  let secondary: string | null = null;

  if (isSeries) {
    primary = `Starts ${format(start, "MMM d")}`;
  } else if (!multi) {
    primary = format(start, "EEE, MMM d");
  } else {
    const days = differenceInCalendarDays(end, start) + 1;
    primary = isSameMonth(start, end)
      ? `${format(start, "MMM d")} – ${format(end, "d")}`
      : `${format(start, "MMM d")} – ${format(end, "MMM d")}`;
    secondary = `${days} days`;
  }
  return { primary, rel, secondary };
}

export default function PublicCalendarPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [workspaceName, setWorkspaceName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [view, setView] = useState<string>("list");
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<EventCategory | "all">(
    "all"
  );
  const [openSeries, setOpenSeries] = useState<Set<string>>(new Set());

  const toggleSeries = (key: string) =>
    setOpenSeries((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  useEffect(() => {
    if (!workspaceId) return;

    async function load() {
      try {
        const calendarEvents = await getPublicCalendarEvents(workspaceId!);
        const name = calendarEvents[0]?.workspaceName ?? null;
        setWorkspaceName(name);
        setEvents(calendarEvents);
      } catch (err) {
        console.error("Public calendar load failed:", err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [workspaceId]);

  const upcomingEvents = useMemo(() => {
    const today = startOfDay(new Date());
    return events
      .filter(
        (e) =>
          isAfter(toDate(e.startDate), today) ||
          isSameDay(toDate(e.startDate), today)
      )
      .sort(
        (a, b) => toDate(a.startDate).getTime() - toDate(b.startDate).getTime()
      );
  }, [events]);

  const filteredEvents = useMemo(() => {
    if (categoryFilter === "all") return upcomingEvents;
    return upcomingEvents.filter((e) => e.category === categoryFilter);
  }, [upcomingEvents, categoryFilter]);

  const dateGroups = useMemo(
    () => buildDateGroups(buildEntries(filteredEvents)),
    [filteredEvents]
  );

  const categories = useMemo(() => {
    const cats = new Set<EventCategory>();
    for (const e of upcomingEvents) cats.add(e.category);
    return Array.from(cats);
  }, [upcomingEvents]);

  const selectedDayEvents = useMemo(() => {
    if (!selectedDate) return [];
    return events.filter((e) => isSameDay(toDate(e.startDate), selectedDate));
  }, [events, selectedDate]);

  if (loading) {
    return (
      <PublicLayout>
        <Center axis="horizontal" height={240}>
          <Spinner size="lg" label="Loading events…" />
        </Center>
      </PublicLayout>
    );
  }

  if (notFound) {
    return (
      <PublicLayout>
        <EmptyState
          icon={<Icon icon={CalendarDays} size="lg" />}
          title="Calendar not found"
          description="This calendar does not exist or is no longer available. Please check the link and try again."
        />
      </PublicLayout>
    );
  }

  function renderEventItem(event: CalendarEvent): ReactNode {
    const venue = shortVenue(event.location);
    const time = formatEventTime(event);
    return (
      <ListItem
        key={`e-${event.id}`}
        label={event.title}
        description={venue ? `${time} · ${venue}` : time}
        href={`/events/${workspaceId}/${event.id}`}
        startContent={<Icon icon="calendar" size="sm" color="secondary" />}
        endContent={
          <HStack gap={2} align="center">
            <Token
              label={EVENT_CATEGORY_LABELS[event.category]}
              color={CATEGORY_TOKEN_COLOR[event.category]}
              size="sm"
            />
            {event.registrationOpen ? (
              <Badge variant="info" label="Register" />
            ) : (
              <Icon icon="chevronRight" size="sm" color="secondary" />
            )}
          </HStack>
        }
      />
    );
  }

  function renderGroupItems(group: DateGroup): ReactNode[] {
    const items: ReactNode[] = [];
    for (const entry of group.entries) {
      if (entry.kind === "single") {
        items.push(renderEventItem(entry.event));
        continue;
      }
      const rep = entry.representative;
      const venue = shortVenue(rep.location);
      const count = entry.events.length;
      const lastDate = toDate(entry.events[entry.events.length - 1].endDate);
      const start = entry.anchorStart;
      const rangeLabel = isSameMonth(start, lastDate)
        ? `${format(start, "MMM d")} – ${format(lastDate, "d")}`
        : isSameYear(start, lastDate)
          ? `${format(start, "MMM")} – ${format(lastDate, "MMM")}`
          : `${format(start, "MMM yyyy")} – ${format(lastDate, "MMM yyyy")}`;
      const open = openSeries.has(entry.key);
      const time = formatEventTime(rep);

      items.push(
        <ListItem
          key={`s-${entry.key}`}
          label={rep.title}
          description={`${venue ? `${time} · ${venue}` : time} · ${rangeLabel}`}
          onClick={() => toggleSeries(entry.key)}
          isSelected={open}
          startContent={
            <Icon icon="calendar" size="sm" color="secondary" />
          }
          endContent={
            <HStack gap={2} align="center">
              <Badge variant="neutral" label={`${count} sessions`} />
              <Icon
                icon={open ? "chevronDown" : "chevronRight"}
                size="sm"
                color="secondary"
              />
            </HStack>
          }
        />
      );

      if (open) {
        for (const ev of entry.events) {
          const s = toDate(ev.startDate);
          const e = toDate(ev.endDate);
          const rel = relativeDayLabel(s);
          const dateLabel = isSameDay(s, e)
            ? format(s, "EEE, MMM d")
            : isSameMonth(s, e)
              ? `${format(s, "MMM d")} – ${format(e, "d")}`
              : `${format(s, "MMM d")} – ${format(e, "MMM d")}`;
          items.push(
            <ListItem
              key={`ss-${ev.id}`}
              label={dateLabel}
              description={rel || undefined}
              href={`/events/${workspaceId}/${ev.id}`}
              endContent={
                ev.registrationOpen ? (
                  <Badge variant="info" label="Register" />
                ) : (
                  <Icon icon="chevronRight" size="sm" color="secondary" />
                )
              }
            />
          );
        }
      }
    }
    return items;
  }

  return (
    <PublicLayout workspaceName={workspaceName ?? undefined}>
      {/* Hero */}
      <VStack gap={1}>
        <Heading level={1} type="display-2">
          Upcoming Events
        </Heading>
        <Text type="large" color="secondary">
          Browse and register for our upcoming events
        </Text>
      </VStack>

      {/* Toolbar */}
      <HStack justify="between" align="center" wrap="wrap" gap={3}>
        <TabList
          value={categoryFilter}
          onChange={(v) => setCategoryFilter(v as EventCategory | "all")}
        >
          <Tab
            value="all"
            label="All"
            endContent={<Badge variant="neutral" label={upcomingEvents.length} />}
          />
          {categories.map((cat) => (
            <Tab key={cat} value={cat} label={EVENT_CATEGORY_LABELS[cat]} />
          ))}
        </TabList>

        <SegmentedControl
          label="View mode"
          value={view}
          onChange={setView}
        >
          <SegmentedControlItem
            value="list"
            label="List"
            icon={<Icon icon={ListIcon} size="sm" />}
          />
          <SegmentedControlItem
            value="calendar"
            label="Calendar"
            icon={<Icon icon="calendar" size="sm" />}
          />
        </SegmentedControl>
      </HStack>

      {/* List view */}
      {view === "list" &&
        (filteredEvents.length === 0 ? (
          <EmptyState
            icon={<Icon icon={CalendarDays} size="lg" />}
            title="No upcoming events"
            description={
              categoryFilter !== "all"
                ? "No events in this category. Try a different filter."
                : "Check back later for new events."
            }
          />
        ) : (
          <VStack gap={6}>
            {dateGroups.map((group) => {
              const { primary, rel, secondary } = groupHeading(group);
              return (
                <VStack key={group.key} gap={2}>
                  <HStack gap={2} align="center">
                    {rel && (
                      <Text type="label" color="accent">
                        {rel}
                      </Text>
                    )}
                    <Heading level={3}>{primary}</Heading>
                    {secondary && (
                      <Text type="supporting">· {secondary}</Text>
                    )}
                  </HStack>
                  <Card padding={0}>
                    <List hasDividers>{renderGroupItems(group)}</List>
                  </Card>
                </VStack>
              );
            })}
          </VStack>
        ))}

      {/* Calendar view */}
      {view === "calendar" && (
        <VStack gap={4}>
          <Card>
            <VStack gap={4}>
              <HStack justify="between" align="center">
                <Heading level={2}>{format(currentMonth, "MMMM yyyy")}</Heading>
                <HStack gap={1} align="center">
                  <IconButton
                    label="Previous month"
                    variant="ghost"
                    icon={<Icon icon="chevronLeft" size="sm" />}
                    onClick={() => setCurrentMonth((p) => subMonths(p, 1))}
                  />
                  <Button
                    label="Today"
                    variant="secondary"
                    size="sm"
                    isDisabled={isSameMonth(currentMonth, new Date())}
                    onClick={() => setCurrentMonth(new Date())}
                  />
                  <IconButton
                    label="Next month"
                    variant="ghost"
                    icon={<Icon icon="chevronRight" size="sm" />}
                    onClick={() => setCurrentMonth((p) => addMonths(p, 1))}
                  />
                </HStack>
              </HStack>

              <FullCalendarView
                events={events}
                viewMode="month"
                currentDate={currentMonth}
                onDateClick={(date) => {
                  if (selectedDate && isSameDay(date, selectedDate)) {
                    setSelectedDate(null);
                  } else {
                    setSelectedDate(date);
                  }
                }}
                readOnly
              />
            </VStack>
          </Card>

          {selectedDate && (
            <VStack gap={2}>
              <HStack gap={3} align="center">
                <Heading level={3}>
                  {format(selectedDate, "EEEE, MMMM d")}
                </Heading>
                <Divider />
              </HStack>
              {selectedDayEvents.length === 0 ? (
                <Text type="supporting">No events on this day</Text>
              ) : (
                <Card padding={0}>
                  <List hasDividers>
                    {selectedDayEvents.map((event) => renderEventItem(event))}
                  </List>
                </Card>
              )}
            </VStack>
          )}
        </VStack>
      )}
    </PublicLayout>
  );
}
