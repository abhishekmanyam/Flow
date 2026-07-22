import { useRef, useEffect, useCallback } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import multiMonthPlugin from "@fullcalendar/multimonth";
import interactionPlugin from "@fullcalendar/interaction";
import type {
  EventInput,
  DatesSetArg,
  EventContentArg,
  EventClickArg,
} from "@fullcalendar/core";
import type { DateClickArg } from "@fullcalendar/interaction";
import type { CalendarEvent } from "@/lib/types";
import { Card } from "@astryxdesign/core/Card";
import { Stack } from "@astryxdesign/core/Stack";
import { HStack } from "@astryxdesign/core/HStack";
import { VStack } from "@astryxdesign/core/VStack";
import { Text } from "@astryxdesign/core/Text";

type ViewMode = "day" | "days" | "week" | "month" | "year";

const VIEW_MAP: Record<string, string> = {
  day: "timeGridDay",
  week: "timeGridWeek",
  month: "dayGridMonth",
  year: "multiMonthYear",
};

/**
 * FullCalendar token bridge.
 *
 * FullCalendar reads its own `--fc-*` CSS custom properties to theme itself; it
 * ships no Astryx-stylable surface and no JS theming API. Per DESIGN_SPEC rule 1
 * (gotcha #9) the sanctioned mechanism is a SINGLE wrapper carrying a vars-ONLY
 * inline `style` — ONLY `--*` custom properties, no visual CSS — that maps each
 * `--fc-*` variable to an Astryx design token (`var(--color-*)`). All visual
 * framing (border, radius, surface, scroll) is done with Astryx components.
 *
 * (`xstyle`/`stylex.create` is unavailable in app code — it throws at runtime
 * because no StyleX compiler is wired into the Vite build.)
 */
const FC_TOKEN_BRIDGE = {
  "--fc-border-color": "var(--color-border)",
  "--fc-page-bg-color": "transparent",
  "--fc-neutral-bg-color": "var(--color-background-muted)",
  "--fc-neutral-text-color": "var(--color-text-secondary)",
  "--fc-today-bg-color": "var(--color-accent-muted)",
  "--fc-highlight-color": "var(--color-accent-muted)",
  "--fc-list-event-hover-bg-color": "var(--color-overlay-hover)",
  "--fc-now-indicator-color": "var(--color-accent)",
  "--fc-event-text-color": "var(--color-on-accent)",
  "--fc-small-font-size": "0.75rem",
} as React.CSSProperties;

/**
 * Pick a readable chip text color for an arbitrary stored event background hex.
 *
 * Event backgrounds come from a free color picker (raw hex, not an Astryx token),
 * so we can't rely on the global `--fc-event-text-color` bridge to stay legible
 * on every hue. We compute perceived brightness with the classic YIQ formula and
 * return a light or dark text value, handed to FullCalendar per-event via
 * `textColor` (which it applies as the chip's inline `color`, inherited by the
 * `color="inherit"` Text nodes in renderEventContent). This is event data fed to
 * the third-party lib — same category as the existing `backgroundColor` hex — not
 * component styling.
 */
function readableTextColor(bg: string): string {
  const hex = bg.trim().replace(/^#/, "");
  const full =
    hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return "var(--color-on-accent)";
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  // Bias slightly above the 128 midpoint so mid-saturated hues (indigo, blue,
  // green) resolve to white text for stronger contrast.
  return yiq >= 145 ? "#1f2937" : "#ffffff";
}

function toDate(val: unknown): Date {
  if (!val) return new Date();
  if (val instanceof Date) return val;
  if (typeof val === "object" && "toDate" in (val as Record<string, unknown>))
    return (val as { toDate: () => Date }).toDate();
  return new Date(val as string);
}

function toFullCalendarEvents(events: CalendarEvent[]): EventInput[] {
  return events.map((event) => {
    const start = toDate(event.startDate);
    let end = toDate(event.endDate);
    // FullCalendar treats `end` as exclusive for all-day events.
    // Bump to the start of the day AFTER the stored end so the event
    // visibly spans through its final day.
    if (event.allDay) {
      end = new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1);
    }
    return {
      id: event.id,
      title: event.title,
      start,
      end,
      allDay: event.allDay,
      backgroundColor: event.color,
      borderColor: event.color,
      textColor: readableTextColor(event.color),
      extendedProps: { calendarEvent: event },
    };
  });
}

interface FullCalendarViewProps {
  events: CalendarEvent[];
  viewMode: ViewMode;
  daysCount?: number;
  currentDate: Date;
  weekStartsOn?: 0 | 1;
  use24h?: boolean;
  onEventClick?: (event: CalendarEvent) => void;
  onDateClick?: (date: Date) => void;
  onDatesSet?: (start: Date, end: Date) => void;
  readOnly?: boolean;
}

