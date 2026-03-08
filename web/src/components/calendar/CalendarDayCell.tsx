import { isToday, format } from "date-fns";
import type { CalendarEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

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
  compact,
}: CalendarDayCellProps) {
  const today = isToday(date);

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

  // Full mode — compact event bars (title only)
  const maxVisible = 3;
  const visibleEvents = events.slice(0, maxVisible);
  const overflow = events.length - maxVisible;

  return (
    <div
      className={cn(
        "min-h-[120px] p-1.5 flex flex-col transition-colors",
        !isCurrentMonth && "bg-muted/30",
        isCurrentMonth && "cursor-pointer hover:bg-accent/40",
        isSelected && "bg-accent"
      )}
      onClick={onClick}
    >
      <div className="mb-1 ml-0.5">
        <span
          className={cn(
            "text-xs tabular-nums inline-flex items-center justify-center",
            today &&
              "bg-primary text-primary-foreground font-semibold h-6 w-6 rounded-full",
            !today && isCurrentMonth && "font-medium",
            !today && !isCurrentMonth && "text-muted-foreground/60"
          )}
        >
          {format(date, "d")}
        </span>
      </div>

      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
        {visibleEvents.map((event) => (
          <button
            key={event.id}
            type="button"
            className="w-full text-left rounded px-1.5 py-0.5 text-[11px] font-medium truncate text-white/90 hover:text-white transition-colors"
            style={{ backgroundColor: event.color }}
            onClick={(e) => {
              e.stopPropagation();
              onEventClick?.(event);
            }}
          >
            {event.title}
          </button>
        ))}
        {overflow > 0 && (
          <button
            type="button"
            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors text-left px-1.5 font-medium"
            onClick={(e) => {
              e.stopPropagation();
              onMoreClick?.();
            }}
          >
            +{overflow} more
          </button>
        )}
      </div>
    </div>
  );
}
