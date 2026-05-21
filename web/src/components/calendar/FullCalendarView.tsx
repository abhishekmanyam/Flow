import { useRef, useEffect, useCallback } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import multiMonthPlugin from "@fullcalendar/multimonth";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventInput, DatesSetArg, EventContentArg, EventClickArg } from "@fullcalendar/core";
import type { DateClickArg } from "@fullcalendar/interaction";
import type { CalendarEvent } from "@/lib/types";

type ViewMode = "day" | "days" | "week" | "month" | "year";

const VIEW_MAP: Record<string, string> = {
  day: "timeGridDay",
  week: "timeGridWeek",
  month: "dayGridMonth",
  year: "multiMonthYear",
};

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

function toFullCalendarEvents(events: CalendarEvent[]): EventInput[] {
  return events.map((event) => ({
    id: event.id,
    title: event.title,
    start: toDate(event.startDate),
    end: toDate(event.endDate),
    allDay: event.allDay,
    backgroundColor: event.color,
    borderColor: event.color,
    extendedProps: { calendarEvent: event },
  }));
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
      viewMode === "days"
        ? "dayGrid"
        : VIEW_MAP[viewMode] ?? "dayGridMonth";

    if (api.view.type !== fcView) {
      api.changeView(
        fcView,
        viewMode === "days"
          ? { start: currentDate, end: new Date(currentDate.getTime() + daysCount * 86400000) }
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

  const renderEventContent = useCallback(
    (arg: EventContentArg) => {
      const event = arg.event;
      const isTimeGrid = arg.view.type.startsWith("timeGrid");

      // Year view: compact dot + title
      if (arg.view.type === "multiMonthYear") {
        return (
          <div className="flex items-center gap-1 px-0.5 py-px overflow-hidden">
            <span
              className="h-1.5 w-1.5 rounded-full shrink-0"
              style={{ backgroundColor: event.backgroundColor ?? undefined }}
            />
            <span className="text-[10px] truncate text-foreground">{event.title}</span>
          </div>
        );
      }

      // Time grid (day / week): title + time stacked
      if (isTimeGrid) {
        return (
          <div className="flex flex-col gap-0 px-1 py-0.5 overflow-hidden h-full">
            <span className="font-medium text-[11px] truncate text-white leading-tight">
              {event.title}
            </span>
            {arg.timeText && (
              <span className="text-[10px] text-white/75 leading-tight">
                {arg.timeText}
              </span>
            )}
          </div>
        );
      }

      // Day grid (month): horizontal pill
      return (
        <div
          className="flex items-center gap-1.5 px-1.5 py-0.5 rounded text-white text-[11px] leading-tight overflow-hidden cursor-pointer"
          style={{ backgroundColor: event.backgroundColor ?? undefined }}
        >
          <span className="font-medium truncate">{event.title}</span>
          {!event.allDay && arg.timeText && (
            <span className="opacity-75 text-[10px] shrink-0 tabular-nums">
              {arg.timeText}
            </span>
          )}
        </div>
      );
    },
    []
  );

  const fcEvents = toFullCalendarEvents(events);

  return (
    <div
      className="fc-theme-custom rounded-lg border overflow-hidden"
      style={
        {
          "--fc-border-color": "hsl(var(--border))",
          "--fc-today-bg-color": "hsl(var(--accent) / 0.3)",
          "--fc-page-bg-color": "transparent",
          "--fc-neutral-bg-color": "hsl(var(--muted) / 0.3)",
          "--fc-list-event-hover-bg-color": "hsl(var(--accent))",
          "--fc-now-indicator-color": "hsl(var(--primary))",
          "--fc-event-text-color": "#fff",
          "--fc-small-font-size": "0.75rem",
        } as React.CSSProperties
      }
    >
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
  );
}
