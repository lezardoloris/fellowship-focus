/** HD immersive scenes from Documents/BLOCKER — full-bleed app backgrounds. */

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
  src: string;
  label: string;
};

export const SCENES: Record<SceneId, Scene> = {
  fellowship: {
    id: "fellowship",
    src: "/scenes/fellowship-ridge.jpg",
    label: "The Fellowship",
  },
  haven: {
    id: "haven",
    src: "/scenes/cliff-haven.jpg",
    label: "Cliff Haven",
  },
  mordor: {
    id: "mordor",
    src: "/scenes/mordor-watch.jpg",
    label: "Mordor Watch",
  },
  fire: {
    id: "fire",
    src: "/scenes/bridge-fire.jpg",
    label: "Bridge of Fire",
  },
  map: {
    id: "map",
    src: "/scenes/middle-earth-map.jpeg",
    label: "Middle-earth",
  },
  guardians: {
    id: "guardians",
    src: "/scenes/argons-guardians.jpg",
    label: "The Guardians",
  },
  sentinel: {
    id: "sentinel",
    src: "/scenes/forest-sentinel.jpeg",
    label: "Forest Sentinel",
  },
  mist: {
    id: "mist",
    src: "/scenes/scene-mist.jpeg",
    label: "Mist",
  },
  gold: {
    id: "gold",
    src: "/scenes/scene-gold.jpeg",
    label: "Gold Hour",
  },
  dusk: {
    id: "dusk",
    src: "/scenes/scene-dusk.jpeg",
    label: "Dusk",
  },
  ember: {
    id: "ember",
    src: "/scenes/scene-ember.jpeg",
    label: "Ember",
  },
  path: {
    id: "path",
    src: "/scenes/scene-path.jpeg",
    label: "The Path",
  },
};

/** Default scene per /app tab */
export const TAB_SCENE: Record<"block" | "focus" | "guild", SceneId> = {
  block: "mordor",
  focus: "fellowship",
  guild: "map",
};

export const LANDING_SCENE: SceneId = "fellowship";
export const DOWNLOAD_SCENE: SceneId = "haven";
export const BLOCKED_SCENE: SceneId = "fire";

export const ALL_SCENE_IDS = Object.keys(SCENES) as SceneId[];

export function sceneSrc(id: SceneId): string {
  return SCENES[id]?.src || SCENES.fellowship.src;
}
