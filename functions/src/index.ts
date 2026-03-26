import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

initializeApp();
const db = getFirestore();

/**
 * Checks whether the caller's IP is allowed for timesheet access.
 *
 * Expects: { workspaceId: string }
 * Returns: { allowed: boolean, ip: string }
 *
 * - Reads `allowedTimesheetIp` from the workspace doc.
 * - If no restriction is set (null/empty), returns allowed: true.
 * - Otherwise compares caller's IP against the stored value.
 */
export const checkTimesheetAccess = onCall({ cors: true, invoker: "public" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be signed in");
  }

  const { workspaceId } = request.data as { workspaceId?: string };
  if (!workspaceId) {
    throw new HttpsError("invalid-argument", "workspaceId is required");
  }

  // Verify caller is a member of this workspace
  const memberSnap = await db
    .doc(`workspaces/${workspaceId}/members/${request.auth.uid}`)
    .get();
  if (!memberSnap.exists) {
    throw new HttpsError("permission-denied", "Not a workspace member");
  }

  const wsSnap = await db.doc(`workspaces/${workspaceId}`).get();
  if (!wsSnap.exists) {
    throw new HttpsError("not-found", "Workspace not found");
  }

  const allowedIp = wsSnap.data()?.allowedTimesheetIp as string | null;
  const callerIp = request.rawRequest.ip ?? "";

  if (!allowedIp) {
    return { allowed: true, ip: callerIp };
  }

  return { allowed: callerIp === allowedIp, ip: callerIp };
});

/**
 * Auto clock-out: runs every 30 minutes.
 * Finds all active attendance entries (clockOut == null) older than 8 hours
 * and closes them with totalHours capped at 8h.
 */
const MAX_CLOCK_HOURS = 8;

export const autoClockOut = onSchedule("every 30 minutes", async () => {
  const cutoff = Timestamp.fromDate(
    new Date(Date.now() - MAX_CLOCK_HOURS * 60 * 60 * 1000)
  );

  // Query all active clock entries across all workspaces where clockIn is older than 8h
  const staleSnap = await db
    .collectionGroup("attendance")
    .where("clockOut", "==", null)
    .where("clockIn", "<=", cutoff)
    .get();

  if (staleSnap.empty) {
    console.log("autoClockOut: no stale entries found");
    return;
  }

  console.log(`autoClockOut: closing ${staleSnap.size} stale entries`);

  const batch = db.batch();
  for (const doc of staleSnap.docs) {
    const data = doc.data();
    const clockInTime = (data.clockIn as Timestamp).toDate();
    const breakMinutes = (data.breakMinutes as number) ?? 0;
    const totalHours = Math.max(
      0,
      MAX_CLOCK_HOURS - breakMinutes / 60
    );
    // Set clockOut to exactly 8h after clockIn
    const clockOutTime = new Date(
      clockInTime.getTime() + MAX_CLOCK_HOURS * 60 * 60 * 1000
    );

    batch.update(doc.ref, {
      clockOut: Timestamp.fromDate(clockOutTime),
      totalHours: Math.round(totalHours * 100) / 100,
      autoClockOut: true,
      updatedAt: Timestamp.now(),
    });
  }

  await batch.commit();
  console.log(`autoClockOut: committed ${staleSnap.size} updates`);
});

// ─── ICS Calendar Feed ────────────────────────────────────────────────────────

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

export const getCalendarICS = onRequest({ cors: true }, async (req, res) => {
  const workspaceId = req.query.workspaceId as string;
  if (!workspaceId) {
    res.status(400).send("workspaceId is required");
    return;
  }

  try {
    const snap = await db
      .collection(`workspaces/${workspaceId}/calendar_events`)
      .where("isPublic", "==", true)
      .get();

    const wsSnap = await db.doc(`workspaces/${workspaceId}`).get();
    const calendarName = wsSnap.exists
      ? (wsSnap.data()?.name as string) + " Calendar"
      : "Calendar";

    const lines: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//FlowTask//Calendar//EN",
      "CALSCALE:GREGORIAN",
      `X-WR-CALNAME:${escapeICS(calendarName)}`,
    ];

    for (const doc of snap.docs) {
      const event = doc.data();
      const start = (event.startDate as Timestamp).toDate();
      const end = (event.endDate as Timestamp).toDate();
      const allDay = event.allDay as boolean;
      const dtPrefix = allDay ? "VALUE=DATE:" : "";

      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${doc.id}@flowtask`);
      lines.push(`DTSTART;${dtPrefix}${formatICSDate(start, allDay)}`);
      lines.push(`DTEND;${dtPrefix}${formatICSDate(end, allDay)}`);
      lines.push(`SUMMARY:${escapeICS(event.title as string)}`);

      if (event.description) {
        lines.push(`DESCRIPTION:${escapeICS(event.description as string)}`);
      }
      if (event.location) {
        lines.push(`LOCATION:${escapeICS(event.location as string)}`);
      }
      lines.push(`CATEGORIES:${(event.category as string).toUpperCase()}`);

      if (event.isOptional) {
        lines.push("TRANSP:TRANSPARENT");
      } else {
        lines.push("TRANSP:OPAQUE");
      }

      if (event.isRepeating && event.repeatingType) {
        const freqMap: Record<string, string> = {
          daily: "DAILY",
          weekly: "WEEKLY",
          monthly: "MONTHLY",
        };
        let rrule = `RRULE:FREQ=${freqMap[event.repeatingType as string] ?? "WEEKLY"}`;
        if (event.repeatingEndDate) {
          const until = (event.repeatingEndDate as Timestamp).toDate();
          rrule += `;UNTIL=${formatICSDate(until, false)}`;
        }
        lines.push(rrule);

        if (event.excludedDates && (event.excludedDates as Timestamp[]).length > 0) {
          const exdates = (event.excludedDates as Timestamp[])
            .map((d) => formatICSDate(d.toDate(), allDay))
            .join(",");
          lines.push(`EXDATE${allDay ? ";VALUE=DATE" : ""}:${exdates}`);
        }
      }

      lines.push("END:VEVENT");
    }

    lines.push("END:VCALENDAR");

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${calendarName.replace(/\s+/g, "_")}.ics"`);
    res.status(200).send(lines.join("\r\n"));
  } catch (err) {
    console.error("getCalendarICS error:", err);
    res.status(500).send("Internal server error");
  }
});
