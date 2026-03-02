"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkTimesheetAccess = void 0;
const https_1 = require("firebase-functions/v2/https");
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
//# sourceMappingURL=index.js.map