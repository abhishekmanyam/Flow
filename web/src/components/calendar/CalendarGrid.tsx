import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
} from "date-fns";
import type { CalendarEvent } from "@/lib/types";
import CalendarDayCell from "./CalendarDayCell";

const SUNDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface CalendarGridProps {
  events: CalendarEvent[];
  currentMonth: Date;
  selectedDate: Date | null;
  onDayClick: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
  onMoreClick?: (date: Date) => void;
  weekStartsOn?: 0 | 1;
  use24h?: boolean;
  variant?: "full" | "compact";
}

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

function getEventsForDay(
  events: CalendarEvent[],
  day: Date
): CalendarEvent[] {
  return events.filter((event) => isSameDay(toDate(event.startDate), day));
}

export default function CalendarGrid({
  events,
  currentMonth,
  selectedDate,
  onDayClick,
  onEventClick,
  onMoreClick,
  weekStartsOn = 0,
  use24h = false,
  variant = "full",
}: CalendarGridProps) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn });

  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const isCompact = variant === "compact";
  const dayLabels = weekStartsOn === 1 ? MONDAY_LABELS : SUNDAY_LABELS;

  return (
    <div className="w-full">
      {/* Day headers */}
      <div className="grid grid-cols-7">
        {dayLabels.map((label) => (
          <div
            key={label}
            className={`text-center font-medium text-muted-foreground ${
              isCompact ? "text-[10px] py-1" : "text-xs py-2"
            }`}
          >
            {isCompact ? label.slice(0, 2) : label}
          </div>
        ))}
      </div>

      {/* Day cells grid */}
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayEvents = getEventsForDay(events, day);

          return (
            <div
              key={day.toISOString()}
              className={isCompact ? "" : "border-t border-r [&:nth-child(7n+1)]:border-l"}
            >
              <CalendarDayCell
                date={day}
                events={dayEvents}
                isCurrentMonth={isSameMonth(day, currentMonth)}
                isSelected={
                  selectedDate ? isSameDay(day, selectedDate) : false
                }
                onClick={() => onDayClick(day)}
                onEventClick={onEventClick}
                onMoreClick={() => onMoreClick?.(day)}
                use24h={use24h}
                compact={isCompact}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
