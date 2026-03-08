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

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface CalendarGridProps {
  events: CalendarEvent[];
  currentMonth: Date;
  selectedDate: Date | null;
  onDayClick: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
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
  variant = "full",
}: CalendarGridProps) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const isCompact = variant === "compact";

  return (
    <div className="w-full">
      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map((label) => (
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
      <div className="grid grid-cols-7 gap-px rounded-lg bg-border overflow-hidden">
        {days.map((day) => {
          const dayEvents = getEventsForDay(events, day);

          return (
            <div key={day.toISOString()} className="bg-background">
              <CalendarDayCell
                date={day}
                events={dayEvents}
                isCurrentMonth={isSameMonth(day, currentMonth)}
                isSelected={
                  selectedDate ? isSameDay(day, selectedDate) : false
                }
                onClick={() => onDayClick(day)}
                compact={isCompact}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
