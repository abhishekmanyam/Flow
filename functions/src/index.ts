import { onCall, HttpsError } from "firebase-functions/v2/https";
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
