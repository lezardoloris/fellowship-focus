/** Curated royalty-free focus music catalog (YouTube source IDs for attribution). */

export type FocusTrack = {
  id: string;
  title: string;
  channel: string;
  duration: string;
  vibe: "chill" | "cinematic" | "ambient" | "beats" | "classical";
  youtubeId: string;
  /** Seconds to skip at start (channel sting / spoken promo). */
  trimStart: number;
  /** Seconds to drop at end (subscribe CTA / outro). */
  trimEnd: number;
};

export const FOCUS_TRACKS: FocusTrack[] = [
  {
    id: "ceo-penthouse",
    title: "CEO Penthouse",
    channel: "Chill Music Lab",
    duration: "2:49:16",
    vibe: "chill",
    youtubeId: "OWz7HiR6H-0",
    trimStart: 14,
    trimEnd: 18,
  },
  {
    id: "hyperfocus-cafe",
    title: "Hyperfocus Café",
    channel: "Grind & Groove",
    duration: "59:08",
    vibe: "chill",
    youtubeId: "hpAD6SGi3j8",
    trimStart: 12,
    trimEnd: 16,
  },
  {
    id: "stakes-high",
    title: "When the Stakes Are High",
    channel: "Cinematic Focus",
    duration: "1:00:14",
    vibe: "cinematic",
    youtubeId: "TIqsKXQHvFI",
    trimStart: 10,
    trimEnd: 14,
  },
  {
    id: "force-album",
    title: "Force",
    channel: "AShamaluevMusic",
    duration: "1:04:04",
    vibe: "cinematic",
    youtubeId: "WMdhPtS5vio",
    trimStart: 8,
    trimEnd: 12,
  },
  {
    id: "dune-spice",
    title: "Spice Meditation",
    channel: "Empyreal Ambient",
    duration: "3:00:01",
    vibe: "ambient",
    youtubeId: "R75oWuI4te4",
    trimStart: 12,
    trimEnd: 16,
  },
  {
    id: "deep-work-neural",
    title: "Deep Work Mix",
    channel: "Brainwave Workspace",
    duration: "2:12:37",
    vibe: "ambient",
    youtubeId: "UDTmUzu05BE",
    trimStart: 14,
    trimEnd: 18,
  },
  {
    id: "dwarf-mountain",
    title: "Dwarf Mountain Journey",
    channel: "Springs of Serenity",
    duration: "2:01:33",
    vibe: "ambient",
    youtubeId: "4WIMyqBG9gs",
    trimStart: 10,
    trimEnd: 14,
  },
  {
    id: "trap-work",
    title: "Trap Beats for Work",
    channel: "IceDavid Beats",
    duration: "1:04:37",
    vibe: "beats",
    youtubeId: "7VAUDImpqGQ",
    trimStart: 12,
    trimEnd: 16,
  },
  {
    id: "serious-grind",
    title: "Serious Grind",
    channel: "MM",
    duration: "1:46:40",
    vibe: "beats",
    youtubeId: "MYW0TgV67RE",
    trimStart: 12,
    trimEnd: 16,
  },
  {
    id: "lock-in",
    title: "Lock In",
    channel: "The Workstation Lab",
    duration: "1:01:41",
    vibe: "chill",
    youtubeId: "EN0A5derVo0",
    trimStart: 12,
    trimEnd: 16,
  },
  {
    id: "peak-performance",
    title: "Peak Performance",
    channel: "Uplifting Brainwaves",
    duration: "4:57:25",
    vibe: "ambient",
    youtubeId: "5_4KRUx2iKY",
    trimStart: 14,
    trimEnd: 20,
  },
  {
    id: "hyper-focus-2026",
    title: "Hyper Focus Mode",
    channel: "Deep Productivity",
    duration: "2:01:24",
    vibe: "ambient",
    youtubeId: "eo1gKGt6h9M",
    trimStart: 14,
    trimEnd: 18,
  },
  {
    id: "ceo-zero",
    title: "CEO Zero Distraction",
    channel: "Grind & Groove",
    duration: "57:25",
    vibe: "chill",
    youtubeId: "ahawPLh4epk",
    trimStart: 12,
    trimEnd: 16,
  },
  {
    id: "brain-performance",
    title: "Brain Performance",
    channel: "Mind Focus Music",
    duration: "2:04:28",
    vibe: "ambient",
    youtubeId: "GaTy0vRmT9E",
    trimStart: 14,
    trimEnd: 18,
  },
  {
    id: "super-focus-alpha",
    title: "Super Focus Alpha",
    channel: "SleepTube",
    duration: "2:00:02",
    vibe: "ambient",
    youtubeId: "p2_zDvtPQ-g",
    trimStart: 15,
    trimEnd: 18,
  },
  {
    id: "flow-chillstep",
    title: "Flow State Chillstep",
    channel: "Cosmic Hippo",
    duration: "1:03:33",
    vibe: "beats",
    youtubeId: "am1VJP0RnmQ",
    trimStart: 10,
    trimEnd: 14,
  },
  {
    id: "future-garage",
    title: "Deep Future Garage",
    channel: "Chill Music Lab",
    duration: "2:49:56",
    vibe: "chill",
    youtubeId: "T2QZpy07j4s",
    trimStart: 12,
    trimEnd: 16,
  },
  {
    id: "brainfm-30",
    title: "Dreamlight 30m",
    channel: "Brain.fm",
    duration: "30:02",
    vibe: "ambient",
    youtubeId: "UpPmnnJcy6A",
    trimStart: 6,
    trimEnd: 8,
  },
  {
    id: "chill-inspiring",
    title: "Chill Deep Focus",
    channel: "Chill Music Lab",
    duration: "2:33:06",
    vibe: "chill",
    youtubeId: "-sZqtdT-GVw",
    trimStart: 12,
    trimEnd: 16,
  },
  {
    id: "classical-study",
    title: "Classical Study",
    channel: "HALIDONMUSIC",
    duration: "2:27:57",
    vibe: "classical",
    youtubeId: "mdJU5ogrPMY",
    trimStart: 4,
    trimEnd: 8,
  },
];

