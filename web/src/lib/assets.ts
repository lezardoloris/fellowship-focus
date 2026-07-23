export const WAYPOINT_IMAGES: Record<string, string> = {
  "bag-end": "/assets/hero.jpg",
  bree: "/assets/hero.jpg",
  weathertop: "/assets/journey-map.jpg",
  rivendell: "/assets/rivendell.jpg",
  moria: "/assets/mount-doom.jpg",
  lothlorien: "/assets/rivendell.jpg",
  "helms-deep": "/assets/journey-map.jpg",
  "minas-tirith": "/assets/journey-map.jpg",
  "mount-doom": "/assets/mount-doom.jpg",
};

export const FEATURE_IMAGES = {
  link: "/assets/fellowship.jpg",
  focus: "/assets/focus-quest.jpg",
  ladder: "/assets/journey-map.jpg",
} as const;

/**
 * Compact corner art for guild directory cards (by niche).
 * Regenerate with Gemini: `npm run generate-guild-illustrations` (from web/).
 */
export const GUILD_ILLUSTRATIONS: Record<string, string> = {
  students: "/assets/guilds/students.png",
  builders: "/assets/guilds/builders.png",
  fitness: "/assets/guilds/fitness.png",
  "deep-work": "/assets/guilds/deep-work.png",
  accountability: "/assets/guilds/accountability.png",
  creators: "/assets/guilds/creators.png",
};

export function guildIllustration(niche: string): string | null {
  return GUILD_ILLUSTRATIONS[niche] ?? null;
}
