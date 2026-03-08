import { isToday, format } from "date-fns";
import type { CalendarEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

interface CalendarDayCellProps {
  date: Date;
  events: CalendarEvent[];
  isCurrentMonth: boolean;
  isSelected: boolean;
  onClick: () => void;
  compact?: boolean;
}

export default function CalendarDayCell({
  date,
  events,
  isCurrentMonth,
  isSelected,
  onClick,
  compact,
}: CalendarDayCellProps) {
  const today = isToday(date);
  const maxDots = compact ? 3 : 4;
  const visibleEvents = events.slice(0, maxDots);
  const overflow = events.length - maxDots;

  return (
    <button
      type="button"
      disabled={!isCurrentMonth}
      onClick={onClick}
      className={cn(
        "flex flex-col items-center rounded-lg transition-colors relative",
        compact ? "gap-0.5 p-1.5 text-xs" : "gap-1 p-2 text-sm",
        "hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        !isCurrentMonth && "opacity-25 cursor-default",
        isCurrentMonth && "cursor-pointer",
        isSelected && "bg-accent ring-1 ring-primary/50",
        today && !isSelected && "bg-primary/5"
      )}
    >
      <span
        className={cn(
          "tabular-nums leading-none flex items-center justify-center rounded-full",
          compact ? "h-6 w-6 text-xs" : "h-7 w-7 text-sm",
          today && "bg-primary text-primary-foreground font-semibold",
          !today && isCurrentMonth && "font-medium"
        )}
      >
        {format(date, "d")}
      </span>

      {events.length > 0 && (
        <div className="flex items-center gap-0.5">
          {visibleEvents.map((event) => (
            <span
              key={event.id}
              className={cn(
                "rounded-full shrink-0",
                compact ? "size-1" : "size-1.5"
              )}
              style={{ backgroundColor: event.color }}
            />
          ))}
          {overflow > 0 && (
            <span
              className={cn(
                "leading-none text-muted-foreground",
                compact ? "text-[8px]" : "text-[10px]"
              )}
            >
              +{overflow}
            </span>
          )}
        </div>
      )}
    </button>
  );
}
