import { useEffect } from "react";
import { useToast } from "@astryxdesign/core/Toast";
import type { ShowToastFn, ToastOptions } from "@astryxdesign/core/Toast";

/**
 * Imperative toast helper backed by Astryx `useToast`.
 *
 * Astryx exposes toasts through the `useToast()` hook, but call sites across the
 * app need a module-level imperative API (`toast.success('...')`) usable inside
 * async handlers where hooks cannot be called. `ToastBridge` (mounted once in
 * main.tsx inside <Theme>) captures the hook's `showToast` function into a
 * module-level ref; the `toast.*` functions call through it.
 *
 * Call-site contract (module-level imperative API):
 *   import { toast } from "@/components/system/toast";
 *   toast.success("Saved");
 *   toast.error("Something went wrong");
 *   toast.info("Heads up");
 *
 * Note: Astryx Toast only ships two visual types — `info` and `error`. There is
 * no dedicated success color, so `toast.success` renders as an `info` toast.
 */

let showToast: ShowToastFn | null = null;
const queue: ToastOptions[] = [];

function emit(options: ToastOptions) {
  if (showToast) {
    showToast(options);
  } else {
    // Bridge not mounted yet (e.g. a toast fired during first render) — queue it.
    queue.push(options);
  }
}

/** Registers the live `showToast` fn and flushes any queued toasts. */
export function registerToast(fn: ShowToastFn) {
  showToast = fn;
  while (queue.length) {
    const next = queue.shift();
    if (next) fn(next);
  }
}

/**
 * Mounted once inside <Theme> in main.tsx. Renders nothing; its only job is to
 * bind the Astryx toast hook to the module-level imperative API above.
 */
export function ToastBridge(): null {
  const show = useToast();
  useEffect(() => {
    registerToast(show);
  }, [show]);
  return null;
}

export const toast = {
  success(message: string) {
    emit({ body: message, type: "info" });
  },
  error(message: string) {
    emit({ body: message, type: "error" });
  },
  info(message: string) {
    emit({ body: message, type: "info" });
  },
};
