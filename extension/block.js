const params = new URLSearchParams(location.search);
const domain = params.get("d") || "";

document.getElementById("site").textContent = domain || "this site";

// HD backdrops shipped with the extension; one is picked per block so the page
// never looks like the same dead end twice.
const SCENES = [
  "images/cliff-haven.jpg",
  "images/bridge-fire.jpg",
  "images/argons-guardians.jpg",
  "images/forest-sentinel.jpeg",
  "images/scene-mist.jpeg",
  "images/scene-dusk.jpeg",
];

function renderScene() {
  const url = chrome.runtime.getURL(SCENES[Math.floor(Math.random() * SCENES.length)]);
  const el = document.getElementById("scene");
  // Preload so the image never fades in half-drawn behind the text.
  const img = new Image();
  img.onload = () => {
    el.style.backgroundImage = `url("${url}")`;
  };
  img.src = url;
}

function renderPersona(prefs) {
  const persona = pickPersona(prefs && prefs.persona);
  if (!persona) return;
  document.getElementById("quote-text").textContent = pickLine(persona);
  document.getElementById("quote-name").textContent = persona.name;
  document.getElementById("quote-title").textContent = persona.title;
}

renderScene();

// Tell the background to count + log this block, and pull dashboard link.
chrome.runtime.sendMessage({ type: "reportBlock", domain }, () => void chrome.runtime.lastError);

chrome.runtime.sendMessage({ type: "getState" }, (res) => {
  if (chrome.runtime.lastError || !res?.config) {
    renderPersona(null);
    return;
  }
  const cfg = res.config;
  renderPersona(cfg.prefs);

  const appLink = document.getElementById("app");
  if (cfg.apiUrl && cfg.code) {
    appLink.href = `${cfg.apiUrl}/app?code=${cfg.code}`;
  } else {
    appLink.style.display = "none";
  }

  const note = document.getElementById("note");
  if (cfg.focus) {
    note.textContent = `Focus cycle ${cfg.focus.cycle}/${cfg.prefs.cycles}`;
  } else if (cfg.stats?.blocks) {
    note.textContent = `${cfg.stats.blocks} deflected today`;
  }
});

document.getElementById("back").addEventListener("click", () => {
  if (history.length > 1) history.back();
  else location.href = "about:blank";
});
