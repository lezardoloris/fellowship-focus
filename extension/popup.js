const els = {
  who: document.getElementById("who"),
  shieldToggle: document.getElementById("shieldToggle"),
  shieldHint: document.getElementById("shieldHint"),
  timer: document.getElementById("timer"),
  phase: document.getElementById("phase"),
  focusBtn: document.getElementById("focusBtn"),
  blocks: document.getElementById("blocks"),
  focusMin: document.getElementById("focusMin"),
  siteCount: document.getElementById("siteCount"),
  dash: document.getElementById("dash"),
  opts: document.getElementById("opts"),
  scanHistory: document.getElementById("scanHistory"),
};

let state = null;
let ticker = null;

function send(msg) {
  return new Promise((resolve) => chrome.runtime.sendMessage(msg, resolve));
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function render() {
  const cfg = state;
  if (!cfg) return;

  els.who.textContent = cfg.name
    ? `${cfg.name} · ${cfg.code}`
    : "Not connected — open Settings";

  const shieldOn = cfg.manualShield || !!cfg.focus;
  els.shieldToggle.setAttribute("aria-checked", String(shieldOn));
  els.shieldToggle.disabled = !!cfg.focus;
  els.shieldHint.textContent = cfg.focus
    ? "Locked on during focus"
    : shieldOn
      ? `${cfg.sites.length} sites blocked`
      : "Block distracting sites";

  els.blocks.textContent = cfg.stats?.blocks ?? 0;
  els.focusMin.textContent = `${cfg.stats?.focusMinutes ?? 0}m`;
  els.siteCount.textContent = cfg.sites?.length ?? 0;

  els.dash.style.display = cfg.apiUrl && cfg.code ? "block" : "none";
  els.dash.href = cfg.apiUrl && cfg.code ? `${cfg.apiUrl}/app?code=${cfg.code}` : "#";

  if (cfg.focus) {
    els.focusBtn.textContent = "Stop";
    els.focusBtn.classList.add("stop");
    els.phase.textContent = cfg.focus.phase === "break" ? "Break" : `Focus ${cfg.focus.cycle}/${cfg.prefs.cycles}`;
    startTicker();
  } else {
    els.focusBtn.textContent = "Start focus";
    els.focusBtn.classList.remove("stop");
    els.phase.textContent = "Ready";
    els.timer.textContent = `${pad(cfg.prefs.focus_min)}:00`;
    stopTicker();
  }
}

function startTicker() {
  stopTicker();
  const tick = () => {
    if (!state?.focus) return stopTicker();
    const ms = state.focus.endsAt - Date.now();
    const s = Math.max(0, Math.round(ms / 1000));
    els.timer.textContent = `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
    if (ms <= 0) refresh();
  };
  tick();
  ticker = setInterval(tick, 1000);
}

function stopTicker() {
  if (ticker) clearInterval(ticker);
  ticker = null;
}

async function refresh() {
  const res = await send({ type: "getState" });
  state = res?.config || null;
  render();
}

els.shieldToggle.addEventListener("click", async () => {
  if (state?.focus) return;
  const res = await send({ type: "setShield", on: !state.manualShield });
  state = res.config;
  render();
});

els.focusBtn.addEventListener("click", async () => {
  const res = await send({ type: state?.focus ? "stopFocus" : "startFocus" });
  state = res.config;
  render();
});

els.opts.addEventListener("click", () => chrome.runtime.openOptionsPage());

els.scanHistory?.addEventListener("click", async () => {
  els.scanHistory.disabled = true;
  // history is an optional permission — request it here where the click is a
  // genuine user gesture (the background can only check, not request).
  const granted = await new Promise((res) => {
    try {
      chrome.permissions.request({ permissions: ["history"] }, (ok) => res(!!ok));
    } catch {
      res(false);
    }
  });
  if (!granted) {
    els.scanHistory.textContent = "Permission needed";
    setTimeout(() => {
      els.scanHistory.disabled = false;
      els.scanHistory.textContent = "Scan history";
    }, 2500);
    return;
  }
  els.scanHistory.textContent = "Scanning…";
  const res = await send({ type: "analyzeHistory", days: 30 });
  const n = res?.suggestions?.length || 0;
  const added = [];
  for (const s of res?.suggestions || []) {
    if (s.score >= 25 && state && !state.sites.includes(s.domain)) {
      await send({ type: "addSite", site: s.domain });
      added.push(s.domain);
    }
  }
  await refresh();
  els.scanHistory.textContent =
    added.length > 0 ? `+${added.length} sites` : n ? `${n} found` : "No distractors";
  setTimeout(() => {
    els.scanHistory.disabled = false;
    els.scanHistory.textContent = "Scan history";
  }, 2500);
});

refresh();
