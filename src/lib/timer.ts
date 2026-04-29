import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";
import type { TimerSnapshot } from "./types";

export async function timerStart(input: {
  timebox_id: number;
  title: string;
  category: string | null;
  planned_minutes: number;
}): Promise<TimerSnapshot> {
  return invoke<TimerSnapshot>("timer_start", input);
}

export async function timerStop(): Promise<void> {
  return invoke("timer_stop");
}

export async function timerGet(): Promise<TimerSnapshot | null> {
  return invoke<TimerSnapshot | null>("timer_get");
}

/** Subscribe to live timer state. */
export function useActiveTimer(): {
  snap: TimerSnapshot | null;
  loaded: boolean;
} {
  const [snap, setSnap] = useState<TimerSnapshot | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let unsubTick: (() => void) | null = null;
    let unsubStop: (() => void) | null = null;
    let cancelled = false;

    (async () => {
      const initial = await timerGet();
      if (cancelled) return;
      setSnap(initial);
      setLoaded(true);

      unsubTick = await listen<TimerSnapshot>("timer:tick", (e) => {
        setSnap(e.payload);
      });
      unsubStop = await listen("timer:stopped", () => {
        setSnap(null);
      });
    })();

    return () => {
      cancelled = true;
      unsubTick?.();
      unsubStop?.();
    };
  }, []);

  return { snap, loaded };
}

/** Subscribe to the one-shot completion event. */
export function useTimerComplete(handler: (snap: TimerSnapshot) => void) {
  useEffect(() => {
    let unsub: (() => void) | null = null;
    (async () => {
      unsub = await listen<TimerSnapshot>("timer:complete", (e) => {
        handler(e.payload);
      });
    })();
    return () => {
      unsub?.();
    };
  }, [handler]);
}
