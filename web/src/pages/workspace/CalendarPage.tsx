import { useEffect, useMemo, useState } from "react";
import {
  format,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isAfter,
  startOfDay,
} from "date-fns";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  MapPin,
  Globe,
} from "lucide-react";
import type { CalendarEvent } from "@/lib/types";
import { useAuthStore } from "@/store/auth";
import { subscribeToCalendarEvents } from "@/lib/firestore";
import { MotionPage } from "@/components/ui/motion-page";
import CalendarGrid from "@/components/calendar/CalendarGrid";
import CreateEventDialog from "@/components/calendar/CreateEventDialog";
import EventDetailSheet from "@/components/calendar/EventDetailSheet";
import EventCategoryBadge from "@/components/calendar/EventCategoryBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

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

export default function CalendarPage() {
  const { workspace, user, role } = useAuthStore();

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createDefaultDate, setCreateDefaultDate] = useState<
    Date | undefined
  >(undefined);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
    null
  );

  const canManage = role === "admin" || role === "manager";

  useEffect(() => {
    if (!workspace) return;
    return subscribeToCalendarEvents(workspace.id, setEvents);
  }, [workspace?.id]);

  const selectedDayEvents = selectedDate
    ? events.filter((e) => isSameDay(toDate(e.startDate), selectedDate))
    : [];

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
      )
      .slice(0, 5);
  }, [events]);

  const formatEventTime = (event: CalendarEvent): string => {
    if (event.allDay) return "All day";
    return `${format(toDate(event.startDate), "h:mm a")} – ${format(toDate(event.endDate), "h:mm a")}`;
  };

  const stats = useMemo(() => {
    const today = startOfDay(new Date());
    const upcoming = events.filter(
      (e) =>
        isAfter(toDate(e.startDate), today) ||
        isSameDay(toDate(e.startDate), today)
    );
    return {
      total: events.length,
      upcoming: upcoming.length,
      publicEvents: events.filter((e) => e.isPublic).length,
    };
  }, [events]);

  return (
    <MotionPage className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage events and schedules
          </p>
        </div>
        {canManage && (
          <Button
            onClick={() => {
              setCreateDefaultDate(undefined);
              setCreateDialogOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Event
          </Button>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <CalendarDays className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total events</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Clock className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.upcoming}</p>
              <p className="text-xs text-muted-foreground">Upcoming</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Globe className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.publicEvents}</p>
              <p className="text-xs text-muted-foreground">Public events</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main content: calendar + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar grid — takes 2/3 */}
        <Card className="lg:col-span-2">
          <CardContent className="p-4">
            {/* Month navigation */}
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
              onEventClick={(event) => {
                setSelectedEvent(event);
                setDetailSheetOpen(true);
              }}
            />
          </CardContent>
        </Card>

        {/* Sidebar — upcoming events */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Upcoming Events
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {upcomingEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No upcoming events
                </p>
              ) : (
                upcomingEvents.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    className="w-full text-left rounded-lg p-2.5 hover:bg-accent transition-colors group"
                    onClick={() => {
                      setSelectedEvent(event);
                      setDetailSheetOpen(true);
                    }}
                  >
                    <div className="flex items-start gap-2.5">
                      <div
                        className="w-1 h-full min-h-[36px] rounded-full shrink-0 mt-0.5"
                        style={{ backgroundColor: event.color }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                          {event.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(toDate(event.startDate), "MMM d")} ·{" "}
                          {formatEventTime(event)}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <EventCategoryBadge category={event.category} />
                          {event.isPublic && (
                            <Badge
                              variant="outline"
                              className="text-[10px] h-5 px-1.5"
                            >
                              Public
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Selected day events panel */}
      {selectedDate && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">
                {format(selectedDate, "EEEE, MMMM d, yyyy")}
              </CardTitle>
              <Badge variant="secondary">
                {selectedDayEvents.length} event
                {selectedDayEvents.length !== 1 ? "s" : ""}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {selectedDayEvents.length === 0 ? (
              <div className="text-center py-6 space-y-2">
                <CalendarDays className="h-8 w-8 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">
                  No events on this day
                </p>
                {canManage && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCreateDefaultDate(selectedDate);
                      setCreateDialogOpen(true);
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Event
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {selectedDayEvents.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    className="w-full text-left"
                    onClick={() => {
                      setSelectedEvent(event);
                      setDetailSheetOpen(true);
                    }}
                  >
                    <Card className="overflow-hidden hover:shadow-sm hover:border-primary/20 transition-all">
                      <CardContent className="p-0">
                        <div className="flex">
                          <div
                            className="w-1 shrink-0"
                            style={{ backgroundColor: event.color }}
                          />
                          <div className="flex items-center justify-between p-3 flex-1 gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div>
                                <p className="text-sm font-medium truncate">
                                  {event.title}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {formatEventTime(event)}
                                  </span>
                                  {event.location && (
                                    <span className="flex items-center gap-1">
                                      <MapPin className="h-3 w-3" />
                                      {event.location}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <EventCategoryBadge category={event.category} />
                              {event.isPublic && (
                                <Badge variant="outline" className="gap-1">
                                  <Globe className="h-3 w-3" />
                                  Public
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </button>
                ))}
                {canManage && (
                  <>
                    <Separator className="my-2" />
                    <Button
                      variant="outline"
                      className="w-full"
                      size="sm"
                      onClick={() => {
                        setCreateDefaultDate(selectedDate);
                        setCreateDialogOpen(true);
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Event
                    </Button>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialogs/Sheets */}
      <CreateEventDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        wsId={workspace?.id ?? ""}
        workspaceName={workspace?.name ?? ""}
        userId={user?.uid ?? ""}
        defaultDate={createDefaultDate}
      />
      {selectedEvent && (
        <EventDetailSheet
          open={detailSheetOpen}
          onOpenChange={setDetailSheetOpen}
          wsId={workspace?.id ?? ""}
          workspaceName={workspace?.name ?? ""}
          userId={user?.uid ?? ""}
          event={selectedEvent}
          canManage={canManage}
        />
      )}
    </MotionPage>
  );
}
