/** Persist background preference in localStorage. */

import { ALL_SCENE_IDS, type SceneId } from "@/lib/scenes";

export const BG_PREFS_KEY = "ff-bg-prefs";

export type BackgroundPrefs = {
  /** Single background for the whole app (does not change with tabs). */
  scene: SceneId;
};

export const DEFAULT_BG_PREFS: BackgroundPrefs = {
  scene: "fellowship",
};

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
    const scene =
      (parsed.scene && ALL_SCENE_IDS.includes(parsed.scene) && parsed.scene) ||
      (parsed.lockedScene && ALL_SCENE_IDS.includes(parsed.lockedScene) && parsed.lockedScene) ||
      DEFAULT_BG_PREFS.scene;
    return { scene };
  } catch {
    return DEFAULT_BG_PREFS;
  }
}

export function saveBackgroundPrefs(prefs: BackgroundPrefs) {
  localStorage.setItem(BG_PREFS_KEY, JSON.stringify(prefs));
}
