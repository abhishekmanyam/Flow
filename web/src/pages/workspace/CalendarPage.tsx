import { useEffect, useMemo, useState } from "react";
import {
  format,
  addDays,
  subDays,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isAfter,
  isBefore,
  startOfDay,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
} from "date-fns";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Plus,
  Clock,
  Search,
  Tag,
  Filter,
  List,
  Settings,
  X,
  MapPin,
  Check,
} from "lucide-react";
import type { CalendarEvent, EventCategory } from "@/lib/types";
import {
  EVENT_CATEGORY_LABELS,
  EVENT_CATEGORY_COLORS,
} from "@/lib/types";
import { useAuthStore } from "@/store/auth";
import { subscribeToCalendarEvents } from "@/lib/firestore";
import { MotionPage } from "@/components/ui/motion-page";
import CalendarGrid from "@/components/calendar/CalendarGrid";
import CreateEventDialog from "@/components/calendar/CreateEventDialog";
import EventDetailSheet from "@/components/calendar/EventDetailSheet";
import EventCategoryBadge from "@/components/calendar/EventCategoryBadge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// ─── Helpers ───────────────────────────────────────────────────────────────────

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

function expandRecurringEvents(
  events: CalendarEvent[],
  rangeStart: Date,
  rangeEnd: Date
): CalendarEvent[] {
  const result: CalendarEvent[] = [];
  for (const event of events) {
    result.push(event);
    if (!event.isRepeating || !event.repeatingType) continue;
    const eventStart = toDate(event.startDate);
    const eventEnd = toDate(event.endDate);
    const duration = eventEnd.getTime() - eventStart.getTime();
    const addFn =
      event.repeatingType === "daily"
        ? addDays
        : event.repeatingType === "weekly"
          ? addWeeks
          : addMonths;
    let occurrence = addFn(eventStart, 1);
    let count = 0;
    while (isBefore(occurrence, rangeEnd) && count < 90) {
      if (
        isAfter(occurrence, rangeStart) ||
        isSameDay(occurrence, rangeStart)
      ) {
        const occEnd = new Date(occurrence.getTime() + duration);
        result.push({
          ...event,
          id: `${event.id}_${occurrence.getTime()}`,
          startDate: {
            toDate: () => occurrence,
          } as unknown as import("firebase/firestore").Timestamp,
          endDate: {
            toDate: () => occEnd,
          } as unknown as import("firebase/firestore").Timestamp,
        });
      }
      occurrence = addFn(occurrence, 1);
      count++;
    }
  }
  return result;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

type ViewMode = "day" | "days" | "week" | "month" | "year";
type EventScope = "all" | "mine" | "public";

const VIEW_LABELS: { key: ViewMode; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "days", label: "Days" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
];

const SCOPE_LABELS: Record<EventScope, string> = {
  all: "All Events",
  mine: "My Events",
  public: "Public Events",
};

const ALL_CATEGORIES: EventCategory[] = [
  "meeting",
  "workshop",
  "webinar",
  "social",
  "other",
];

const DAYS_OPTIONS = [3, 5, 7] as const;

// ─── Component ─────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const { workspace, user, role } = useAuthStore();

  // ── Events ──
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  // ── Navigation ──
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [daysCount, setDaysCount] = useState<number>(7);

  // ── Filters ──
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<
    EventCategory[]
  >([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [eventScope, setEventScope] = useState<EventScope>("all");

  // ── Display ──
  const [use24h, setUse24h] = useState(false);
  const [showListView, setShowListView] = useState(false);

  // ── Settings ──
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [weekStartsOn, setWeekStartsOn] = useState<0 | 1>(0);

  // ── Dialogs ──
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createDefaultDate, setCreateDefaultDate] = useState<
    Date | undefined
  >(undefined);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
    null
  );

  const canEdit = role === "admin" || role === "manager" || role === "member";
  const canDelete = role === "admin" || role === "manager";

  // ── Data subscription ──
  useEffect(() => {
    if (!workspace) return;
    return subscribeToCalendarEvents(workspace.id, setEvents);
  }, [workspace?.id]);

  // ── Expanded events (recurring) ──
  const expandedEvents = useMemo(() => {
    const rangeStart = startOfMonth(subMonths(currentMonth, 1));
    const rangeEnd = endOfMonth(addMonths(currentMonth, 2));
    return expandRecurringEvents(events, rangeStart, rangeEnd);
  }, [events, currentMonth]);

  // ── Unique colors from events ──
  const eventColors = useMemo(
    () => [...new Set(events.map((e) => e.color))],
    [events]
  );

  // ── Filtered events ──
  const filteredEvents = useMemo(() => {
    return expandedEvents.filter((event) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !event.title.toLowerCase().includes(q) &&
          !(event.description ?? "").toLowerCase().includes(q) &&
          !(event.location ?? "").toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      if (
        selectedCategories.length > 0 &&
        !selectedCategories.includes(event.category)
      ) {
        return false;
      }
      if (
        selectedColors.length > 0 &&
        !selectedColors.includes(event.color)
      ) {
        return false;
      }
      if (eventScope === "mine" && event.createdBy !== user?.uid) {
        return false;
      }
      if (eventScope === "public" && !event.isPublic) {
        return false;
      }
      return true;
    });
  }, [
    expandedEvents,
    searchQuery,
    selectedCategories,
    selectedColors,
    eventScope,
    user?.uid,
  ]);

  const activeFilterCount =
    (searchQuery ? 1 : 0) +
    selectedCategories.length +
    selectedColors.length +
    (eventScope !== "all" ? 1 : 0);

  // ── Day view events ──
  const dayViewEvents = useMemo(() => {
    return filteredEvents
      .filter((e) => isSameDay(toDate(e.startDate), selectedDate))
      .sort(
        (a, b) =>
          toDate(a.startDate).getTime() - toDate(b.startDate).getTime()
      );
  }, [filteredEvents, selectedDate]);

  // ── Week / Days view dates ──
  const multiDayDates = useMemo(() => {
    if (viewMode === "week") {
      const weekStart = startOfWeek(selectedDate, { weekStartsOn });
      const weekEnd = endOfWeek(selectedDate, { weekStartsOn });
      return eachDayOfInterval({ start: weekStart, end: weekEnd });
    }
    // days mode — show daysCount days from selected date
    return Array.from({ length: daysCount }, (_, i) =>
      addDays(selectedDate, i)
    );
  }, [viewMode, selectedDate, weekStartsOn, daysCount]);

  // ── List view events (current month) ──
  const listViewEvents = useMemo(() => {
    const ms = startOfMonth(currentMonth);
    const me = endOfMonth(currentMonth);
    return filteredEvents
      .filter((e) => {
        const d = toDate(e.startDate);
        return (
          (isAfter(d, ms) || isSameDay(d, ms)) &&
          (isBefore(d, me) || isSameDay(d, me))
        );
      })
      .sort(
        (a, b) =>
          toDate(a.startDate).getTime() - toDate(b.startDate).getTime()
      );
  }, [filteredEvents, currentMonth]);

  // ── List view grouped by date ──
  const listGrouped = useMemo(() => {
    const groups: { date: Date; events: CalendarEvent[] }[] = [];
    for (const event of listViewEvents) {
      const d = startOfDay(toDate(event.startDate));
      const last = groups[groups.length - 1];
      if (last && isSameDay(last.date, d)) {
        last.events.push(event);
      } else {
        groups.push({ date: d, events: [event] });
      }
    }
    return groups;
  }, [listViewEvents]);

  // ── Navigation ──
  const navigatePrev = () => {
    switch (viewMode) {
      case "day":
        setSelectedDate((prev) => subDays(prev, 1));
        break;
      case "days":
        setSelectedDate((prev) => subDays(prev, daysCount));
        break;
      case "week":
        setSelectedDate((prev) => subWeeks(prev, 1));
        break;
      case "month":
        setCurrentMonth((prev) => subMonths(prev, 1));
        break;
      case "year":
        setCurrentMonth(
          (prev) =>
            new Date(prev.getFullYear() - 1, prev.getMonth(), 1)
        );
        break;
    }
  };

  const navigateNext = () => {
    switch (viewMode) {
      case "day":
        setSelectedDate((prev) => addDays(prev, 1));
        break;
      case "days":
        setSelectedDate((prev) => addDays(prev, daysCount));
        break;
      case "week":
        setSelectedDate((prev) => addWeeks(prev, 1));
        break;
      case "month":
        setCurrentMonth((prev) => addMonths(prev, 1));
        break;
      case "year":
        setCurrentMonth(
          (prev) =>
            new Date(prev.getFullYear() + 1, prev.getMonth(), 1)
        );
        break;
    }
  };

  const goToToday = () => {
    setSelectedDate(new Date());
    setCurrentMonth(new Date());
  };

  // ── Header label ──
  const headerLabel = (() => {
    switch (viewMode) {
      case "day":
        return format(selectedDate, "EEEE, MMMM d, yyyy");
      case "days": {
        const end = addDays(selectedDate, daysCount - 1);
        return `${format(selectedDate, "MMM d")} – ${format(end, "MMM d, yyyy")}`;
      }
      case "week": {
        const ws = startOfWeek(selectedDate, { weekStartsOn });
        const we = endOfWeek(selectedDate, { weekStartsOn });
        return `${format(ws, "MMM d")} – ${format(we, "MMM d, yyyy")}`;
      }
      case "month":
        return format(currentMonth, "MMMM yyyy");
      case "year":
        return format(currentMonth, "yyyy");
    }
  })();

  const formatTime = (d: Date) => format(d, use24h ? "HH:mm" : "h:mm a");

  const formatEventTime = (event: CalendarEvent): string => {
    if (event.allDay) return "All day";
    return `${formatTime(toDate(event.startDate))} – ${formatTime(toDate(event.endDate))}`;
  };

  const openEventDetail = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setDetailSheetOpen(true);
  };

  const handleMoreClick = (date: Date) => {
    setSelectedDate(date);
    setViewMode("day");
  };

  // ── Category toggle ──
  const toggleCategory = (cat: EventCategory) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  // ── Color toggle ──
  const toggleColor = (color: string) => {
    setSelectedColors((prev) =>
      prev.includes(color)
        ? prev.filter((c) => c !== color)
        : [...prev, color]
    );
  };

  // ── Render event row (for list / day views) ──
  const renderEventRow = (event: CalendarEvent) => (
    <button
      key={event.id}
      type="button"
      className="w-full text-left flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors group"
      onClick={() => openEventDetail(event)}
    >
      <div
        className="w-1 self-stretch rounded-full shrink-0"
        style={{ backgroundColor: event.color }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
          {event.title}
        </p>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatEventTime(event)}
          </span>
          {event.location && (
            <span className="flex items-center gap-1 truncate">
              <MapPin className="h-3 w-3 shrink-0" />
              {event.location}
            </span>
          )}
        </div>
      </div>
      <EventCategoryBadge category={event.category} />
    </button>
  );

  return (
    <MotionPage className="p-4 space-y-3">
      {/* ── Header row ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={navigatePrev}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {viewMode === "month" ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold text-sm">
                  {format(currentMonth, "MMMM")}
                </span>
                <div className="flex flex-col -space-y-1">
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground transition-colors p-0 leading-none"
                    onClick={() =>
                      setCurrentMonth((prev) => subMonths(prev, 1))
                    }
                  >
                    <ChevronUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground transition-colors p-0 leading-none"
                    onClick={() =>
                      setCurrentMonth((prev) => addMonths(prev, 1))
                    }
                  >
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-0.5">
                <span className="font-semibold text-sm">
                  {format(currentMonth, "yyyy")}
                </span>
                <div className="flex flex-col -space-y-1">
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground transition-colors p-0 leading-none"
                    onClick={() =>
                      setCurrentMonth(
                        (prev) =>
                          new Date(
                            prev.getFullYear() - 1,
                            prev.getMonth(),
                            1
                          )
                      )
                    }
                  >
                    <ChevronUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground transition-colors p-0 leading-none"
                    onClick={() =>
                      setCurrentMonth(
                        (prev) =>
                          new Date(
                            prev.getFullYear() + 1,
                            prev.getMonth(),
                            1
                          )
                      )
                    }
                  >
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <span className="font-semibold text-sm px-2">
              {headerLabel}
            </span>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={navigateNext}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToToday}>
            <CalendarDays className="mr-2 h-4 w-4" />
            {viewMode === "month" || viewMode === "year"
              ? "This month"
              : "Today"}
          </Button>
          {canEdit && (
            <Button
              size="sm"
              onClick={() => {
                setCreateDefaultDate(
                  viewMode === "day" ? selectedDate : undefined
                );
                setCreateDialogOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Event
            </Button>
          )}
        </div>
      </div>

      {/* ── Toolbar row ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={searchQuery ? "secondary" : "outline"}
              size="sm"
            >
              <Search className="mr-2 h-4 w-4" />
              {searchQuery ? `"${searchQuery}"` : "Search Events"}
              {searchQuery && (
                <X
                  className="ml-1.5 h-3 w-3"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearchQuery("");
                  }}
                />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3" align="start">
            <div className="space-y-2">
              <Label className="text-xs font-medium">
                Search events
              </Label>
              <Input
                placeholder="Search by title, description, location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => setSearchQuery("")}
                >
                  Clear search
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Categories */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={
                selectedCategories.length > 0 ? "secondary" : "outline"
              }
              size="sm"
            >
              <Tag className="mr-2 h-4 w-4" />
              Categories
              {selectedCategories.length > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1.5 h-5 px-1.5 text-[10px]"
                >
                  {selectedCategories.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-3" align="start">
            <div className="space-y-3">
              <Label className="text-xs font-medium">
                Filter by category
              </Label>
              {ALL_CATEGORIES.map((cat) => (
                <div key={cat} className="flex items-center gap-2">
                  <Checkbox
                    id={`cat-${cat}`}
                    checked={selectedCategories.includes(cat)}
                    onCheckedChange={() => toggleCategory(cat)}
                  />
                  <label
                    htmlFor={`cat-${cat}`}
                    className="flex items-center gap-2 text-sm cursor-pointer flex-1"
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{
                        backgroundColor: EVENT_CATEGORY_COLORS[cat],
                      }}
                    />
                    {EVENT_CATEGORY_LABELS[cat]}
                  </label>
                </div>
              ))}
              {selectedCategories.length > 0 && (
                <>
                  <Separator />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => setSelectedCategories([])}
                  >
                    Clear all
                  </Button>
                </>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Colors */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={
                selectedColors.length > 0 ? "secondary" : "outline"
              }
              size="sm"
            >
              <div className="mr-2 h-3 w-3 rounded-full bg-purple-500" />
              Colors
              {selectedColors.length > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1.5 h-5 px-1.5 text-[10px]"
                >
                  {selectedColors.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-3" align="start">
            <div className="space-y-3">
              <Label className="text-xs font-medium">
                Filter by color
              </Label>
              <div className="flex flex-wrap gap-2">
                {eventColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={cn(
                      "h-7 w-7 rounded-full transition-all flex items-center justify-center",
                      selectedColors.includes(color)
                        ? "ring-2 ring-offset-2 ring-primary scale-110"
                        : "hover:scale-110"
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() => toggleColor(color)}
                  >
                    {selectedColors.includes(color) && (
                      <Check className="h-3.5 w-3.5 text-white" />
                    )}
                  </button>
                ))}
              </div>
              {eventColors.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No events to filter
                </p>
              )}
              {selectedColors.length > 0 && (
                <>
                  <Separator />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => setSelectedColors([])}
                  >
                    Clear all
                  </Button>
                </>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Scope filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant={eventScope !== "all" ? "secondary" : "outline"}
              size="sm"
            >
              <Filter className="mr-2 h-4 w-4" />
              {SCOPE_LABELS[eventScope]}
              <ChevronDown className="ml-1 h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {(Object.keys(SCOPE_LABELS) as EventScope[]).map((scope) => (
              <DropdownMenuItem
                key={scope}
                onClick={() => setEventScope(scope)}
                className={cn(eventScope === scope && "font-semibold")}
              >
                {eventScope === scope && (
                  <Check className="mr-2 h-4 w-4" />
                )}
                {SCOPE_LABELS[scope]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Active filter count */}
        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => {
              setSearchQuery("");
              setSelectedCategories([]);
              setSelectedColors([]);
              setEventScope("all");
            }}
          >
            <X className="mr-1 h-3 w-3" />
            Clear {activeFilterCount} filter
            {activeFilterCount !== 1 ? "s" : ""}
          </Button>
        )}
      </div>

      {/* ── View switcher row ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          {VIEW_LABELS.map(({ key, label }) =>
            key === "days" ? (
              <DropdownMenu key={key}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={viewMode === "days" ? "default" : "ghost"}
                    size="sm"
                    className="h-8"
                  >
                    {label} ({daysCount})
                    <ChevronDown className="ml-1 h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {DAYS_OPTIONS.map((n) => (
                    <DropdownMenuItem
                      key={n}
                      onClick={() => {
                        setDaysCount(n);
                        setViewMode("days");
                      }}
                    >
                      {n} days
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                key={key}
                variant={viewMode === key ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode(key)}
                className="h-8"
              >
                {label}
              </Button>
            )
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={use24h ? "secondary" : "outline"}
            size="sm"
            className="h-8"
            onClick={() => setUse24h((v) => !v)}
          >
            <Clock className="mr-1.5 h-3.5 w-3.5" />
            {use24h ? "24h" : "12h"}
          </Button>
          <div className="flex items-center rounded-md border">
            <Button
              variant={!showListView ? "default" : "ghost"}
              size="sm"
              className="h-8 rounded-r-none border-0"
              onClick={() => setShowListView(false)}
            >
              <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
              Calendar
            </Button>
            <Separator orientation="vertical" className="h-5" />
            <Button
              variant={showListView ? "default" : "ghost"}
              size="sm"
              className="h-8 rounded-l-none border-0"
              onClick={() => setShowListView(true)}
            >
              <List className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings className="mr-1.5 h-3.5 w-3.5" />
            Calendar Settings
          </Button>
        </div>
      </div>

      {/* ── Content area ── */}
      {showListView ? (
        // ── List View ──
        <div className="rounded-lg border">
          {listGrouped.length === 0 ? (
            <div className="p-8 text-center">
              <CalendarDays className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                No events found
                {activeFilterCount > 0 && " for current filters"}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {listGrouped.map((group) => (
                <div key={group.date.toISOString()}>
                  <div className="px-4 py-2 bg-muted/50">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {format(group.date, "EEEE, MMMM d, yyyy")}
                      <span className="ml-2 text-[10px] font-normal normal-case">
                        ({group.events.length} event
                        {group.events.length !== 1 ? "s" : ""})
                      </span>
                    </p>
                  </div>
                  <div className="divide-y">
                    {group.events.map(renderEventRow)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : viewMode === "day" ? (
        // ── Day View ──
        <div className="rounded-lg border">
          <div className="px-4 py-3 border-b bg-muted/30">
            <p className="text-sm font-semibold">
              {format(selectedDate, "EEEE, MMMM d, yyyy")}
            </p>
            <p className="text-xs text-muted-foreground">
              {dayViewEvents.length} event
              {dayViewEvents.length !== 1 ? "s" : ""}
            </p>
          </div>
          {dayViewEvents.length === 0 ? (
            <div className="p-8 text-center">
              <CalendarDays className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                No events on this day
              </p>
              {canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
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
            <div className="divide-y">
              {dayViewEvents.map(renderEventRow)}
            </div>
          )}
        </div>
      ) : viewMode === "week" || viewMode === "days" ? (
        // ── Week / Multi-Day View ──
        <div className="rounded-lg border overflow-hidden">
          <div className="grid border-b" style={{ gridTemplateColumns: `repeat(${multiDayDates.length}, 1fr)` }}>
            {multiDayDates.map((day) => (
              <div
                key={day.toISOString()}
                className={cn(
                  "text-center py-2 text-xs font-medium border-r last:border-r-0",
                  isSameDay(day, new Date())
                    ? "text-primary font-semibold"
                    : "text-muted-foreground"
                )}
              >
                <div>{format(day, "EEE")}</div>
                <div
                  className={cn(
                    "text-lg font-semibold mt-0.5",
                    isSameDay(day, new Date()) && "text-primary"
                  )}
                >
                  {format(day, "d")}
                </div>
              </div>
            ))}
          </div>
          <div className="grid min-h-[400px]" style={{ gridTemplateColumns: `repeat(${multiDayDates.length}, 1fr)` }}>
            {multiDayDates.map((day) => {
              const dayEvents = filteredEvents
                .filter((e) => isSameDay(toDate(e.startDate), day))
                .sort(
                  (a, b) =>
                    toDate(a.startDate).getTime() -
                    toDate(b.startDate).getTime()
                );
              return (
                <div
                  key={day.toISOString()}
                  className="border-r last:border-r-0 p-1.5 space-y-1"
                >
                  {dayEvents.map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      className="w-full text-left rounded-md px-2 py-1.5 text-[11px] text-white"
                      style={{ backgroundColor: event.color }}
                      onClick={() => openEventDetail(event)}
                    >
                      <div className="font-medium truncate leading-tight">
                        {event.title}
                      </div>
                      <div className="flex items-center gap-1 opacity-90 leading-tight mt-0.5">
                        <Clock className="h-2.5 w-2.5 shrink-0" />
                        <span className="truncate">
                          {formatEventTime(event)}
                        </span>
                      </div>
                    </button>
                  ))}
                  {dayEvents.length === 0 && (
                    <p className="text-[10px] text-muted-foreground text-center pt-4">
                      No events
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : viewMode === "year" ? (
        // ── Year View ──
        <div className="grid grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 12 }, (_, i) => {
            const monthDate = new Date(
              currentMonth.getFullYear(),
              i,
              1
            );
            return (
              <button
                key={i}
                type="button"
                className={cn(
                  "rounded-lg border p-2 text-left hover:border-primary/50 transition-colors",
                  isSameMonth(monthDate, new Date()) &&
                    "border-primary/30 bg-primary/5"
                )}
                onClick={() => {
                  setCurrentMonth(monthDate);
                  setViewMode("month");
                }}
              >
                <p className="text-xs font-semibold mb-1 px-1">
                  {format(monthDate, "MMMM")}
                </p>
                <CalendarGrid
                  events={filteredEvents}
                  currentMonth={monthDate}
                  selectedDate={selectedDate}
                  onDayClick={(date) => {
                    setSelectedDate(date);
                    setCurrentMonth(monthDate);
                    setViewMode("month");
                  }}
                  weekStartsOn={weekStartsOn}
                  use24h={use24h}
                  variant="compact"
                />
              </button>
            );
          })}
        </div>
      ) : (
        // ── Month View (default) ──
        <div className="rounded-lg border overflow-hidden">
          <CalendarGrid
            events={filteredEvents}
            currentMonth={currentMonth}
            selectedDate={selectedDate}
            onDayClick={(date) => {
              if (isSameDay(date, selectedDate)) {
                setSelectedDate(new Date());
              } else {
                setSelectedDate(date);
              }
            }}
            onEventClick={openEventDetail}
            onMoreClick={handleMoreClick}
            weekStartsOn={weekStartsOn}
            use24h={use24h}
          />
        </div>
      )}

      {/* ── Calendar Settings Sheet ── */}
      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Calendar Settings</SheetTitle>
            <SheetDescription>
              Customize your calendar preferences
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-6 px-4 pt-6">
            <div className="space-y-2">
              <Label>Week starts on</Label>
              <Select
                value={String(weekStartsOn)}
                onValueChange={(val) =>
                  setWeekStartsOn(Number(val) as 0 | 1)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Sunday</SelectItem>
                  <SelectItem value="1">Monday</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Default view</Label>
              <Select
                value={viewMode}
                onValueChange={(val) => setViewMode(val as ViewMode)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VIEW_LABELS.map(({ key, label }) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Time format</Label>
              <Select
                value={use24h ? "24h" : "12h"}
                onValueChange={(val) => setUse24h(val === "24h")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="12h">12-hour (AM/PM)</SelectItem>
                  <SelectItem value="24h">24-hour</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Multi-day view count</Label>
              <Select
                value={String(daysCount)}
                onValueChange={(val) => setDaysCount(Number(val))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS_OPTIONS.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} days
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Event Dialogs ── */}
      {createDialogOpen && (
        <CreateEventDialog
          open
          onOpenChange={setCreateDialogOpen}
          wsId={workspace?.id ?? ""}
          workspaceName={workspace?.name ?? ""}
          userId={user?.uid ?? ""}
          defaultDate={createDefaultDate}
        />
      )}
      {selectedEvent && (
        <EventDetailSheet
          open={detailSheetOpen}
          onOpenChange={setDetailSheetOpen}
          wsId={workspace?.id ?? ""}
          workspaceName={workspace?.name ?? ""}
          userId={user?.uid ?? ""}
          event={selectedEvent}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      )}
    </MotionPage>
  );
}
