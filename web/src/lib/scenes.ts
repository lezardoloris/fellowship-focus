/** HD immersive scenes — looping video backgrounds from Documents/BLOCKER. */

export type SceneId =
  | "fellowship"
  | "haven"
  | "mordor"
  | "fire"
  | "map"
  | "guardians"
  | "sentinel"
  | "mist"
  | "gold"
  | "dusk"
  | "ember"
  | "path";

export type Scene = {
  id: SceneId;
  /** Optimized 1080p H.264 loop (muted). */
  video: string | null;
  /** Sharp still shown instantly / for reduced-motion. */
  poster: string;
  label: string;
};

export const SCENES: Record<SceneId, Scene> = {
  fellowship: {
    id: "fellowship",
    video: "/scenes/loop-ridge.mp4",
    poster: "/scenes/loop-ridge-poster.jpg",
    label: "The Fellowship",
  },
  haven: {
    id: "haven",
    video: "/scenes/loop-path.mp4",
    poster: "/scenes/loop-path-poster.jpg",
    label: "Cliff Haven",
  },
  mordor: {
    id: "mordor",
    video: "/scenes/loop-ember.mp4",
    poster: "/scenes/loop-ember-poster.jpg",
    label: "Mordor Watch",
  },
  fire: {
    id: "fire",
    video: "/scenes/loop-fire.mp4",
    poster: "/scenes/loop-fire-poster.jpg",
    label: "Bridge of Fire",
  },
  map: {
    id: "map",
    // Static map reads clearer for Guild; no matching loop in BLOCKER.
    video: null,
    poster: "/scenes/middle-earth-map.jpeg",
    label: "Middle-earth",
  },
  guardians: {
    id: "guardians",
    video: "/scenes/loop-dawn.mp4",
    poster: "/scenes/loop-dawn-poster.jpg",
    label: "The Guardians",
  },
  sentinel: {
    id: "sentinel",
    video: "/scenes/loop-mist.mp4",
    poster: "/scenes/loop-mist-poster.jpg",
    label: "Forest Sentinel",
  },
  mist: {
    id: "mist",
    video: "/scenes/loop-mist.mp4",
    poster: "/scenes/loop-mist-poster.jpg",
    label: "Mist",
  },
  gold: {
    id: "gold",
    video: "/scenes/loop-ridge.mp4",
    poster: "/scenes/loop-ridge-poster.jpg",
    label: "Gold Hour",
  },
  dusk: {
    id: "dusk",
    video: "/scenes/loop-dawn.mp4",
    poster: "/scenes/loop-dawn-poster.jpg",
    label: "Dusk",
  },
  ember: {
    id: "ember",
    video: "/scenes/loop-ember.mp4",
    poster: "/scenes/loop-ember-poster.jpg",
    label: "Ember",
  },
  path: {
    id: "path",
    video: "/scenes/loop-path.mp4",
    poster: "/scenes/loop-path-poster.jpg",
    label: "The Path",
  },
};

/** Default scene per /app tab */
export const TAB_SCENE: Record<"block" | "focus" | "guild", SceneId> = {
  block: "mordor",
  focus: "fellowship",
  guild: "guardians",
};

export const LANDING_SCENE: SceneId = "fellowship";
export const DOWNLOAD_SCENE: SceneId = "haven";
export const BLOCKED_SCENE: SceneId = "fire";

export const ALL_SCENE_IDS = Object.keys(SCENES) as SceneId[];

/**
 * One picker entry per unique loop file. Alias IDs (gold→fellowship, etc.)
 * stay in SCENES for stored prefs / tab defaults, but the Settings grid
 * should not fake variety with duplicate posters.
 */
export const PICKER_SCENE_IDS: SceneId[] = [
  "fellowship", // loop-ridge
  "haven", // loop-path
  "mordor", // loop-ember
  "fire", // loop-fire
  "guardians", // loop-dawn
  "sentinel", // loop-mist
];

/** Alias scene → canonical picker id (same mp4). */
const SCENE_ALIASES: Partial<Record<SceneId, SceneId>> = {
  gold: "fellowship",
  path: "haven",
  ember: "mordor",
  dusk: "guardians",
  mist: "sentinel",
};

export function canonicalSceneId(id: SceneId): SceneId {
  return SCENE_ALIASES[id] ?? id;
}

export function scenePoster(id: SceneId): string {
  return SCENES[id]?.poster || SCENES.fellowship.poster;
}

export function sceneVideo(id: SceneId): string | null {
  return SCENES[id]?.video ?? null;
}

/** @deprecated use scenePoster — kept for any leftover imports */
export function sceneSrc(id: SceneId): string {
  return scenePoster(id);
}