export default function FullCalendarView({
  events,
  viewMode,
  daysCount = 7,
  currentDate,
  weekStartsOn = 0,
  use24h = false,
  onEventClick,
  onDateClick,
  onDatesSet,
  readOnly = false,
}: FullCalendarViewProps) {
  const calendarRef = useRef<FullCalendar>(null);

  // Sync view and date from external state
  useEffect(() => {
    const api = calendarRef.current?.getApi();
    if (!api) return;

    const fcView =
      viewMode === "days" ? "dayGrid" : VIEW_MAP[viewMode] ?? "dayGridMonth";

    if (api.view.type !== fcView) {
      api.changeView(
        fcView,
        viewMode === "days"
          ? {
              start: currentDate,
              end: new Date(currentDate.getTime() + daysCount * 86400000),
            }
          : undefined
      );
    }

    // Navigate to date if the calendar is showing a different period
    const calDate = api.getDate();
    if (
      calDate.getFullYear() !== currentDate.getFullYear() ||
      calDate.getMonth() !== currentDate.getMonth() ||
      calDate.getDate() !== currentDate.getDate()
    ) {
      api.gotoDate(currentDate);
    }
  }, [viewMode, currentDate, daysCount]);

  const handleEventClick = useCallback(
    (info: EventClickArg) => {
      const calEvent = info.event.extendedProps.calendarEvent as CalendarEvent;
      if (calEvent) onEventClick?.(calEvent);
    },
    [onEventClick]
  );

  const handleDateClick = useCallback(
    (info: DateClickArg) => {
      onDateClick?.(info.date);
    },
    [onDateClick]
  );

  const handleDatesSet = useCallback(
    (arg: DatesSetArg) => {
      onDatesSet?.(arg.start, arg.end);
    },
    [onDatesSet]
  );

  // Event chips render as Astryx markup. Colors come from FullCalendar itself
  // (event backgroundColor/borderColor + the --fc-event-text-color bridge),
  // so no per-chip color styling lives in the JSX.
  const renderEventContent = useCallback((arg: EventContentArg) => {
    // Year view: FullCalendar keeps its own colored dot; we supply the title.
    if (arg.view.type === "multiMonthYear") {
      return (
        <Text type="supporting" size="3xs" color="inherit" maxLines={1}>
          {arg.event.title}
        </Text>
      );
    }

    // Time grid (day / week): title over time, stacked.
    if (arg.view.type.startsWith("timeGrid")) {
      return (
        <VStack gap={0} paddingInline={1} paddingBlock={0.5}>
          <Text type="label" size="2xs" color="inherit" weight="medium" maxLines={1}>
            {arg.event.title}
          </Text>
          {arg.timeText && (
            <Text type="supporting" size="3xs" color="inherit" maxLines={1}>
              {arg.timeText}
            </Text>
          )}
        </VStack>
      );
    }

    // Day grid (month): horizontal pill.
    return (
      <HStack gap={1} align="center" paddingInline={1} paddingBlock={0.5}>
        <Text type="label" size="2xs" color="inherit" weight="medium" maxLines={1}>
          {arg.event.title}
        </Text>
        {!arg.event.allDay && arg.timeText && (
          <Text type="supporting" size="3xs" color="inherit" hasTabularNumbers>
            {arg.timeText}
          </Text>
        )}
      </HStack>
    );
  }, []);

  const fcEvents = toFullCalendarEvents(events);

  return (
    <Card padding={0}>
      <Stack as="div" isScrollable width="100%">
        {/* Sanctioned vars-only wrapper: maps --fc-* to Astryx tokens. */}
        <div style={FC_TOKEN_BRIDGE}>
          <FullCalendar
            ref={calendarRef}
            plugins={[
              dayGridPlugin,
              timeGridPlugin,
              multiMonthPlugin,
              ...(readOnly ? [] : [interactionPlugin]),
            ]}
            initialView={
              viewMode === "days"
                ? "dayGrid"
                : VIEW_MAP[viewMode] ?? "dayGridMonth"
            }
            initialDate={currentDate}
            events={fcEvents}
            headerToolbar={false}
            firstDay={weekStartsOn}
            eventTimeFormat={{
              hour: use24h ? "2-digit" : "numeric",
              minute: "2-digit",
              hour12: !use24h,
            }}
            slotLabelFormat={{
              hour: use24h ? "2-digit" : "numeric",
              minute: "2-digit",
              hour12: !use24h,
            }}
            height="auto"
            dayMaxEvents={3}
            dayMaxEventRows={2}
            eventContent={renderEventContent}
            eventClick={handleEventClick}
            dateClick={readOnly ? undefined : handleDateClick}
            datesSet={handleDatesSet}
            editable={false}
            selectable={!readOnly}
            nowIndicator
            multiMonthMaxColumns={3}
            slotMinTime="06:00:00"
            allDaySlot
            allDayText=""
            expandRows
          />
        </div>
      </Stack>
    </Card>
  );
}
