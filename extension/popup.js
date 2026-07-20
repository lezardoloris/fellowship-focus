const timerEl = document.getElementById("timer");
const statusEl = document.getElementById("status");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const durationEl = document.getElementById("duration");
const apiUrlEl = document.getElementById("apiUrl");
const tokenEl = document.getElementById("token");
const saveSetupBtn = document.getElementById("saveSetup");
const setupEl = document.getElementById("setup");
const timerSection = document.getElementById("timer-section");
const errorEl = document.getElementById("error");

let tickInterval = null;

async function init() {
  const data = await chrome.storage.local.get([
    "apiUrl",
    "token",
    "sessionActive",
    "endTime",
    "durationMinutes",
  ]);

  if (data.apiUrl) apiUrlEl.value = data.apiUrl;
  if (data.token) tokenEl.value = data.token;

  if (data.token && data.apiUrl) {
    setupEl.style.display = "none";
    timerSection.style.display = "block";
  }

  if (data.sessionActive && data.endTime) {
    startTicking(data.endTime, data.durationMinutes);
    startBtn.disabled = true;
    stopBtn.disabled = false;
    durationEl.disabled = true;
    timerEl.classList.add("active");
    statusEl.textContent = "Quest in progress — sites blocked";
  }
}

saveSetupBtn.addEventListener("click", async () => {
  const apiUrl = apiUrlEl.value.trim().replace(/\/$/, "");
  const token = tokenEl.value.trim();
  if (!apiUrl || !token) {
    errorEl.textContent = "API URL and token required";
    return;
  }
  await chrome.storage.local.set({ apiUrl, token });
  setupEl.style.display = "none";
  timerSection.style.display = "block";
  errorEl.textContent = "";
});

startBtn.addEventListener("click", async () => {
  const minutes = parseInt(durationEl.value, 10);
  const endTime = Date.now() + minutes * 60 * 1000;

  await chrome.storage.local.set({
    sessionActive: true,
    endTime,
    durationMinutes: minutes,
  });

  chrome.runtime.sendMessage({ type: "ENABLE_BLOCKING" });
  chrome.alarms.create("focus-timer", { periodInMinutes: 0.5 });
  chrome.action.setBadgeText({ text: "🔥" });
  chrome.action.setBadgeBackgroundColor({ color: "#c9a227" });

  startBtn.disabled = true;
  stopBtn.disabled = false;
  durationEl.disabled = true;
  timerEl.classList.add("active");
  statusEl.textContent = "Quest in progress — sites blocked";
  startTicking(endTime, minutes);
});

stopBtn.addEventListener("click", async () => {
  const data = await chrome.storage.local.get(["endTime", "durationMinutes"]);
  const totalMs = data.durationMinutes * 60 * 1000;
  const elapsed = totalMs - (data.endTime - Date.now());
  const minutes = Math.max(1, Math.round(elapsed / 60000));

  chrome.runtime.sendMessage({
    type: "COMPLETE_SESSION",
    minutes,
    completed: false,
  });

  resetUI();
  statusEl.textContent = "Quest abandoned";
});

function startTicking(endTime, totalMinutes) {
  if (tickInterval) clearInterval(tickInterval);

  function tick() {
    const remaining = endTime - Date.now();
    if (remaining <= 0) {
      timerEl.textContent = "00:00";
      chrome.runtime.sendMessage({
        type: "COMPLETE_SESSION",
        minutes: totalMinutes,
        completed: true,
      });
      resetUI();
      statusEl.textContent = "Quest complete! +XP earned";
      return;
    }
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    timerEl.textContent = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  tick();
  tickInterval = setInterval(tick, 1000);
}

function resetUI() {
  if (tickInterval) clearInterval(tickInterval);
  timerEl.classList.remove("active");
  timerEl.textContent = "25:00";
  startBtn.disabled = false;
  stopBtn.disabled = true;
  durationEl.disabled = false;
  chrome.alarms.clear("focus-timer");
}

init();
