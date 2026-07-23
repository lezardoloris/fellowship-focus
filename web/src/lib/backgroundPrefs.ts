/** Persist background preference in localStorage. */

import { ALL_SCENE_IDS, canonicalSceneId, type SceneId } from "@/lib/scenes";

export const BG_PREFS_KEY = "ff-bg-prefs";

export type BackgroundQuality = "high" | "balanced" | "still";

export type BackgroundPrefs = {
  /** Single background for the whole app (does not change with tabs). */
  scene: SceneId;
  /**
   * high — full HD loop, preload=auto
   * balanced — same loop, lighter preload (metadata) — default
   * still — poster only (no video)
   */
  quality: BackgroundQuality;
};

export const DEFAULT_BG_PREFS: BackgroundPrefs = {
  scene: "fellowship",
  quality: "balanced",
};

const QUALITIES: BackgroundQuality[] = ["high", "balanced", "still"];

export function isBackgroundQuality(v: unknown): v is BackgroundQuality {
  return typeof v === "string" && (QUALITIES as string[]).includes(v);
}

export function loadBackgroundPrefs(): BackgroundPrefs {
  if (typeof window === "undefined") return DEFAULT_BG_PREFS;
  try {
    const raw = localStorage.getItem(BG_PREFS_KEY);
    if (!raw) return DEFAULT_BG_PREFS;
    const parsed = JSON.parse(raw) as Partial<BackgroundPrefs> & {
      /** legacy fields */
      mode?: string;
      lockedScene?: SceneId;
    };
    const rawScene =
      (parsed.scene && ALL_SCENE_IDS.includes(parsed.scene) && parsed.scene) ||
      (parsed.lockedScene && ALL_SCENE_IDS.includes(parsed.lockedScene) && parsed.lockedScene) ||
      DEFAULT_BG_PREFS.scene;
    const quality = isBackgroundQuality(parsed.quality) ? parsed.quality : DEFAULT_BG_PREFS.quality;
    return { scene: canonicalSceneId(rawScene), quality };
  } catch {
    return DEFAULT_BG_PREFS;
  }
}

export function saveBackgroundPrefs(prefs: BackgroundPrefs) {
  localStorage.setItem(
    BG_PREFS_KEY,
    JSON.stringify({
      scene: canonicalSceneId(prefs.scene),
      quality: isBackgroundQuality(prefs.quality) ? prefs.quality : DEFAULT_BG_PREFS.quality,
    })
  );
}
