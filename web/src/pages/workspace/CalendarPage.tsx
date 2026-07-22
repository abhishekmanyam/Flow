import { useEffect, useMemo, useState } from "react";
import {
  format,
  addDays,
  subDays,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  isSameDay,
  isAfter,
  isBefore,
  startOfDay,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import {
  CalendarDays,
  Plus,
  Clock,
  MapPin,
  Download,
  List as ListIcon,
  Settings,
} from "lucide-react";
import type { CalendarEvent, EventCategory } from "@/lib/types";
import { EVENT_CATEGORY_LABELS } from "@/lib/types";
import { useAuthStore } from "@/store/auth";
import { subscribeToCalendarEvents } from "@/lib/firestore";
import { toast } from "@/components/system/toast";
import { downloadICS } from "@/lib/ics";
import FullCalendarView from "@/components/calendar/FullCalendarView";
import CreateEventDialog from "@/components/calendar/CreateEventDialog";
import EventDetailSheet from "@/components/calendar/EventDetailSheet";
import EventCategoryBadge from "@/components/calendar/EventCategoryBadge";
import { Layout, LayoutHeader, LayoutContent } from "@astryxdesign/core/Layout";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { Button } from "@astryxdesign/core/Button";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Icon } from "@astryxdesign/core/Icon";
import { Badge } from "@astryxdesign/core/Badge";
import { Divider } from "@astryxdesign/core/Divider";
import { Banner } from "@astryxdesign/core/Banner";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Spinner } from "@astryxdesign/core/Spinner";
import { Center } from "@astryxdesign/core/Center";
import { SegmentedControl } from "@astryxdesign/core/SegmentedControl";
import { SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Selector } from "@astryxdesign/core/Selector";
import { TextInput } from "@astryxdesign/core/TextInput";
import { CheckboxList, CheckboxListItem } from "@astryxdesign/core/CheckboxList";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { List, ListItem } from "@astryxdesign/core/List";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function toDate(val: unknown): Date {
  if (!val) return new Date();
  if (val instanceof Date) return val;
  if (typeof val === "object" && "toDate" in (val as Record<string, unknown>))
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
    const excluded = (event.excludedDates ?? []).map((d) => toDate(d).getTime());
    const eventStart = toDate(event.startDate);
    // Skip the original occurrence if it's excluded
    if (!excluded.includes(startOfDay(eventStart).getTime())) {
      result.push(event);
    }
    if (!event.isRepeating || !event.repeatingType) continue;
    const eventEnd = toDate(event.endDate);
    const duration = eventEnd.getTime() - eventStart.getTime();
    const repeatUntil = event.repeatingEndDate
      ? toDate(event.repeatingEndDate)
      : null;
    const addFn =
      event.repeatingType === "daily"
        ? addDays
        : event.repeatingType === "weekly"
          ? addWeeks
          : addMonths;
    let occurrence = addFn(eventStart, 1);
    let count = 0;
    while (isBefore(occurrence, rangeEnd) && count < 90) {
      if (repeatUntil && isAfter(occurrence, repeatUntil)) break;
      if (isAfter(occurrence, rangeStart) || isSameDay(occurrence, rangeStart)) {
        if (!excluded.includes(startOfDay(occurrence).getTime())) {
          const occStart = occurrence;
          const occEnd = new Date(occStart.getTime() + duration);
          result.push({
            ...event,
            id: `${event.id}_${occStart.getTime()}`,
            startDate: {
              toDate: () => occStart,
            } as unknown as import("firebase/firestore").Timestamp,
            endDate: {
              toDate: () => occEnd,
            } as unknown as import("firebase/firestore").Timestamp,
          });
        }
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

const SCOPE_OPTIONS: { value: EventScope; label: string }[] = [
  { value: "all", label: "All" },
  { value: "mine", label: "Mine" },
  { value: "public", label: "Public" },
];

const ALL_CATEGORIES: EventCategory[] = [
  "meeting",
  "workshop",
  "webinar",
  "social",
  "other",
];

const DAYS_OPTIONS = [3, 5, 7] as const;

// Friendly names for the fixed brand palette used by events.
const COLOR_LABELS: Record<string, string> = {
  "#6366f1": "Indigo",
  "#8b5cf6": "Violet",
  "#ec4899": "Pink",
  "#f97316": "Orange",
  "#eab308": "Yellow",
  "#22c55e": "Green",
  "#14b8a6": "Teal",
  "#3b82f6": "Blue",
  "#ef4444": "Red",
  "#a855f7": "Purple",
};

// ─── Component ─────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const { workspace, user, role } = useAuthStore();

  // ── Events ──
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [eventsLoaded, setEventsLoaded] = useState(false);
  const [subError, setSubError] = useState<string | null>(null);

  // ── Navigation ──
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [daysCount, setDaysCount] = useState<number>(7);

  // ── Filters ──
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<EventCategory[]>(
    []
  );
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [eventScope, setEventScope] = useState<EventScope>("all");

  // ── Display ──
  const [use24h, setUse24h] = useState(false);
  const [showListView, setShowListView] = useState(false);

  // ── Settings ──
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [weekStartsOn, setWeekStartsOn] = useState<0 | 1>(0);

  // ── Dialogs ──
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createDefaultDate, setCreateDefaultDate] = useState<Date | undefined>(
    undefined
  );
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const canCreate = role === "admin" || role === "manager" || role === "member";
  const canManageAnyEvent = role === "admin" || role === "manager";
  const canDelete = role === "admin" || role === "manager";
  const canViewRegistrations = role === "admin" || role === "manager";
  const canEditSelectedEvent =
    !!selectedEvent &&
    (canManageAnyEvent ||
      (role === "member" && selectedEvent.createdBy === user?.uid));

  // ── Data subscription ──
  useEffect(() => {
    if (!workspace) return;
    setEventsLoaded(false);
    setSubError(null);
    try {
      return subscribeToCalendarEvents(workspace.id, (data) => {
        setEvents(data);
        setEventsLoaded(true);
      });
    } catch {
      setSubError("Failed to load calendar events");
      setEventsLoaded(true);
    }
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
      if (selectedColors.length > 0 && !selectedColors.includes(event.color)) {
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
        (a, b) => toDate(a.startDate).getTime() - toDate(b.startDate).getTime()
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
          (prev) => new Date(prev.getFullYear() - 1, prev.getMonth(), 1)
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
          (prev) => new Date(prev.getFullYear() + 1, prev.getMonth(), 1)
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

  const clearAllFilters = () => {
    setSearchQuery("");
    setSelectedCategories([]);
    setSelectedColors([]);
    setEventScope("all");
  };

  // ── ICS subscribe URL ──
  const authDomain = (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string) ?? "";
  const projectId =
    authDomain.replace(".firebaseapp.com", "") ||
    import.meta.env.VITE_FIREBASE_PROJECT_ID;
  const icsUrl = projectId
    ? `https://us-central1-${projectId}.cloudfunctions.net/getCalendarICS?workspaceId=${workspace?.id ?? ""}`
    : "";
  const webcalUrl = icsUrl.replace(/^https?:\/\//, "webcal://");
  const googleSubUrl = icsUrl
    ? `https://www.google.com/calendar/render?cid=${encodeURIComponent(webcalUrl)}`
    : "";

  // ── Content region ──
  const content = (() => {
    if (subError) {
      return <Banner status="error" title={subError} />;
    }
    if (!eventsLoaded) {
      return (
        <Center height={240}>
          <Spinner label="Loading calendar" />
        </Center>
      );
    }
    if (showListView) {
      if (listGrouped.length === 0) {
        return (
          <EmptyState
            icon={<CalendarDays size={28} />}
            title="No events found"
            description={
              activeFilterCount > 0
                ? "No events match the current filters."
                : "There are no events this month yet."
            }
          />
        );
      }
      return (
        <VStack gap={4}>
          {listGrouped.map((group) => (
            <VStack key={group.date.toISOString()} gap={1}>
              <Text type="label" color="secondary" weight="semibold">
                {format(group.date, "EEEE, MMMM d, yyyy")} · {group.events.length}{" "}
                event{group.events.length !== 1 ? "s" : ""}
              </Text>
              <List hasDividers>
                {group.events.map((event) => (
                  <ListItem
                    key={event.id}
                    label={event.title}
                    startContent={<Icon icon="calendar" size="sm" />}
                    description={
                      <HStack gap={3} align="center">
                        <HStack gap={1} align="center">
                          <Clock size={12} />
                          <Text type="supporting" color="secondary">
                            {formatEventTime(event)}
                          </Text>
                        </HStack>
                        {event.location && (
                          <HStack gap={1} align="center">
                            <MapPin size={12} />
                            <Text type="supporting" color="secondary" maxLines={1}>
                              {event.location}
                            </Text>
                          </HStack>
                        )}
                      </HStack>
                    }
                    endContent={<EventCategoryBadge category={event.category} />}
                    onClick={() => openEventDetail(event)}
                  />
                ))}
              </List>
            </VStack>
          ))}
        </VStack>
      );
    }
    return (
      <FullCalendarView
        events={filteredEvents}
        viewMode={viewMode}
        daysCount={daysCount}
        currentDate={
          viewMode === "month" || viewMode === "year"
            ? currentMonth
            : selectedDate
        }
        weekStartsOn={weekStartsOn}
        use24h={use24h}
        onEventClick={openEventDetail}
        onDateClick={(date) => {
          setSelectedDate(date);
          setCreateDefaultDate(date);
        }}
      />
    );
  })();

  return (
    <Layout
      header={
        <LayoutHeader hasDivider>
          <VStack paddingInline={4} paddingBlock={3} gap={3}>
            {/* Row 1: navigation + primary actions */}
            <HStack justify="between" align="center" gap={2}>
              <HStack gap={2} align="center">
                <HStack gap={1} align="center">
                  <IconButton
                    label="Previous period"
                    variant="secondary"
                    size="sm"
                    icon={<Icon icon="chevronLeft" size="sm" />}
                    onClick={navigatePrev}
                  />
                  <IconButton
                    label="Next period"
                    variant="secondary"
                    size="sm"
                    icon={<Icon icon="chevronRight" size="sm" />}
                    onClick={navigateNext}
                  />
                </HStack>
                <Heading level={1} maxLines={1}>
                  {headerLabel}
                </Heading>
              </HStack>
              <HStack gap={2} align="center">
                <Button label="Today" variant="secondary" size="sm" onClick={goToToday} />
                {canCreate && (
                  <Button
                    label="New event"
                    variant="primary"
                    size="sm"
                    icon={<Plus size={16} />}
                    onClick={() => {
                      setCreateDefaultDate(
                        viewMode === "day" ? selectedDate : undefined
                      );
                      setCreateDialogOpen(true);
                    }}
                  />
                )}
              </HStack>
            </HStack>

            {/* Row 2: view switcher + tools */}
            <HStack justify="between" align="center" gap={2}>
              <HStack gap={2} align="center">
                <SegmentedControl
                  label="Calendar view"
                  size="sm"
                  value={viewMode}
                  onChange={(v) => setViewMode(v as ViewMode)}
                >
                  {VIEW_LABELS.map(({ key, label }) => (
                    <SegmentedControlItem key={key} value={key} label={label} />
                  ))}
                </SegmentedControl>
                {viewMode === "days" && (
                  <DropdownMenu
                    button={{ label: `${daysCount} days`, variant: "secondary", size: "sm" }}
                    items={DAYS_OPTIONS.map((n) => ({
                      label: `${n} days`,
                      onClick: () => setDaysCount(n),
                    }))}
                  />
                )}
              </HStack>

              <HStack gap={2} align="center">
                <HStack width={220}>
                  <TextInput
                    label="Search events"
                    isLabelHidden
                    size="sm"
                    startIcon="search"
                    hasClear
                    placeholder="Search events..."
                    value={searchQuery}
                    onChange={setSearchQuery}
                  />
                </HStack>
                <Button
                  label="Filter"
                  variant="secondary"
                  size="sm"
                  icon={<Icon icon="funnel" size="sm" />}
                  endContent={
                    activeFilterCount > 0 ? (
                      <Badge label={String(activeFilterCount)} />
                    ) : undefined
                  }
                  onClick={() => setFilterOpen(true)}
                />
                <SegmentedControl
                  label="Display mode"
                  size="sm"
                  value={showListView ? "list" : "calendar"}
                  onChange={(v) => setShowListView(v === "list")}
                >
                  <SegmentedControlItem
                    value="calendar"
                    label="Calendar"
                    isLabelHidden
                    icon={<CalendarDays size={16} />}
                  />
                  <SegmentedControlItem
                    value="list"
                    label="List"
                    isLabelHidden
                    icon={<ListIcon size={16} />}
                  />
                </SegmentedControl>
                <IconButton
                  label="Calendar settings"
                  variant="ghost"
                  size="sm"
                  icon={<Settings size={18} />}
                  onClick={() => setSettingsOpen(true)}
                />
              </HStack>
            </HStack>
          </VStack>
        </LayoutHeader>
      }
    >
      <LayoutContent padding={4}>{content}</LayoutContent>

      {/* ── Filter dialog ── */}
      <Dialog isOpen={filterOpen} onOpenChange={setFilterOpen} width={360}>
        <DialogHeader title="Filters" onOpenChange={setFilterOpen} />
        <VStack padding={4} gap={4}>
          <SegmentedControl
            label="Show events"
            layout="fill"
            value={eventScope}
            onChange={(v) => setEventScope(v as EventScope)}
          >
            {SCOPE_OPTIONS.map(({ value, label }) => (
              <SegmentedControlItem key={value} value={value} label={label} />
            ))}
          </SegmentedControl>

          <Divider />

          <CheckboxList
            label="Categories"
            value={selectedCategories}
            onChange={(values) => setSelectedCategories(values as EventCategory[])}
          >
            {ALL_CATEGORIES.map((cat) => (
              <CheckboxListItem
                key={cat}
                value={cat}
                label={EVENT_CATEGORY_LABELS[cat]}
              />
            ))}
          </CheckboxList>

          {eventColors.length > 0 && (
            <>
              <Divider />
              <CheckboxList
                label="Colors"
                value={selectedColors}
                onChange={setSelectedColors}
              >
                {eventColors.map((color) => (
                  <CheckboxListItem
                    key={color}
                    value={color}
                    label={COLOR_LABELS[color] ?? color}
                  />
                ))}
              </CheckboxList>
            </>
          )}

          {activeFilterCount > 0 && (
            <>
              <Divider />
              <Button
                label="Clear all filters"
                variant="ghost"
                icon={<Icon icon="close" size="sm" />}
                onClick={clearAllFilters}
              />
            </>
          )}
        </VStack>
      </Dialog>

      {/* ── Settings dialog ── */}
      <Dialog isOpen={settingsOpen} onOpenChange={setSettingsOpen} width={440}>
        <DialogHeader
          title="Calendar settings"
          subtitle="Customize your calendar preferences"
          onOpenChange={setSettingsOpen}
        />
        <VStack padding={4} gap={4} isScrollable>
          <Selector
            label="Week starts on"
            value={String(weekStartsOn)}
            onChange={(v) => setWeekStartsOn(Number(v) as 0 | 1)}
            options={[
              { value: "0", label: "Sunday" },
              { value: "1", label: "Monday" },
            ]}
          />
          <Selector
            label="Default view"
            value={viewMode}
            onChange={(v) => setViewMode(v as ViewMode)}
            options={VIEW_LABELS.map(({ key, label }) => ({
              value: key,
              label,
            }))}
          />
          <Selector
            label="Time format"
            value={use24h ? "24h" : "12h"}
            onChange={(v) => setUse24h(v === "24h")}
            options={[
              { value: "12h", label: "12-hour (AM/PM)" },
              { value: "24h", label: "24-hour" },
            ]}
          />
          <Selector
            label="Multi-day view count"
            value={String(daysCount)}
            onChange={(v) => setDaysCount(Number(v))}
            options={DAYS_OPTIONS.map((n) => ({
              value: String(n),
              label: `${n} days`,
            }))}
          />

          <Divider />

          <VStack gap={3}>
            <Text type="label" weight="semibold">
              Calendar export
            </Text>
            <Button
              label="Download .ics file"
              variant="secondary"
              width="100%"
              icon={<Download size={16} />}
              onClick={() => {
                downloadICS(
                  events,
                  (workspace?.name ?? "Calendar") + " Calendar"
                );
                toast.success("Calendar downloaded");
              }}
            />

            <Text type="supporting" color="secondary">
              Subscribe URL (for Google Calendar / Outlook)
            </Text>
            {icsUrl ? (
              <VStack gap={2}>
                <Button
                  label="Add to Google Calendar"
                  variant="secondary"
                  width="100%"
                  icon={<CalendarDays size={16} />}
                  onClick={() => window.open(googleSubUrl, "_blank")}
                />
                <HStack gap={2} align="center">
                  <Text type="code" maxLines={1}>
                    {icsUrl}
                  </Text>
                  <IconButton
                    label="Copy subscribe link"
                    variant="secondary"
                    size="sm"
                    icon={<Icon icon="copy" size="sm" />}
                    onClick={() => {
                      navigator.clipboard.writeText(icsUrl);
                      toast.success("Link copied");
                    }}
                  />
                </HStack>
                <Text type="supporting" color="secondary">
                  Or paste the URL above in Outlook (Add calendar → Subscribe
                  from web).
                </Text>
              </VStack>
            ) : (
              <Text type="supporting" color="secondary">
                Set VITE_FIREBASE_PROJECT_ID and deploy the Cloud Function first.
              </Text>
            )}
          </VStack>
        </VStack>
      </Dialog>

      {/* ── Event dialogs ── */}
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
          canEdit={canEditSelectedEvent}
          canDelete={canDelete}
          canViewRegistrations={canViewRegistrations}
        />
      )}
    </Layout>
  );
}
