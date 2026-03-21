/** Short vibration when timer completes (mobile). */
export function vibrateDone(): void {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    try {
      navigator.vibrate([120, 60, 120]);
    } catch {
      /* ignore */
    }
  }
}

/** Simple beep using Web Audio API. */
export function playBeep(): void {
  if (typeof window === "undefined") return;
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
    osc.onended = () => ctx.close();
  } catch {
    /* ignore */
  }
}

export function signalTimerEnd(): void {
  playBeep();
  vibrateDone();
}
