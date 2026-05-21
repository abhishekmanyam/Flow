import { useEffect, useMemo, useState, Fragment } from "react";
import { useParams, Link } from "react-router-dom";
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
import {
  CalendarDays,
  List,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Clock,
  ArrowRight,
  Layers,
} from "lucide-react";
import type { CalendarEvent, EventCategory } from "@/lib/types";
import { EVENT_CATEGORY_LABELS, EVENT_CATEGORY_COLORS } from "@/lib/types";
import { getPublicCalendarEvents } from "@/lib/firestore";
import PublicLayout from "@/components/calendar/PublicLayout";
import FullCalendarView from "@/components/calendar/FullCalendarView";
import EventCategoryBadge from "@/components/calendar/EventCategoryBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Separator } from "@/components/ui/separator";

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

/** Time-of-day only. Dates live in the section header. */
function formatEventTime(event: CalendarEvent): string {
  const start = toDate(event.startDate);
  const end = toDate(event.endDate);
  const multiDay = !isSameDay(start, end);
  if (event.allDay) return "All day";
  const t = (d: Date) => format(d, "h:mm a").replace(":00", "");
  return multiDay
    ? `${t(start)} – ${t(end)} daily`
    : `${t(start)} – ${t(end)}`;
}

/** Best-effort venue name from a freeform location string. */
function shortVenue(location: string | null | undefined): string | null {
  if (!location) return null;
  let s = location.split(",")[0]?.trim() ?? location;
  // If the first chunk still includes a street number, cut at the first digit run.
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
        (a, b) =>
          toDate(a.startDate).getTime() - toDate(b.startDate).getTime()
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
    // Series and multi-day events always stand alone; single-day singletons can merge by date.
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

function EventRow({
  event,
  workspaceId,
}: {
  event: CalendarEvent;
  workspaceId: string | undefined;
}) {
  const venue = shortVenue(event.location);
  return (
    <Link
      to={`/events/${workspaceId}/${event.id}`}
      className="group flex items-center gap-3 px-3 sm:px-4 py-3 hover:bg-accent/40 transition-colors min-w-0"
    >
      <span
        className="size-2.5 rounded-full shrink-0"
        style={{ backgroundColor: event.color }}
        aria-hidden
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
          {event.title}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          <span className="tabular-nums">{formatEventTime(event)}</span>
          {venue && (
            <>
              <span className="mx-1.5 opacity-50">·</span>
              {venue}
            </>
          )}
        </p>
      </div>
      {event.registrationOpen ? (
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 h-8 px-3 text-xs group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-colors"
          tabIndex={-1}
        >
          Register
        </Button>
      ) : (
        <ArrowRight className="h-4 w-4 text-muted-foreground/40 shrink-0 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
      )}
    </Link>
  );
}

function SeriesRow({
  entry,
  workspaceId,
}: {
  entry: Extract<Entry, { kind: "series" }>;
  workspaceId: string | undefined;
}) {
  const [open, setOpen] = useState(false);
  const rep = entry.representative;
  const venue = shortVenue(rep.location);
  const count = entry.events.length;

  const start = entry.anchorStart;
  const end = entry.events[entry.events.length - 1].endDate;
  const lastDate = toDate(end);
  const sameYear = isSameYear(start, lastDate);
  const rangeLabel = isSameMonth(start, lastDate)
    ? `${format(start, "MMM d")} – ${format(lastDate, "d")}`
    : sameYear
      ? `${format(start, "MMM")} – ${format(lastDate, "MMM")}`
      : `${format(start, "MMM yyyy")} – ${format(lastDate, "MMM yyyy")}`;

  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group w-full flex items-center gap-3 px-3 sm:px-4 py-3 hover:bg-accent/40 transition-colors min-w-0 text-left"
        aria-expanded={open}
      >
        <span
          className="size-2.5 rounded-full shrink-0"
          style={{ backgroundColor: rep.color }}
          aria-hidden
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
              {rep.title}
            </p>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-primary bg-primary/10 rounded-full px-1.5 py-0.5 shrink-0">
              <Layers className="h-2.5 w-2.5" />
              {count} sessions
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            <span className="tabular-nums">{formatEventTime(rep)}</span>
            {venue && (
              <>
                <span className="mx-1.5 opacity-50">·</span>
                {venue}
              </>
            )}
            <span className="mx-1.5 opacity-50">·</span>
            <span className="tabular-nums">{rangeLabel}</span>
          </p>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground/60 shrink-0 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <ul className="border-t bg-muted/20 divide-y">
          {entry.events.map((ev) => {
            const s = toDate(ev.startDate);
            const e = toDate(ev.endDate);
            const rel = relativeDayLabel(s);
            const dateLabel = isSameDay(s, e)
              ? format(s, "EEE, MMM d")
              : isSameMonth(s, e)
                ? `${format(s, "MMM d")} – ${format(e, "d")}`
                : `${format(s, "MMM d")} – ${format(e, "MMM d")}`;
            return (
              <li key={ev.id} className="min-w-0">
                <Link
                  to={`/events/${workspaceId}/${ev.id}`}
                  className="group/session flex items-center gap-3 pl-8 sm:pl-10 pr-3 sm:pr-4 py-2.5 hover:bg-accent/40 transition-colors min-w-0"
                >
                  <div className="flex-1 min-w-0 flex items-baseline gap-2 flex-wrap">
                    {rel && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                        {rel}
                      </span>
                    )}
                    <span className="text-xs font-medium tabular-nums">
                      {dateLabel}
                    </span>
                  </div>
                  {ev.registrationOpen ? (
                    <span className="text-xs font-medium text-primary group-hover/session:underline shrink-0">
                      Register
                    </span>
                  ) : (
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 group-hover/session:text-primary group-hover/session:translate-x-0.5 transition-all" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function DateHeader({ group }: { group: DateGroup }) {
  const { start, end, multi, entries } = group;
  const isSeries =
    entries.length === 1 && entries[0].kind === "series";
  const rel = relativeDayLabel(start);

  let primary: string;
  let secondary: string | null = null;

  if (isSeries) {
    // Series cards carry their own range — header just anchors to first session.
    primary = `Starts ${format(start, "MMM d")}`;
  } else if (!multi) {
    primary = format(start, "EEE, MMM d");
  } else {
    const days = differenceInCalendarDays(end, start) + 1;
    if (isSameMonth(start, end)) {
      primary = `${format(start, "MMM d")} – ${format(end, "d")}`;
    } else {
      primary = `${format(start, "MMM d")} – ${format(end, "MMM d")}`;
    }
    secondary = `${days} days`;
  }

  return (
    <div className="flex items-baseline gap-2 mb-2 mt-1">
      {rel && (
        <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
          {rel}
        </span>
      )}
      <h3 className="text-sm font-semibold tracking-tight text-foreground">
        {primary}
      </h3>
      {secondary && (
        <span className="text-xs text-muted-foreground">· {secondary}</span>
      )}
    </div>
  );
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
  const [categoryFilter, setCategoryFilter] = useState<
    EventCategory | "all"
  >("all");

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
        (a, b) =>
          toDate(a.startDate).getTime() - toDate(b.startDate).getTime()
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
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading events...</p>
        </div>
      </PublicLayout>
    );
  }

  if (notFound) {
    return (
      <PublicLayout>
        <div className="text-center py-20 space-y-4">
          <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
            <CalendarDays className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold">Calendar not found</h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            This calendar does not exist or is no longer available. Please
            check the link and try again.
          </p>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout workspaceName={workspaceName ?? undefined}>
      {/* Hero */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Upcoming Events</h1>
        <p className="text-muted-foreground mt-1">
          Browse and register for our upcoming events
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        {/* Category pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setCategoryFilter("all")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              categoryFilter === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent"
            }`}
          >
            All
            <Badge
              variant="secondary"
              className="ml-0.5 h-5 px-1.5 text-[10px]"
            >
              {upcomingEvents.length}
            </Badge>
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() =>
                setCategoryFilter(cat === categoryFilter ? "all" : cat)
              }
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                categoryFilter === cat
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: EVENT_CATEGORY_COLORS[cat] }}
              />
              {EVENT_CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        {/* View toggle */}
        <ToggleGroup
          type="single"
          value={view}
          onValueChange={(val) => {
            if (val) setView(val);
          }}
          variant="outline"
          className="shrink-0"
        >
          <ToggleGroupItem
            value="list"
            aria-label="List view"
            className="gap-1.5"
          >
            <List className="h-4 w-4" />
            <span className="text-xs hidden sm:inline">List</span>
          </ToggleGroupItem>
          <ToggleGroupItem
            value="calendar"
            aria-label="Calendar view"
            className="gap-1.5"
          >
            <CalendarDays className="h-4 w-4" />
            <span className="text-xs hidden sm:inline">Calendar</span>
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* ── List View ── */}
      {view === "list" && (
        <div className="space-y-5">
          {filteredEvents.length === 0 ? (
            <div className="text-center py-16 space-y-4">
              <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
                <CalendarDays className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-medium">No upcoming events</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {categoryFilter !== "all"
                    ? "No events in this category. Try a different filter."
                    : "Check back later for new events."}
                </p>
              </div>
            </div>
          ) : (
            dateGroups.map((group) => (
              <section key={group.key} className="min-w-0">
                <DateHeader group={group} />
                <div className="rounded-xl border bg-card divide-y overflow-hidden">
                  {group.entries.map((entry) => (
                    <Fragment
                      key={
                        entry.kind === "series"
                          ? `s-${entry.key}`
                          : `e-${entry.event.id}`
                      }
                    >
                      {entry.kind === "single" ? (
                        <EventRow
                          event={entry.event}
                          workspaceId={workspaceId}
                        />
                      ) : (
                        <SeriesRow entry={entry} workspaceId={workspaceId} />
                      )}
                    </Fragment>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      )}

      {/* ── Calendar View ── */}
      {view === "calendar" && (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">
                  {format(currentMonth, "MMMM yyyy")}
                </h2>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() =>
                      setCurrentMonth((prev) => subMonths(prev, 1))
                    }
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => setCurrentMonth(new Date())}
                    disabled={isSameMonth(currentMonth, new Date())}
                  >
                    Today
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() =>
                      setCurrentMonth((prev) => addMonths(prev, 1))
                    }
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

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
            </CardContent>
          </Card>

          {/* Selected day */}
          {selectedDate && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold text-muted-foreground whitespace-nowrap">
                  {format(selectedDate, "EEEE, MMMM d")}
                </h3>
                <Separator className="flex-1" />
              </div>
              {selectedDayEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No events on this day
                </p>
              ) : (
                selectedDayEvents.map((event) => (
                  <Link
                    key={event.id}
                    to={`/events/${workspaceId}/${event.id}`}
                    className="block group"
                  >
                    <Card className="overflow-hidden transition-all hover:shadow-md hover:border-primary/20">
                      <CardContent className="p-0">
                        <div className="flex min-w-0">
                          <div
                            className="w-1 shrink-0"
                            style={{ backgroundColor: event.color }}
                          />
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 flex-1 min-w-0 gap-2 sm:gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold group-hover:text-primary transition-colors truncate">
                                {event.title}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 min-w-0">
                                <Clock className="h-3 w-3 shrink-0" />
                                <span className="truncate">{formatEventTime(event)}</span>
                              </p>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap shrink-0">
                              <EventCategoryBadge category={event.category} />
                              {event.registrationOpen && (
                                <Badge className="gap-1">
                                  Register
                                  <ArrowRight className="h-3 w-3" />
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </PublicLayout>
  );
}
