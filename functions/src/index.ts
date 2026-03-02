import { onCall, HttpsError } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

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