export const FOCUS_MUSIC_KEY = "ff-focus-track";

/** Extract a YouTube id from a filename / stem if present. */
export function extractYoutubeId(raw: string): string | undefined {
  const bracket = raw.match(/\[([A-Za-z0-9_-]{6,})\]/);
  if (bracket) return bracket[1];
  const focus = raw.match(/^focus-([A-Za-z0-9_-]{6,})(?:\.|$)/i);
  if (focus) return focus[1];
  const bare = raw.match(/(?:^|[^A-Za-z0-9])([A-Za-z0-9_-]{11})(?:[^A-Za-z0-9]|$)/);
  if (bare) {
    const hit = FOCUS_TRACKS.find((t) => t.youtubeId === bare[1]);
    if (hit) return hit.youtubeId;
  }
  return FOCUS_TRACKS.find((t) => raw.includes(t.youtubeId))?.youtubeId;
}

/** Match a local filename that contains a YouTube id. */
export function matchLocalTrack(filename: string, tracks = FOCUS_TRACKS): FocusTrack | undefined {
  const id = extractYoutubeId(filename);
  if (id) return tracks.find((t) => t.youtubeId === id);
  const lower = filename.toLowerCase();
  return tracks.find((t) => lower.includes(t.youtubeId.toLowerCase()));
}

/** Short display title for any raw stem / YouTube SEO filename. */
export function niceFocusTitle(raw: string): string {
  const track = matchLocalTrack(raw);
  if (track) return track.title;
  return raw
    .replace(/\s*[[（(][A-Za-z0-9_-]{6,}[)）\]]\s*$/, "")
    .replace(/^focus-/i, "")
    .replace(/\s*[|｜~•·].*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim() || raw;
}
