import { isToday, format } from "date-fns";
import type { CalendarEvent } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";

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

interface CalendarDayCellProps {
  date: Date;
  events: CalendarEvent[];
  isCurrentMonth: boolean;
  isSelected: boolean;
  onClick: () => void;
  onEventClick?: (event: CalendarEvent) => void;
  onMoreClick?: () => void;
  use24h?: boolean;
  compact?: boolean;
}

export default function CalendarDayCell({
  date,
  events,
  isCurrentMonth,
  isSelected,
  onClick,
  onEventClick,
  onMoreClick,
  use24h = false,
  compact,
}: CalendarDayCellProps) {
  const today = isToday(date);
  const formatTime = (d: Date) => format(d, use24h ? "HH:mm" : "h:mm a");

  if (compact) {
    // Mini mode for year view — dots only
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex flex-col items-center gap-0.5 p-1 rounded transition-colors text-xs",
          "hover:bg-accent focus-visible:outline-none",
          !isCurrentMonth && "opacity-25 cursor-default",
          isCurrentMonth && "cursor-pointer",
          isSelected && "bg-accent ring-1 ring-primary/50",
          today && !isSelected && "bg-primary/5"
        )}
      >
        <span
          className={cn(
            "tabular-nums leading-none flex items-center justify-center rounded-full h-5 w-5 text-[10px]",
            today && "bg-primary text-primary-foreground font-semibold",
            !today && isCurrentMonth && "font-medium"
          )}
        >
          {format(date, "d")}
        </span>
        {events.length > 0 && (
          <div className="flex items-center gap-0.5">
            {events.slice(0, 3).map((event) => (
              <span
                key={event.id}
                className="size-1 rounded-full shrink-0"
                style={{ backgroundColor: event.color }}
              />
            ))}
            {events.length > 3 && (
              <span className="text-[7px] text-muted-foreground leading-none">
                +{events.length - 3}
              </span>
            )}
          </div>
        )}
      </button>
    );
  }

  // Full mode — event bars
  const maxVisible = 2;
  const visibleEvents = events.slice(0, maxVisible);
  const overflow = events.length - maxVisible;

  return (
    <div
      className={cn(
        "min-h-[130px] p-1.5 flex flex-col transition-colors",
        !isCurrentMonth && "bg-muted/20",
        isCurrentMonth && "cursor-pointer hover:bg-accent/50",
        isSelected && "bg-accent"
      )}
      onClick={onClick}
    >
      <div className="mb-1 ml-0.5">
        <span
          className={cn(
            "text-sm tabular-nums inline-flex items-center justify-center",
            today &&
              "bg-primary text-primary-foreground font-semibold h-7 w-7 rounded-full",
            !today && isCurrentMonth && "font-medium",
            !today && !isCurrentMonth && "text-muted-foreground"
          )}
        >
          {format(date, "d")}
        </span>
      </div>

      <div className="flex flex-col gap-1 flex-1 min-w-0">
        {visibleEvents.map((event) => (
          <button
            key={event.id}
            type="button"
            className="w-full text-left rounded-md px-2 py-1 text-[11px] text-white truncate"
            style={{ backgroundColor: event.color }}
            onClick={(e) => {
              e.stopPropagation();
              onEventClick?.(event);
            }}
          >
            <div className="font-medium truncate leading-tight">
              {event.title}
            </div>
            <div className="flex items-center gap-1 opacity-90 leading-tight">
              <Clock className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate">
                {event.allDay
                  ? "All day"
                  : `${formatTime(toDate(event.startDate))} - ${formatTime(toDate(event.endDate))}`}
              </span>
            </div>
          </button>
        ))}
        {overflow > 0 && (
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors text-left px-1 py-0.5 font-medium"
            onClick={(e) => {
              e.stopPropagation();
              onMoreClick?.();
            }}
          >
            + {overflow} more
          </button>
        )}
      </div>
    </div>
  );
}
