/**
 * Generate compact guild-directory card illustrations via Gemini image API.
 *
 * Usage (from web/):
 *   npm run generate-guild-illustrations
 *   node scripts/generate-guild-illustrations.mjs
 *   node scripts/generate-guild-illustrations.mjs --force   # overwrite existing
 *
 * Loads GEMINI_API_KEY from (first non-empty):
 *   process.env
 *   web/.env.local
 *   web/.env
 *   ../../trustexits/.env
 *   ../../autointact/scripts/.env
 *   ../../.env
 *
 * Writes PNGs to web/public/assets/guilds/ — paths match GUILD_ILLUSTRATIONS in src/lib/assets.ts.
 * Existing files are skipped unless --force is passed (useful after fixing Gemini quota/billing).
 */

import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(__dirname, "..");
const outDir = path.join(webRoot, "public", "assets", "guilds");
const outDesktop = path.join(webRoot, "..", "desktop", "assets", "guilds");
const force = process.argv.includes("--force") || process.env.FORCE === "1";

const ENV_CANDIDATES = [
  path.join(webRoot, ".env.local"),
  path.join(webRoot, ".env"),
  path.join(webRoot, "../../trustexits/.env"),
  path.join(webRoot, "../../autointact/scripts/.env"),
  path.join(webRoot, "../../.env"),
];

for (const p of ENV_CANDIDATES) {
  dotenv.config({ path: p });
}

function readKeyFromFile(filePath) {
  if (!fs.existsSync(filePath)) return "";
  const m = fs.readFileSync(filePath, "utf8").match(/^GEMINI_API_KEY=(.+)$/m);
  return m?.[1]?.trim().replace(/^["']|["']$/g, "") || "";
}

const apiKey =
  process.env.GEMINI_API_KEY?.trim() ||
  ENV_CANDIDATES.map(readKeyFromFile).find(Boolean) ||
  "";

if (!apiKey) {
  console.error("GEMINI_API_KEY not found. Set it in web/.env.local or a workspace .env.");
  process.exit(1);
}
console.log(`Using Gemini key …${apiKey.slice(-6)}`);

const ai = new GoogleGenAI({ apiKey });

const STYLE = `Compact square illustration for a dark productivity app card corner.
Heritage dark UI: deep charcoal, muted burgundy #8b3a2e, soft ember, cool stone gray — NOT bright gold RPG chrome, NOT cartoon sticker spam, NOT glossy game UI badges.
Painterly muted matte, soft atmospheric light, minimal composition that reads at ~120px, generous negative space toward edges, no text, no letters, no watermark, no logos, no characters with faces.`;

/** Filenames must match GUILD_ILLUSTRATIONS in src/lib/assets.ts */
const GUILDS = [
  {
    file: "students.png",
    label: "Rohan Study Hall",
    prompt: `${STYLE}
Theme: deep study / students (Rohan Study Hall).
A quiet open book and a single hourglass or clock face on a dark desk, soft warm lamp glow, sense of protected focus time and OKR-style progress without charts. Calm scholarly mood.`,
  },
  {
    file: "builders.png",
    label: "The Shire Builders",
    prompt: `${STYLE}
Theme: shipping / building (The Shire Builders).
A small workshop still life: chisels, wooden blocks, a finished tiny house frame or tool, soft green hillside light in background haze. Craftsmanship and “ship one thing” energy, understated.`,
  },
  {
    file: "fitness.png",
    label: "Fellowship of Sweat",
    prompt: `${STYLE}
Theme: fitness / steps (Fellowship of Sweat).
Abstract athletic still life: running shoes and a subtle step/path motif or coiled resistance band on dark stone, cool mist, disciplined training mood. No gym neon, no cartoon muscles.`,
  },
  {
    file: "deep-work.png",
    label: "Mordor Deep Work",
    prompt: `${STYLE}
Theme: long focus / deep work (Mordor Deep Work).
A solitary dark mountain silhouette with a thin river of ember light, ash sky, fortress of concentration. Ominous but elegant — long uninterrupted focus, not horror gore.`,
  },
  {
    file: "accountability.png",
    label: "Council of Accountability",
    prompt: `${STYLE}
Theme: accountability / check-ins (Council of Accountability).
A round stone table with a few blank sealed scrolls or simple markers arranged in a circle, torch-like soft rim light, peer commitment without fantasy excess. Serious council mood.`,
  },
  {
    file: "creators.png",
    label: "Gondor Creators",
    prompt: `${STYLE}
Theme: creation streak (Gondor Creators).
An elegant white-city tower silhouette at dusk with a quill, brush, or notebook glowing faintly — daily create-before-entertainment ritual. Refined, architectural, creative.`,
  },
];

const MODELS = [
  "gemini-2.5-flash-image",
  "gemini-3-pro-image-preview",
  "gemini-2.5-flash-image-preview",
  "gemini-2.0-flash-preview-image-generation",
];

async function generateOne({ file, label, prompt }) {
  const outPath = path.join(outDir, file);
  if (fs.existsSync(outPath) && !force) {
    console.log(`⏭  ${file} (${label}) exists, skipping (use --force to overwrite)`);
    return true;
  }

  console.log(`🎨 Generating ${file} — ${label}...`);
  for (const model of MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseModalities: ["IMAGE", "TEXT"],
          imageConfig: { aspectRatio: "1:1" },
        },
      });
      const parts = response.candidates?.[0]?.content?.parts ?? [];
      for (const part of parts) {
        if (part.inlineData?.data) {
          const buf = Buffer.from(part.inlineData.data, "base64");
          fs.writeFileSync(outPath, buf);
          fs.mkdirSync(outDesktop, { recursive: true });
          fs.copyFileSync(outPath, path.join(outDesktop, file));
          console.log(`✅ ${file} saved (${model})`);
          return true;
        }
      }
      console.warn(`  ${model}: no image in response`);
    } catch (err) {
      console.warn(`  ${model} failed: ${err.message?.slice(0, 120)}`);
    }
  }
  console.error(`❌ Failed to generate ${file}`);
  return false;
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(outDesktop, { recursive: true });
  let ok = 0;
  for (const guild of GUILDS) {
    const success = await generateOne(guild);
    if (success) {
      ok += 1;
      const src = path.join(outDir, guild.file);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(outDesktop, guild.file));
      }
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  console.log(`Done. ${ok}/${GUILDS.length} illustrations in ${outDir}`);
  console.log(`Mirrored to ${outDesktop}`);
  if (ok < GUILDS.length) process.exit(1);
}

main();
