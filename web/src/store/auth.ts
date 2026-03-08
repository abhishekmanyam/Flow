import { create } from "zustand";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getUserWorkspace } from "@/lib/firestore";
import type { Workspace, Role } from "@/lib/types";

type AuthState = {
  user: User | null;
  workspace: Workspace | null;
  role: Role | null;
  loading: boolean;
  initialized: boolean;

  signIn: (email: string, password: string) => Promise<string>;
  signUp: (email: string, password: string) => Promise<string>;
  signOut: () => Promise<void>;
  setWorkspace: (ws: Workspace, role: Role) => void;
  refreshWorkspace: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  workspace: null,
  role: null,
  loading: false,
  initialized: false,

  signIn: async (email, password) => {
    set({ loading: true });
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      return cred.user.uid;
    } finally {
      set({ loading: false });
    }
  },

  signUp: async (email, password) => {
    set({ loading: true });
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      return cred.user.uid;
    } finally {
      set({ loading: false });
    }
  },

  signOut: async () => {
    await signOut(auth);
    set({ user: null, workspace: null, role: null });
  },

  setWorkspace: (workspace, role) => set({ workspace, role }),

  refreshWorkspace: async () => {
    const { user } = get();
    if (!user) return;
    const result = await getUserWorkspace(user.uid);
    if (result) {
      set({ workspace: result.workspace, role: result.role });
    }
  },
}));

// Bootstrap auth listener once (advanced-init-once rule)
let unsubscribed = false;
export function initAuthListener() {
  if (unsubscribed) return;
  unsubscribed = true;

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        const result = await getUserWorkspace(user.uid);
        if (result) {
          useAuthStore.setState({
            user,
            workspace: result.workspace,
            role: result.role,
            initialized: true,
          });
        } else {
          useAuthStore.setState({ user, initialized: true });
        }
      } catch (err) {
        console.error("[auth] getUserWorkspace failed:", err);
        useAuthStore.setState({ user, initialized: true });
      }
    } else {
      useAuthStore.setState({ user: null, workspace: null, role: null, initialized: true });
    }
  });
}
