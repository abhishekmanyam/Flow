"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitEnrollment = exports.submitCampRegistration = exports.getCalendarICS = exports.autoClockOut = exports.checkTimesheetAccess = void 0;
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
/**
 * Public HTTPS endpoint for summer camp registrations submitted from the
 * AIR Kids marketing website. Writes to:
 *   workspaces/{CAMP_WORKSPACE_ID}/camp_registrations/{autoId}
 *
 * Set the target workspace via env var CAMP_WORKSPACE_ID before deploy:
 *   firebase functions:secrets:set CAMP_WORKSPACE_ID
 *   (or just an environment variable on the function)
 */
const ALLOWED_MONTHS = new Set(["June", "July", "August"]);
function isNonEmptyString(v) {
    return typeof v === "string" && v.trim().length > 0;
}
exports.submitCampRegistration = (0, https_1.onRequest)({ cors: true, invoker: "public" }, async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
    }
    const wsId = process.env.CAMP_WORKSPACE_ID;
    if (!wsId) {
        console.error("CAMP_WORKSPACE_ID env var is not set");
        res.status(500).json({ error: "Server misconfigured" });
        return;
    }
    const body = (req.body ?? {});
    const childName = body.childName;
    const childAgeRaw = body.childAge;
    const parentName = body.parentName;
    const parentEmail = body.parentEmail;
    const parentPhone = body.parentPhone;
    const sessionMonth = body.sessionMonth;
    const sessionDates = body.sessionDates;
    const notes = typeof body.notes === "string" ? body.notes.trim() : "";
    if (!isNonEmptyString(childName) ||
        !isNonEmptyString(parentName) ||
        !isNonEmptyString(parentEmail) ||
        !isNonEmptyString(parentPhone) ||
        !isNonEmptyString(sessionMonth) ||
        !isNonEmptyString(sessionDates)) {
        res.status(400).json({ error: "Missing required fields" });
        return;
    }
    if (childName.trim().length < 2 || childName.length > 80) {
        res.status(400).json({ error: "Invalid child name" });
        return;
    }
    if (parentName.trim().length < 2 || parentName.length > 80) {
        res.status(400).json({ error: "Invalid parent name" });
        return;
    }
    const childAge = typeof childAgeRaw === "number"
        ? childAgeRaw
        : parseInt(String(childAgeRaw), 10);
    if (!Number.isFinite(childAge) || childAge < 6 || childAge > 12) {
        res.status(400).json({ error: "Child age must be between 6 and 12" });
        return;
    }
    if (!ALLOWED_MONTHS.has(sessionMonth)) {
        res.status(400).json({ error: "Invalid session month" });
        return;
    }
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail.trim());
    if (!emailOk) {
        res.status(400).json({ error: "Invalid email" });
        return;
    }
    const phoneDigits = parentPhone.replace(/\D/g, "");
    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
        res.status(400).json({ error: "Phone must be a 10-digit US number" });
        return;
    }
    if (notes.length > 500) {
        res.status(400).json({ error: "Notes too long (max 500 chars)" });
        return;
    }
    try {
        const ref = db.collection(`workspaces/${wsId}/camp_registrations`).doc();
        await ref.set({
            childName: childName.trim(),
            childAge,
            parentName: parentName.trim(),
            parentEmail: parentEmail.trim().toLowerCase(),
            parentPhone: phoneDigits,
            sessionMonth,
            sessionDates,
            notes,
            status: "new",
            source: "airwebsite",
            createdAt: firestore_1.Timestamp.now(),
        });
        res.status(200).json({ ok: true, id: ref.id });
    }
    catch (err) {
        console.error("submitCampRegistration error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});
/**
 * Public HTTPS endpoint for year-round enrollment inquiries from the AIR Kids
 * marketing website. Writes to:
 *   workspaces/{CAMP_WORKSPACE_ID}/enrollments/{autoId}
 */
const ALLOWED_PLANS = new Set(["explorer", "innovator", "visionary"]);
exports.submitEnrollment = (0, https_1.onRequest)({ cors: true, invoker: "public" }, async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
    }
    const wsId = process.env.CAMP_WORKSPACE_ID;
    if (!wsId) {
        console.error("CAMP_WORKSPACE_ID env var is not set");
        res.status(500).json({ error: "Server misconfigured" });
        return;
    }
    const body = (req.body ?? {});
    const childName = body.childName;
    const childAgeRaw = body.childAge;
    const parentName = body.parentName;
    const parentEmail = body.parentEmail;
    const parentPhone = body.parentPhone;
    const plan = body.plan;
    const notes = typeof body.notes === "string" ? body.notes.trim() : "";
    if (!isNonEmptyString(childName) ||
        !isNonEmptyString(parentName) ||
        !isNonEmptyString(parentEmail) ||
        !isNonEmptyString(parentPhone) ||
        !isNonEmptyString(plan)) {
        res.status(400).json({ error: "Missing required fields" });
        return;
    }
    if (childName.trim().length < 2 || childName.length > 80) {
        res.status(400).json({ error: "Invalid child name" });
        return;
    }
    if (parentName.trim().length < 2 || parentName.length > 80) {
        res.status(400).json({ error: "Invalid parent name" });
        return;
    }
    const childAge = typeof childAgeRaw === "number"
        ? childAgeRaw
        : parseInt(String(childAgeRaw), 10);
    if (!Number.isFinite(childAge) || childAge < 4 || childAge > 18) {
        res.status(400).json({ error: "Invalid child age" });
        return;
    }
    if (!ALLOWED_PLANS.has(plan)) {
        res.status(400).json({ error: "Invalid plan" });
        return;
    }
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail.trim());
    if (!emailOk) {
        res.status(400).json({ error: "Invalid email" });
        return;
    }
    const phoneDigits = parentPhone.replace(/\D/g, "");
    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
        res.status(400).json({ error: "Phone must be a 10-digit US number" });
        return;
    }
    if (notes.length > 500) {
        res.status(400).json({ error: "Notes too long (max 500 chars)" });
        return;
    }
    try {
        const ref = db.collection(`workspaces/${wsId}/enrollments`).doc();
        await ref.set({
            childName: childName.trim(),
            childAge,
            parentName: parentName.trim(),
            parentEmail: parentEmail.trim().toLowerCase(),
            parentPhone: phoneDigits,
            plan,
            notes,
            status: "new",
            source: "airwebsite",
            createdAt: firestore_1.Timestamp.now(),
        });
        res.status(200).json({ ok: true, id: ref.id });
    }
    catch (err) {
        console.error("submitEnrollment error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});
//# sourceMappingURL=index.js.map