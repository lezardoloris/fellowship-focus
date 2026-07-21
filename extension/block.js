const params = new URLSearchParams(location.search);
const domain = params.get("d") || "";

document.getElementById("site").textContent = domain || "this site";

// Tell the background to count + log this block, and pull dashboard link.
chrome.runtime.sendMessage({ type: "reportBlock", domain }, () => void chrome.runtime.lastError);

chrome.runtime.sendMessage({ type: "getState" }, (res) => {
  if (chrome.runtime.lastError || !res?.config) return;
  const cfg = res.config;
  const appLink = document.getElementById("app");
  if (cfg.apiUrl && cfg.code) {
    appLink.href = `${cfg.apiUrl}/app?code=${cfg.code}`;
  } else {
    appLink.style.display = "none";
  }
  const note = document.getElementById("note");
  if (cfg.focus) {
    note.textContent = `Focus cycle ${cfg.focus.cycle}/${cfg.prefs.cycles} in progress — stay the course.`;
  } else if (cfg.stats?.blocks) {
    note.textContent = `${cfg.stats.blocks} distraction${cfg.stats.blocks > 1 ? "s" : ""} deflected today.`;
  }
});

document.getElementById("back").addEventListener("click", () => {
  if (history.length > 1) history.back();
  else location.href = "about:blank";
});
