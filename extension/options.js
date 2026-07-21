const $ = (id) => document.getElementById(id);
let state = null;

function send(msg) {
  return new Promise((resolve) => chrome.runtime.sendMessage(msg, resolve));
}

function setMsg(text, ok = false) {
  const m = $("msg");
  m.textContent = text;
  m.style.color = ok ? "#6ee7b7" : "#fca5a5";
  if (text) setTimeout(() => (m.textContent = ""), 3000);
}

function render() {
  const cfg = state;
  if (!cfg) return;

  const connected = !!(cfg.apiUrl && cfg.token);
  const status = $("status");
  status.textContent = connected
    ? `Connected as ${cfg.name || "member"} · guild ${cfg.code}`
    : "Not connected. Blocking still works with your local list.";
  status.classList.toggle("ok", connected);

  const appLink = $("appLink");
  appLink.href = cfg.apiUrl ? `${cfg.apiUrl}/app${cfg.code ? `?code=${cfg.code}` : ""}` : "https://fellowship-focus-production.up.railway.app/app";

  $("count").textContent = `· ${cfg.sites.length} sites`;

  const list = $("list");
  list.innerHTML = "";
  if (!cfg.sites.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "No sites yet. Add one above.";
    list.appendChild(li);
  } else {
    for (const site of cfg.sites) {
      const li = document.createElement("li");
      const span = document.createElement("span");
      span.textContent = site;
      const del = document.createElement("button");
      del.textContent = "✕";
      del.title = `Remove ${site}`;
      del.addEventListener("click", async () => {
        state = (await send({ type: "removeSite", site })).config;
        render();
      });
      li.appendChild(span);
      li.appendChild(del);
      list.appendChild(li);
    }
  }
}

$("connect").addEventListener("click", async () => {
  const raw = $("payload").value.trim();
  if (!raw) return setMsg("Paste the code from the web app first.");
  try {
    JSON.parse(raw);
  } catch {
    return setMsg("That doesn't look like a valid connection code.");
  }
  const res = await send({ type: "connect", payload: raw });
  if (res?.config) {
    state = res.config;
    $("payload").value = "";
    setMsg("Connected and synced.", true);
    render();
  } else {
    setMsg("Could not connect.");
  }
});

$("refresh").addEventListener("click", async () => {
  state = (await send({ type: "refresh" })).config;
  setMsg("Synced.", true);
  render();
});

$("disconnect").addEventListener("click", async () => {
  state = (await send({ type: "disconnect" })).config;
  setMsg("Disconnected. Local list kept.", true);
  render();
});

$("addForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const site = $("site").value.trim();
  if (!site) return;
  state = (await send({ type: "addSite", site })).config;
  $("site").value = "";
  render();
});

(async () => {
  state = (await send({ type: "getState" }))?.config || null;
  render();
})();
