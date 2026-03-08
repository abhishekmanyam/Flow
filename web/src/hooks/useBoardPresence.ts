import { useEffect, useState, useRef } from "react";
import {
  ref,
  set,
  remove,
  onValue,
  onDisconnect,
  serverTimestamp,
} from "firebase/database";
import { useAuthStore } from "@/store/auth";
import { rtdb } from "@/lib/firebase";
import type { BoardPresence } from "@/lib/types";

const HEARTBEAT_MS = 60_000;

function presencePath(wsId: string, projId: string) {
  return `presence/${wsId}/${projId}`;
}

function userPresencePath(wsId: string, projId: string, uid: string) {
  return `${presencePath(wsId, projId)}/${uid}`;
}

export function useBoardPresence(projectId: string | undefined): BoardPresence[] {
  const { workspace, user } = useAuthStore();
  const [presenceUsers, setPresenceUsers] = useState<BoardPresence[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!workspace || !user || !projectId) return;

    const wsId = workspace.id;
    const uid = user.uid;
    const displayName = user.displayName ?? user.email ?? "Unknown";
    const avatarUrl = user.photoURL ?? null;
    const userRef = ref(rtdb, userPresencePath(wsId, projectId, uid));

    const payload = () => ({
      userId: uid,
      displayName,
      avatarUrl,
      lastSeen: serverTimestamp(),
    });

    const writePresence = () => {
      if (document.visibilityState === "hidden") return;
      set(userRef, payload()).catch(() => {});
    };

    // Set up onDisconnect to auto-remove when connection drops
    onDisconnect(userRef).remove().catch(() => {});

    // Initial write
    writePresence();

    // Heartbeat (less frequent since onDisconnect handles cleanup)
    intervalRef.current = setInterval(writePresence, HEARTBEAT_MS);

    // Resume on tab focus
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        onDisconnect(userRef).remove().catch(() => {});
        writePresence();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Subscribe to all presence for this project board
    const boardRef = ref(rtdb, presencePath(wsId, projectId));
    const unsubscribe = onValue(boardRef, (snap) => {
      if (!snap.exists()) {
        setPresenceUsers([]);
        return;
      }
      const val = snap.val() as Record<string, BoardPresence>;
      setPresenceUsers(Object.values(val));
    });

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", onVisibility);
      unsubscribe();
      remove(userRef).catch(() => {});
    };
  }, [workspace?.id, user?.uid, projectId, user?.displayName, user?.photoURL]);

  return presenceUsers;
}
