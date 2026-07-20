/**
 * Generate premium Fellowship Focus assets via Gemini image API.
 * Usage: node scripts/generate-assets.mjs
 * Loads GEMINI_API_KEY from .env.local or ../../autointact/scripts/.env
 */

import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const publicDir = path.join(root, "public", "assets");

dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, "../../autointact/scripts/.env") });
dotenv.config({ path: path.join(root, "../../.env") });

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY not found in .env.local or workspace .env files");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

const ASSETS = [
  {
    file: "hero.jpg",
    aspectRatio: "16:9",
    prompt:
      "Cinematic ultra-premium fantasy landscape, rolling green hills of an idyllic countryside at golden hour, distant snow-capped mountains and a glowing volcano on the horizon, misty atmospheric depth, oil painting meets photorealism, rich emerald and amber tones, no characters, no text, museum-quality epic wallpaper, 8k",
  },
  {
    file: "journey-map.jpg",
    aspectRatio: "16:9",
    prompt:
      "Premium illustrated fantasy quest map on aged parchment, winding golden path from cozy village through forests mines and white city to fiery mountain, elegant calligraphy style borders, deep greens golds and ember reds, top-down painterly cartography, no copyrighted names, luxury game UI art, no text labels",
  },
  {
    file: "focus-quest.jpg",
    aspectRatio: "1:1",
    prompt:
      "Premium abstract fantasy icon, glowing golden ring of power dissolving into particles of light over dark forest background, symbol of resisting temptation and deep focus, luxury app icon aesthetic, cinematic lighting, no text",
  },
  {
    file: "fellowship.jpg",
    aspectRatio: "1:1",
    prompt:
      "Silhouettes of nine fantasy travelers walking toward a distant mountain at sunset, epic fellowship journey, premium cinematic poster style, golden rim light, painterly, no faces visible, no text, luxury brand aesthetic",
  },
  {
    file: "rivendell.jpg",
    aspectRatio: "3:2",
    prompt:
      "Hidden elven sanctuary in a lush mountain valley, waterfalls, golden autumn trees, ethereal premium fantasy architecture, serene magical atmosphere, cinematic wide shot, no characters, no text, ultra detailed matte painting",
  },
  {
    file: "mount-doom.jpg",
    aspectRatio: "3:2",
    prompt:
      "Dark volcanic wasteland with rivers of lava and ash sky, imposing mountain with fire at peak, ominous premium fantasy landscape, cinematic dramatic lighting, no characters, no text, museum quality concept art",
  },
];

async function generateOne({ file, aspectRatio, prompt }) {
  const outPath = path.join(publicDir, file);
  if (fs.existsSync(outPath)) {
    console.log(`⏭  ${file} exists, skipping`);
    return;
  }

  console.log(`🎨 Generating ${file}...`);
  const models = ["gemini-2.5-flash-image", "gemini-2.0-flash-preview-image-generation"];

  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseModalities: ["IMAGE", "TEXT"],
          imageConfig: { aspectRatio },
        },
      });

      const parts = response.candidates?.[0]?.content?.parts ?? [];
      for (const part of parts) {
        if (part.inlineData?.data) {
          fs.writeFileSync(outPath, Buffer.from(part.inlineData.data, "base64"));
          console.log(`✅ ${file} saved (${model})`);
          return;
        }
      }
    } catch (err) {
      console.warn(`  ${model} failed: ${err.message?.slice(0, 80)}`);
    }
  }
  console.error(`❌ Failed to generate ${file}`);
}

async function main() {
  fs.mkdirSync(publicDir, { recursive: true });
  for (const asset of ASSETS) {
    await generateOne(asset);
    await new Promise((r) => setTimeout(r, 2000));
  }
  console.log("Done.");
}

main();
