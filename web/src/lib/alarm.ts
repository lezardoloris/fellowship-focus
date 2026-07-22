/** Short alarm beep — used when a focus/break timer ends. */

export function playAlarm(durationSec: number, volume = 0.5): () => void {
  if (typeof window === "undefined") return () => {};
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  const master = ctx.createGain();
  master.gain.value = Math.max(0, Math.min(1, volume));
  master.connect(ctx.destination);

  let stopped = false;
  const beeps: OscillatorNode[] = [];
  const endAt = durationSec < 0 ? Number.POSITIVE_INFINITY : ctx.currentTime + durationSec;

  function beep(at: number) {
    if (stopped || at > endAt) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.5, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.35);
    osc.connect(g);
    g.connect(master);
    osc.start(at);
    osc.stop(at + 0.4);
    beeps.push(osc);
  }

  // Pattern: beep every 0.7s
  const start = ctx.currentTime + 0.01;
  const count = durationSec < 0 ? 40 : Math.max(1, Math.ceil(durationSec / 0.7));
  for (let i = 0; i < count; i++) {
    const t = start + i * 0.7;
    if (durationSec >= 0 && t > endAt) break;
    beep(t);
  }

  void ctx.resume();

  return () => {
    stopped = true;
    for (const o of beeps) {
      try {
        o.stop();
      } catch {
        /* ignore */
      }
    }
    void ctx.close();
  };
}
