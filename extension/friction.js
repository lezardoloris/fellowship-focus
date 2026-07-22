const params = new URLSearchParams(location.search);
const domain = params.get("d") || "this site";
document.getElementById("site").textContent = domain;

let secs = 8;
chrome.runtime.sendMessage({ type: "getPrefs" }, (res) => {
  if (res?.prefs?.friction_secs) secs = res.prefs.friction_secs;
  tick();
});

const countEl = document.getElementById("count");
const btn = document.getElementById("continue");
const hint = document.getElementById("hint");

function tick() {
  countEl.textContent = String(secs);
  if (secs <= 0) {
    btn.disabled = false;
    hint.textContent = "Ready — continue if you still need this site.";
    return;
  }
  secs -= 1;
  setTimeout(tick, 1000);
}

btn.addEventListener("click", () => {
  // Navigate to https://domain — user chose to proceed
  location.href = "https://" + domain.replace(/^https?:\/\//, "");
});

document.getElementById("back").addEventListener("click", () => {
  if (history.length > 1) history.back();
  else location.href = "about:blank";
});
