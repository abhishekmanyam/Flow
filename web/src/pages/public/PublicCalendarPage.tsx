import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  format,
  addMonths,
  subMonths,
  isSameDay,
  isSameMonth,
  isAfter,
  startOfDay,
} from "date-fns";
import {
  CalendarDays,
  List,
  Loader2,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Clock,
  ArrowRight,
} from "lucide-react";
import type { CalendarEvent, EventCategory } from "@/lib/types";
import { EVENT_CATEGORY_LABELS, EVENT_CATEGORY_COLORS } from "@/lib/types";
import { getPublicCalendarEvents } from "@/lib/firestore";
import PublicLayout from "@/components/calendar/PublicLayout";
import CalendarGrid from "@/components/calendar/CalendarGrid";
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

function formatEventTime(event: CalendarEvent): string {
  if (event.allDay) return "All day";
  return `${format(toDate(event.startDate), "h:mm a")} – ${format(toDate(event.endDate), "h:mm a")}`;
}

function groupEventsByMonth(
  events: CalendarEvent[]
): Map<string, CalendarEvent[]> {
  const groups = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const key = format(toDate(event.startDate), "MMMM yyyy");
    const existing = groups.get(key);
    if (existing) {
      existing.push(event);
    } else {
      groups.set(key, [event]);
    }
  }
  return groups;
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

  const groupedEvents = useMemo(
    () => groupEventsByMonth(filteredEvents),
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
        <div className="space-y-8">
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
            Array.from(groupedEvents.entries()).map(
              ([month, monthEvents]) => (
                <div key={month} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                      {month}
                    </h2>
                    <Separator className="flex-1" />
                  </div>

                  <div className="grid gap-3">
                    {monthEvents.map((event) => (
                      <Link
                        key={event.id}
                        to={`/events/${workspaceId}/${event.id}`}
                        className="block group"
                      >
                        <Card className="overflow-hidden transition-all hover:shadow-md hover:border-primary/20">
                          <CardContent className="p-0">
                            <div className="flex">
                              {/* Left color accent */}
                              <div
                                className="w-1 shrink-0"
                                style={{ backgroundColor: event.color }}
                              />

                              {/* Date badge */}
                              <div className="flex flex-col items-center justify-center px-4 py-3 bg-muted/30 min-w-[72px]">
                                <span className="text-xs font-medium text-muted-foreground uppercase">
                                  {format(toDate(event.startDate), "MMM")}
                                </span>
                                <span className="text-2xl font-bold leading-none mt-0.5">
                                  {format(toDate(event.startDate), "d")}
                                </span>
                                <span className="text-xs text-muted-foreground mt-0.5">
                                  {format(toDate(event.startDate), "EEE")}
                                </span>
                              </div>

                              {/* Content */}
                              <div className="flex-1 px-4 py-3 flex items-center justify-between gap-3 min-w-0">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold group-hover:text-primary transition-colors truncate">
                                    {event.title}
                                  </p>
                                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                    <span className="inline-flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {formatEventTime(event)}
                                    </span>
                                    {event.location && (
                                      <span className="inline-flex items-center gap-1 truncate">
                                        <MapPin className="h-3 w-3" />
                                        {event.location}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <EventCategoryBadge
                                    category={event.category}
                                  />
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
                    ))}
                  </div>
                </div>
              )
            )
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

              <CalendarGrid
                events={events}
                currentMonth={currentMonth}
                selectedDate={selectedDate}
                onDayClick={(date) => {
                  if (selectedDate && isSameDay(date, selectedDate)) {
                    setSelectedDate(null);
                  } else {
                    setSelectedDate(date);
                  }
                }}
                variant="compact"
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
                        <div className="flex">
                          <div
                            className="w-1 shrink-0"
                            style={{ backgroundColor: event.color }}
                          />
                          <div className="flex items-center justify-between p-3 flex-1 gap-3">
                            <div>
                              <p className="text-sm font-semibold group-hover:text-primary transition-colors">
                                {event.title}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatEventTime(event)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
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
