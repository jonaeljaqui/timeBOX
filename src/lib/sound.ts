/**
 * Tiny synthesizer for in-app audio cues. No bundled assets — Web Audio API only.
 * Native OS notifications may be silenced/muted, so we play our own chime as a
 * reliable signal even when the app is focused.
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") {
    void ctx.resume();
  }
  return ctx;
}

function tone(
  freq: number,
  startOffset: number,
  durationSec: number,
  peakGain: number
) {
  const c = getCtx();
  const t0 = c.currentTime + startOffset;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, t0);

  // Quick attack, exponential decay — feels like a soft bell.
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peakGain, t0 + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durationSec);

  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + durationSec + 0.05);
}

/** Pleasant two-note bell played when a timebox completes. */
export function playCompleteChime() {
  try {
    tone(880, 0.0, 0.6, 0.18);     // A5
    tone(1318.5, 0.18, 0.7, 0.16); // E6
  } catch (e) {
    console.warn("chime failed", e);
  }
}

/** Softer single tone for overrun warnings (兔子洞 alert). */
export function playOverrunBeep() {
  try {
    tone(440, 0, 0.25, 0.1); // A4
  } catch (e) {
    console.warn("beep failed", e);
  }
}

/** Triumphant 4-note cadence for MIT completion — the daily "I won" signal. */
export function playMITFanfare() {
  try {
    tone(523.25, 0.0,  0.35, 0.16); // C5
    tone(659.25, 0.12, 0.35, 0.16); // E5
    tone(783.99, 0.24, 0.4,  0.18); // G5
    tone(1046.5, 0.36, 0.7,  0.2);  // C6
  } catch (e) {
    console.warn("fanfare failed", e);
  }
}
