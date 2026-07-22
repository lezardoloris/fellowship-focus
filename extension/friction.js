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
  // Ask the worker for a temporary allow FIRST. Navigating without it just hits
  // the same block rule again, which looked like the page was broken.
  btn.disabled = true;
  hint.textContent = "Opening…";
  const target = "https://" + domain.replace(/^https?:\/\//, "");
  chrome.runtime.sendMessage({ type: "allowTemporarily", domain, secs: 120 }, () => {
    location.href = target;
  });
});

document.getElementById("back").addEventListener("click", () => {
  if (history.length > 1) history.back();
  else location.href = "about:blank";
});
