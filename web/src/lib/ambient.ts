"use client";

/**
 * Procedural ambient / "vibration" engine for focus sessions.
 * No downloads required — generated in the browser via Web Audio API.
 * Presets: brown noise, soft drone, rain, and a low pulse (vibration feel).
 */

export type AmbientId = "off" | "brown" | "drone" | "rain" | "pulse";

export const AMBIENT_PRESETS: Array<{ id: AmbientId; label: string; hint: string }> = [
  { id: "off", label: "Silent", hint: "No sound" },
  { id: "brown", label: "Brown noise", hint: "Deep steady hum" },
  { id: "drone", label: "Drone", hint: "Warm low tones" },
  { id: "rain", label: "Rain", hint: "Soft filtered rain" },
  { id: "pulse", label: "Pulse", hint: "Slow focus vibration" },
];

type Engine = {
  ctx: AudioContext;
  master: GainNode;
  nodes: AudioNode[];
  stoppers: Array<() => void>;
};

let engine: Engine | null = null;
let current: AmbientId = "off";

function ensure(): Engine {
  if (engine) return engine;
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  const master = ctx.createGain();
  master.gain.value = 0.35;
  master.connect(ctx.destination);
  engine = { ctx, master, nodes: [], stoppers: [] };
  return engine;
}

function clear() {
  if (!engine) return;
  for (const s of engine.stoppers) {
    try {
      s();
    } catch {
      /* ignore */
    }
  }
  for (const n of engine.nodes) {
    try {
      n.disconnect();
    } catch {
      /* ignore */
    }
  }
  engine.nodes = [];
  engine.stoppers = [];
}

function makeNoise(ctx: AudioContext, seconds = 2): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(1, len, rate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    // Brown-ish integration
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.5;
  }
  return buf;
}

function startBrown(e: Engine) {
  const src = e.ctx.createBufferSource();
  src.buffer = makeNoise(e.ctx, 3);
  src.loop = true;
  const filter = e.ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 280;
  const g = e.ctx.createGain();
  g.gain.value = 0.9;
  src.connect(filter);
  filter.connect(g);
  g.connect(e.master);
  src.start();
  e.nodes.push(src, filter, g);
  e.stoppers.push(() => {
    try {
      src.stop();
    } catch {
      /* ignore */
    }
  });
}

function startDrone(e: Engine) {
  const freqs = [55, 82.5, 110];
  for (const f of freqs) {
    const osc = e.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = f;
    const g = e.ctx.createGain();
    g.gain.value = 0.12;
    osc.connect(g);
    g.connect(e.master);
    osc.start();
    e.nodes.push(osc, g);
    e.stoppers.push(() => {
      try {
        osc.stop();
      } catch {
        /* ignore */
      }
    });
  }
}

function startRain(e: Engine) {
  const src = e.ctx.createBufferSource();
  src.buffer = makeNoise(e.ctx, 2);
  src.loop = true;
  const hp = e.ctx.createBiquadFilter();
  hp.type = "bandpass";
  hp.frequency.value = 1200;
  hp.Q.value = 0.6;
  const g = e.ctx.createGain();
  g.gain.value = 0.45;
  src.connect(hp);
  hp.connect(g);
  g.connect(e.master);
  src.start();
  e.nodes.push(src, hp, g);
  e.stoppers.push(() => {
    try {
      src.stop();
    } catch {
      /* ignore */
    }
  });
}

function startPulse(e: Engine) {
  // Slow "vibration" — low sine with amplitude envelope via LFO + offset oscillator
  const osc = e.ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = 48;
  const g = e.ctx.createGain();
  g.gain.value = 0.08;
  osc.connect(g);
  g.connect(e.master);
  osc.start();

  const lfo = e.ctx.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = 0.25;
  const lfoGain = e.ctx.createGain();
  lfoGain.gain.value = 0.1;
  lfo.connect(lfoGain);
  lfoGain.connect(g.gain);
  lfo.start();

  e.nodes.push(osc, g, lfo, lfoGain);
  e.stoppers.push(() => {
    try {
      osc.stop();
      lfo.stop();
    } catch {
      /* ignore */
    }
  });
}

export const ambientPlayer = {
  current(): AmbientId {
    return current;
  },

  async set(id: AmbientId) {
    const e = ensure();
    if (e.ctx.state === "suspended") await e.ctx.resume();
    clear();
    current = id;
    if (id === "off") return;
    if (id === "brown") startBrown(e);
    else if (id === "drone") startDrone(e);
    else if (id === "rain") startRain(e);
    else if (id === "pulse") startPulse(e);
  },

  setVolume(v: number) {
    const e = ensure();
    e.master.gain.value = Math.max(0, Math.min(1, v));
  },

  async stop() {
    clear();
    current = "off";
    if (engine && engine.ctx.state !== "closed") {
      try {
        await engine.ctx.suspend();
      } catch {
        /* ignore */
      }
    }
  },
};
