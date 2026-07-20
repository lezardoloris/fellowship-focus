/**
 * Generate Windows app icon for Fellowship Focus via Gemini image API.
 * Usage: node scripts/generate-icon.mjs
 *
 * Loads GEMINI_API_KEY from:
 *   web/.env.local → ../../autointact/scripts/.env → ../../.env
 */

import { GoogleGenAI } from "@google/genai";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(__dirname, "..");
const desktopAssets = path.join(webRoot, "..", "desktop", "assets");
const publicAssets = path.join(webRoot, "public", "assets");

dotenv.config({ path: path.join(webRoot, ".env.local") });
dotenv.config({ path: path.join(webRoot, "../../autointact/scripts/.env") });
dotenv.config({ path: path.join(webRoot, "../../.env") });

// Prefer non-empty key; don't let empty .env.local wipe a valid key
const apiKey =
  process.env.GEMINI_API_KEY?.trim() ||
  (() => {
    for (const p of [
      path.join(webRoot, "../../autointact/scripts/.env"),
      path.join(webRoot, ".env.local"),
      path.join(webRoot, "../../.env"),
    ]) {
      if (!fs.existsSync(p)) continue;
      const m = fs.readFileSync(p, "utf8").match(/^GEMINI_API_KEY=(.+)$/m);
      const v = m?.[1]?.trim().replace(/^["']|["']$/g, "");
      if (v) return v;
    }
    return "";
  })();

if (!apiKey) {
  console.error("GEMINI_API_KEY not found");
  process.exit(1);
}
console.log(`Using Gemini key …${apiKey.slice(-6)}`);

const ai = new GoogleGenAI({ apiKey });

const PROMPT = `Premium Windows desktop application icon, square 1:1, centered composition.
A single elegant golden ring of power (simple circle, slight glow) floating over a deep forest-green and near-black background.
Subtle ember amber rim light, luxury productivity app aesthetic for "Fellowship Focus".
Clean silhouette that reads clearly at 16x16 and 256x256 pixels.
Flat-to-soft 3D icon style like modern Windows Store apps, soft rounded square safe area, no text, no letters, no watermark, no busy details, no characters, no map, museum-quality brand mark.`;

const MODELS = [
  "gemini-2.5-flash-image",
  "gemini-3-pro-image-preview",
  "gemini-2.5-flash-image-preview",
];

async function generatePng(outPath) {
  console.log("🎨 Generating app icon with Gemini...");
  for (const model of MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: PROMPT,
        config: {
          responseModalities: ["IMAGE", "TEXT"],
          imageConfig: { aspectRatio: "1:1" },
        },
      });
      const parts = response.candidates?.[0]?.content?.parts ?? [];
      for (const part of parts) {
        if (part.inlineData?.data) {
          fs.writeFileSync(outPath, Buffer.from(part.inlineData.data, "base64"));
          console.log(`✅ PNG saved via ${model}: ${outPath}`);
          return true;
        }
      }
      console.warn(`  ${model}: no image in response`);
    } catch (err) {
      console.warn(`  ${model} failed: ${err.message?.slice(0, 120)}`);
    }
  }
  return false;
}

function toIco(pngPath, icoPath) {
  const py = `
from PIL import Image
from pathlib import Path
src = Path(r"${pngPath.replace(/\\/g, "\\\\")}")
dst = Path(r"${icoPath.replace(/\\/g, "\\\\")}")
im = Image.open(src).convert("RGBA")
# Windows icon: soft square crop to center, multi-size ICO
w, h = im.size
side = min(w, h)
left = (w - side) // 2
top = (h - side) // 2
im = im.crop((left, top, left + side, top + side))
sizes = [(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)]
im.save(dst, format="ICO", sizes=sizes)
print(f"ICO {dst} ({dst.stat().st_size} bytes)")
`;
  execFileSync("python", ["-c", py], { stdio: "inherit" });
}

async function main() {
  fs.mkdirSync(desktopAssets, { recursive: true });
  fs.mkdirSync(publicAssets, { recursive: true });

  const pngDesktop = path.join(desktopAssets, "app-icon.png");
  const pngPublic = path.join(publicAssets, "app-icon.png");
  const icoDesktop = path.join(desktopAssets, "fellowship.ico");
  const jpgDesktop = path.join(desktopAssets, "fellowship.jpg");

  const ok = await generatePng(pngDesktop);
  if (!ok) {
    console.error("❌ Failed to generate icon");
    process.exit(1);
  }

  fs.copyFileSync(pngDesktop, pngPublic);
  // Also refresh fellowship.jpg used by tray/UI
  fs.copyFileSync(pngDesktop, jpgDesktop);
  fs.copyFileSync(pngDesktop, path.join(publicAssets, "fellowship.jpg"));

  console.log("🖼  Converting to multi-size Windows .ico...");
  toIco(pngDesktop, icoDesktop);
  fs.copyFileSync(icoDesktop, path.join(publicAssets, "fellowship.ico"));

  console.log("Done.");
  console.log(`  ${icoDesktop}`);
  console.log(`  ${pngDesktop}`);
}

main();
