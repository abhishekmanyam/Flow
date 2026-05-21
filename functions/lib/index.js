"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCalendarICS = exports.autoClockOut = exports.checkTimesheetAccess = void 0;
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
(0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
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
exports.checkTimesheetAccess = (0, https_1.onCall)({ cors: true, invoker: "public" }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    }
    const { workspaceId } = request.data;
    if (!workspaceId) {
        throw new https_1.HttpsError("invalid-argument", "workspaceId is required");
    }
    // Verify caller is a member of this workspace
    const memberSnap = await db
        .doc(`workspaces/${workspaceId}/members/${request.auth.uid}`)
        .get();
    if (!memberSnap.exists) {
        throw new https_1.HttpsError("permission-denied", "Not a workspace member");
    }
    const wsSnap = await db.doc(`workspaces/${workspaceId}`).get();
    if (!wsSnap.exists) {
        throw new https_1.HttpsError("not-found", "Workspace not found");
    }
    const allowedIp = wsSnap.data()?.allowedTimesheetIp;
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
exports.autoClockOut = (0, scheduler_1.onSchedule)("every 30 minutes", async () => {
    const cutoff = firestore_1.Timestamp.fromDate(new Date(Date.now() - MAX_CLOCK_HOURS * 60 * 60 * 1000));
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
        const clockInTime = data.clockIn.toDate();
        const breakMinutes = data.breakMinutes ?? 0;
        const totalHours = Math.max(0, MAX_CLOCK_HOURS - breakMinutes / 60);
        // Set clockOut to exactly 8h after clockIn
        const clockOutTime = new Date(clockInTime.getTime() + MAX_CLOCK_HOURS * 60 * 60 * 1000);
        batch.update(doc.ref, {
            clockOut: firestore_1.Timestamp.fromDate(clockOutTime),
            totalHours: Math.round(totalHours * 100) / 100,
            autoClockOut: true,
            updatedAt: firestore_1.Timestamp.now(),
        });
    }
    await batch.commit();
    console.log(`autoClockOut: committed ${staleSnap.size} updates`);
});
// ─── ICS Calendar Feed ────────────────────────────────────────────────────────
function formatICSDate(date, allDay) {
    if (allDay) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const d = String(date.getDate()).padStart(2, "0");
        return `${y}${m}${d}`;
    }
    return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}
function escapeICS(str) {
    return str.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}
exports.getCalendarICS = (0, https_1.onRequest)({ cors: true, invoker: "public" }, async (req, res) => {
    const workspaceId = req.query.workspaceId;
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
            ? wsSnap.data()?.name + " Calendar"
            : "Calendar";
        const lines = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//FlowTask//Calendar//EN",
            "CALSCALE:GREGORIAN",
            `X-WR-CALNAME:${escapeICS(calendarName)}`,
        ];
        for (const doc of snap.docs) {
            const event = doc.data();
            const start = event.startDate.toDate();
            const end = event.endDate.toDate();
            const allDay = event.allDay;
            lines.push("BEGIN:VEVENT");
            lines.push(`UID:${doc.id}@flowtask`);
            if (allDay) {
                lines.push(`DTSTART;VALUE=DATE:${formatICSDate(start, true)}`);
                lines.push(`DTEND;VALUE=DATE:${formatICSDate(end, true)}`);
            }
            else {
                lines.push(`DTSTART:${formatICSDate(start, false)}`);
                lines.push(`DTEND:${formatICSDate(end, false)}`);
            }
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
            }
            else {
                lines.push("TRANSP:OPAQUE");
            }
            if (event.isRepeating && event.repeatingType) {
                const freqMap = {
                    daily: "DAILY",
                    weekly: "WEEKLY",
                    monthly: "MONTHLY",
                };
                let rrule = `RRULE:FREQ=${freqMap[event.repeatingType] ?? "WEEKLY"}`;
                if (event.repeatingEndDate) {
                    const until = event.repeatingEndDate.toDate();
                    rrule += `;UNTIL=${formatICSDate(until, false)}`;
                }
                lines.push(rrule);
                if (event.excludedDates && event.excludedDates.length > 0) {
                    const exdates = event.excludedDates
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
    }
    catch (err) {
        console.error("getCalendarICS error:", err);
        res.status(500).send("Internal server error");
    }
});
//# sourceMappingURL=index.js.map