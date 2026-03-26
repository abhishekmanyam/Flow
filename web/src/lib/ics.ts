import type { CalendarEvent } from "./types";

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

function formatICSDate(date: Date, allDay: boolean): string {
  if (allDay) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}${m}${d}`;
  }
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeICS(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function rruleFreq(type: string): string {
  switch (type) {
    case "daily": return "DAILY";
    case "weekly": return "WEEKLY";
    case "monthly": return "MONTHLY";
    default: return "WEEKLY";
  }
}

export function generateICS(
  events: CalendarEvent[],
  calendarName: string
): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FlowTask//Calendar//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escapeICS(calendarName)}`,
  ];

  for (const event of events) {
    const start = toDate(event.startDate);
    const end = toDate(event.endDate);
    const dtPrefix = event.allDay ? "VALUE=DATE:" : "";

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${event.id}@flowtask`);
    lines.push(`DTSTART;${dtPrefix}${formatICSDate(start, event.allDay)}`);
    lines.push(`DTEND;${dtPrefix}${formatICSDate(end, event.allDay)}`);
    lines.push(`SUMMARY:${escapeICS(event.title)}`);

    if (event.description) {
      lines.push(`DESCRIPTION:${escapeICS(event.description)}`);
    }
    if (event.location) {
      lines.push(`LOCATION:${escapeICS(event.location)}`);
    }
    lines.push(`CATEGORIES:${event.category.toUpperCase()}`);

    if (event.isOptional) {
      lines.push("TRANSP:TRANSPARENT");
    } else {
      lines.push("TRANSP:OPAQUE");
    }

    // Recurrence
    if (event.isRepeating && event.repeatingType) {
      let rrule = `RRULE:FREQ=${rruleFreq(event.repeatingType)}`;
      if (event.repeatingEndDate) {
        const until = toDate(event.repeatingEndDate);
        rrule += `;UNTIL=${formatICSDate(until, false)}`;
      }
      lines.push(rrule);

      // Excluded dates
      if (event.excludedDates?.length) {
        const exdates = event.excludedDates
          .map((d) => formatICSDate(toDate(d), event.allDay))
          .join(",");
        lines.push(`EXDATE${event.allDay ? ";VALUE=DATE" : ""}:${exdates}`);
      }
    }

    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadICS(events: CalendarEvent[], calendarName: string) {
  const ics = generateICS(events, calendarName);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${calendarName.replace(/\s+/g, "_")}_calendar.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
