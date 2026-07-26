/**
 * Generate the Chrome Web Store screenshots (1280x800) without loading the
 * extension: stage a copy of extension/, inject a chrome.* mock with a demo
 * state, then screenshot the pages with headless Chrome.
 *
 * Output: extension/store/screenshots/01-block-page.png
 *                                     02-popup-focus.png
 *                                     03-friction.png
 *
 * Usage (from anywhere): node web/scripts/shots-store.mjs
 */
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const extDir = path.resolve(here, "../../extension");
const outDir = path.join(extDir, "store", "screenshots");

const CHROME_CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  path.join(process.env.LOCALAPPDATA || "", "Google\\Chrome\\Application\\chrome.exe"),
];
const chrome = CHROME_CANDIDATES.find((p) => p && existsSync(p));
if (!chrome) {
  console.error("Chrome not found. Install Chrome or add its path to CHROME_CANDIDATES.");
  process.exit(1);
}

/* The pages call chrome.runtime.*; outside an extension that API does not
   exist, so the staged copies get this mock injected before their scripts.
   The state below is the demo the store screenshots show. */
const MOCK = `
// Store-screenshot mock: replaces chrome.* with canned demo data.
Math.random = () => 0.1; // deterministic backdrop + persona
window.chrome = {
  runtime: {
    lastError: undefined,
    getURL: (p) => p,
    openOptionsPage: () => {},
    sendMessage: (msg, cb) => {
      const config = {
        name: "Aragorn",
        code: "fellowship-rohan",
        apiUrl: "https://fellowship-focus-production.up.railway.app",
        manualShield: true,
        focus: { phase: "focus", cycle: 2, endsAt: Date.now() + 17 * 60 * 1000 + 42500 },
        prefs: { cycles: 3, focus_min: 50, persona: "random", friction_secs: 8 },
        sites: Array.from({ length: 24 }, (_, i) => "site" + i + ".example"),
        stats: { blocks: 12, focusMinutes: 96 },
      };
      if (cb) setTimeout(() => cb({ config, prefs: config.prefs }), 0);
    },
  },
  permissions: { request: (_o, cb) => cb && cb(true) },
};
`;

const SHOTS = [
  { file: "block.html", query: "?d=youtube.com", out: "01-block-page.png" },
  { file: "popup.html", query: "", out: "02-popup-focus.png", framed: true },
  { file: "friction.html", query: "?d=instagram.com", out: "03-friction.png" },
];

const stage = mkdtempSync(path.join(os.tmpdir(), "ff-shots-"));
try {
  cpSync(extDir, stage, {
    recursive: true,
    filter: (src) => !src.includes(`${path.sep}store${path.sep}`) && !src.endsWith(".pem"),
  });
  writeFileSync(path.join(stage, "mock-chrome.js"), MOCK);

  for (const shot of SHOTS) {
    const p = path.join(stage, shot.file);
    const html = readFileSync(p, "utf8").replace(
      /<script /,
      '<script src="mock-chrome.js"></script><script '
    );
    writeFileSync(p, html);
  }

  /* The popup is a ~360px surface; screenshotted raw it would be a stamp in
     the corner of a 1280x800 frame. Showcase it centered on the panel tone. */
  writeFileSync(
    path.join(stage, "popup-frame.html"),
    `<!DOCTYPE html><html><head><style>
      html,body{margin:0;height:100%;background:#0c0e10;display:flex;align-items:center;justify-content:center}
      iframe{width:380px;height:560px;border:1px solid #2a2d31;border-radius:6px;background:#16171a}
    </style></head><body><iframe src="popup.html"></iframe></body></html>`
  );

  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  for (const shot of SHOTS) {
    const page = shot.framed ? "popup-frame.html" : shot.file + shot.query;
    const url = "file:///" + path.join(stage, page).replace(/\\/g, "/");
    const out = path.join(outDir, shot.out);
    execFileSync(chrome, [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--allow-file-access-from-files",
      "--window-size=1280,800",
      "--virtual-time-budget=5000",
      `--screenshot=${out}`,
      url,
    ]);
    console.log(`Shot: ${out}`);
  }
} finally {
  rmSync(stage, { recursive: true, force: true });
}
console.log("\nUpload these under 'Screenshots' in the Web Store listing (1280x800).");
