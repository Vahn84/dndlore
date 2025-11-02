
import React from 'react';

export type AutoSaveOptions = {
  /** Inactivity window (ms) after the last change before sending a trailing save. Default: 5000 */
  idleMs?: number;
  /** Save immediately on the first change of a burst. Default: true */
  immediateFirst?: boolean;
  /** Disable autosave entirely. */
  disabled?: boolean;
};

/**
 * Burst-based autosave:
 * - On the *first* change of a burst: optionally save immediately (immediateFirst=true).
 * - Then start (or reset) an inactivity timer.
 * - If no further changes happen for `idleMs`, send ONE trailing save.
 * - During an active burst, further changes do NOT trigger more saves; they only reset the timer.
 * - If a save is in-flight and more changes arrive, queue exactly one follow-up save after it finishes,
 *   and re-arm the inactivity timer to continue batching.
 */
export function useAutoSave<T>(
  data: T,
  saveFn: (d: T) => Promise<any> | void,
  options?: number | AutoSaveOptions,
) {
  const opts: AutoSaveOptions = typeof options === 'number' ? { idleMs: options } : (options || {});
  const idleMs = opts.idleMs ?? 5000;
  const immediateFirst = opts.immediateFirst ?? true;
  const disabled = opts.disabled ?? false;

  const [isSaving, setIsSaving] = React.useState(false);
  const [lastSavedAt, setLastSavedAt] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Refs for stable state across renders
  const dataRef = React.useRef<T>(data);
  const lastSeenSnapshotRef = React.useRef<string>(JSON.stringify(data));
  const savedSnapshotRef = React.useRef<string>(JSON.stringify(data));

  const windowTimerRef = React.useRef<number | null>(null);
  const windowActiveRef = React.useRef<boolean>(false);
  const savingRef = React.useRef<boolean>(false);
  const queuedRef = React.useRef<boolean>(false);

  React.useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // Helper: clear the inactivity timer
  const clearTimer = React.useCallback(() => {
    if (windowTimerRef.current != null) {
      window.clearTimeout(windowTimerRef.current);
      windowTimerRef.current = null;
    }
  }, []);

  // saveNow implemented via ref to avoid stale closures in timers
  const saveNowRef = React.useRef<() => Promise<void>>(async () => {});

  // (Re)start the inactivity window; when it elapses, do a trailing save (if needed)
  const scheduleWindow = React.useCallback(() => {
    if (disabled) return;
    clearTimer();
    windowActiveRef.current = true;
    windowTimerRef.current = window.setTimeout(async () => {
      windowTimerRef.current = null;
      await saveNowRef.current();
      // Burst ended; close the window. Next change starts a new burst.
      windowActiveRef.current = false;
    }, idleMs);
  }, [clearTimer, disabled, idleMs]);

  // Define the actual save behavior
  React.useEffect(() => {
    saveNowRef.current = async () => {
      if (disabled) return;
      const snapshot = lastSeenSnapshotRef.current;
      // Skip if nothing changed since the last successful save
      if (snapshot === savedSnapshotRef.current) return;

      if (savingRef.current) {
        queuedRef.current = true; // request one follow-up save once current finishes
        return;
      }

      try {
        savingRef.current = true;
        setIsSaving(true);
        setError(null);
        await Promise.resolve(saveFn(dataRef.current));
        savedSnapshotRef.current = snapshot; // mark these changes as saved
        setLastSavedAt(Date.now());
      } catch (e: any) {
        setError(e?.message || 'Autosave failed');
      } finally {
        savingRef.current = false;
        setIsSaving(false);
        if (queuedRef.current) {
          queuedRef.current = false;
          // Re-arm the inactivity window so we can accumulate more edits after the in-flight save
          scheduleWindow();
        }
      }
    };
  }, [disabled, saveFn, scheduleWindow]);

  // Main change detector: triggers window start/reset and optional immediate-first save
  React.useEffect(() => {
    if (disabled) return;

    const snapshot = JSON.stringify(data);
    if (snapshot === lastSeenSnapshotRef.current) return; // no new change

    lastSeenSnapshotRef.current = snapshot; // record latest change

    // If no burst active, this is the *first* change of a new burst
    if (!windowActiveRef.current) {
      windowActiveRef.current = true;
      if (immediateFirst) {
        // Immediate save once at burst start (e.g., structure/format changes)
        saveNowRef.current();
      }
    }

    // In all cases, (re)start the inactivity timer to batch changes
    scheduleWindow();
  }, [data, disabled, immediateFirst, scheduleWindow]);

  // Flush on unmount if unsaved changes remain
  React.useEffect(() => {
    return () => {
      clearTimer();
      const snapshot = lastSeenSnapshotRef.current;
      if (!disabled && snapshot !== savedSnapshotRef.current) {
        try {
          const maybe = saveFn(dataRef.current);
          if (maybe && typeof (maybe as any).then === 'function') {
            (maybe as Promise<any>).catch(() => {});
          }
        } catch {}
      }
    };
  }, [clearTimer, disabled, saveFn]);

  return { isSaving, lastSavedAt, error } as const;
}

export default useAutoSave;
