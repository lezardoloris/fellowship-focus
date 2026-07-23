/**
 * Premium end-of-focus chime — warm monastic bell stack (Web Audio).
 * Heritage / ember tone: low fundamental + soft overtones, not a UI beep.
 */

function clampVol(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** One resonant “bell” strike: decaying partials at golden-ish ratios. */
function strikeBell(
  ctx: AudioContext,
  master: GainNode,
  at: number,
  freqs: number[],
  peak: number,
  decaySec: number
) {
  for (let i = 0; i < freqs.length; i++) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = i === 0 ? "sine" : "triangle";
    osc.frequency.setValueAtTime(freqs[i], at);
    // Slight downward glide — like a struck bowl settling
    osc.frequency.exponentialRampToValueAtTime(freqs[i] * 0.985, at + decaySec * 0.85);

    const amp = peak * (i === 0 ? 1 : 0.28 / i);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, amp), at + 0.018);
    g.gain.exponentialRampToValueAtTime(0.0001, at + decaySec);

    osc.connect(g);
    g.connect(master);
    osc.start(at);
    osc.stop(at + decaySec + 0.05);
  }
}

/**
 * Play the focus-end chime.
 * @param durationSec how long to keep repeating soft strikes (−1 = until stopped)
 * @param volume 0–1 (0 = mute)
 * @returns stop function
 */
export function playAlarm(durationSec: number, volume = 0.5): () => void {
  if (typeof window === "undefined") return () => {};
  const vol = clampVol(volume);
  if (vol <= 0.001) return () => {};

  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  const master = ctx.createGain();
  master.gain.value = vol * 0.85;
  // Soft low-pass so it feels like a hall, not a phone
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 2400;
  filter.Q.value = 0.7;
  master.connect(filter);
  filter.connect(ctx.destination);

  let stopped = false;
  const infinite = durationSec < 0;
  const endAt = infinite
    ? Number.POSITIVE_INFINITY
    : ctx.currentTime + Math.max(0.8, durationSec);

  // Ember / monastic partials (Hz) — C3-ish fundamental with warm overtones
  const bowl = [130.81, 196.0, 261.63, 392.0];
  const higher = [164.81, 246.94, 329.63];

  function chime(at: number, variant: 0 | 1) {
    if (stopped || at > endAt) return;
    const freqs = variant === 0 ? bowl : higher;
    const peak = variant === 0 ? 0.42 : 0.28;
    const decay = variant === 0 ? 2.4 : 1.8;
    strikeBell(ctx, master, at, freqs, peak, decay);
  }

  const start = ctx.currentTime + 0.02;
  // Opening double-strike (call + answer), then spaced echoes
  chime(start, 0);
  chime(start + 0.55, 1);

  const interval = 3.2;
  let loopId: ReturnType<typeof setInterval> | null = null;
  if (infinite) {
    let n = 0;
    loopId = setInterval(() => {
      if (stopped) {
        if (loopId != null) clearInterval(loopId);
        return;
      }
      chime(ctx.currentTime + 0.02, (n % 2 === 0 ? 0 : 1) as 0 | 1);
      n += 1;
    }, interval * 1000);
  } else {
    const count = Math.max(0, Math.ceil((Math.max(0, durationSec) - 1.2) / interval));
    for (let i = 0; i < count; i++) {
      const t = start + 1.4 + i * interval;
      if (t > endAt) break;
      chime(t, (i % 2 === 0 ? 0 : 1) as 0 | 1);
    }
  }

  void ctx.resume();

  return () => {
    stopped = true;
    if (loopId != null) clearInterval(loopId);
    try {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
      master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
    } catch {
      /* ignore */
    }
    window.setTimeout(() => {
      void ctx.close();
    }, 180);
  };
}
