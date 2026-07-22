/** Curated royalty-free focus music catalog (YouTube source IDs for attribution). */

export type FocusTrack = {
  id: string;
  title: string;
  channel: string;
  duration: string;
  vibe: "chill" | "cinematic" | "ambient" | "beats" | "classical";
  youtubeId: string;
};

export const FOCUS_TRACKS: FocusTrack[] = [
  {
    id: "ceo-penthouse",
    title: "Focus Like a CEO — Penthouse",
    channel: "Chill Music Lab",
    duration: "2:49:16",
    vibe: "chill",
    youtubeId: "OWz7HiR6H-0",
  },
  {
    id: "hyperfocus-cafe",
    title: "Hyperfocus Café",
    channel: "Grind & Groove",
    duration: "59:08",
    vibe: "chill",
    youtubeId: "hpAD6SGi3j8",
  },
  {
    id: "stakes-high",
    title: "When the Stakes Are High",
    channel: "Cinematic Focus",
    duration: "1:00:14",
    vibe: "cinematic",
    youtubeId: "TIqsKXQHvFI",
  },
  {
    id: "force-album",
    title: "Force — Epic Motivational",
    channel: "AShamaluevMusic",
    duration: "1:04:04",
    vibe: "cinematic",
    youtubeId: "WMdhPtS5vio",
  },
  {
    id: "dune-spice",
    title: "Spice Meditation — DUNE Ambient",
    channel: "Empyreal Ambient",
    duration: "3:00:01",
    vibe: "ambient",
    youtubeId: "R75oWuI4te4",
  },
  {
    id: "deep-work-neural",
    title: "Uninterrupted Deep Work Mix",
    channel: "Brainwave Workspace",
    duration: "2:12:37",
    vibe: "ambient",
    youtubeId: "UDTmUzu05BE",
  },
  {
    id: "dwarf-mountain",
    title: "Fantasy Medieval Focus",
    channel: "Springs of Serenity",
    duration: "2:01:33",
    vibe: "ambient",
    youtubeId: "4WIMyqBG9gs",
  },
  {
    id: "trap-work",
    title: "Trap Beats for Work",
    channel: "IceDavid Beats",
    duration: "1:04:37",
    vibe: "beats",
    youtubeId: "7VAUDImpqGQ",
  },
  {
    id: "serious-grind",
    title: "Work Music for Serious Grind",
    channel: "MM",
    duration: "1:46:40",
    vibe: "beats",
    youtubeId: "MYW0TgV67RE",
  },
  {
    id: "lock-in",
    title: "Music to Lock In",
    channel: "The Workstation Lab",
    duration: "1:01:41",
    vibe: "chill",
    youtubeId: "EN0A5derVo0",
  },
  {
    id: "peak-performance",
    title: "Deep Intense Focus — Peak Performance",
    channel: "Uplifting Brainwaves",
    duration: "4:57:25",
    vibe: "ambient",
    youtubeId: "5_4KRUx2iKY",
  },
  {
    id: "hyper-focus-2026",
    title: "Hyper Focus Mode 2026",
    channel: "Deep Productivity",
    duration: "2:01:24",
    vibe: "ambient",
    youtubeId: "eo1gKGt6h9M",
  },
  {
    id: "ceo-zero",
    title: "Focus Like a CEO — Zero Distraction",
    channel: "Grind & Groove",
    duration: "57:25",
    vibe: "chill",
    youtubeId: "ahawPLh4epk",
  },
  {
    id: "brain-performance",
    title: "Hyperfocus Mode — Brain Performance",
    channel: "Mind Focus Music",
    duration: "2:04:28",
    vibe: "ambient",
    youtubeId: "GaTy0vRmT9E",
  },
  {
    id: "super-focus-alpha",
    title: "Super Focus — Alpha Binaural",
    channel: "SleepTube",
    duration: "2:00:02",
    vibe: "ambient",
    youtubeId: "p2_zDvtPQ-g",
  },
  {
    id: "flow-chillstep",
    title: "Flow State — Chillstep & Synthwave",
    channel: "Cosmic Hippo",
    duration: "1:03:33",
    vibe: "beats",
    youtubeId: "am1VJP0RnmQ",
  },
  {
    id: "future-garage",
    title: "Deep Future Garage for Work",
    channel: "Chill Music Lab",
    duration: "2:49:56",
    vibe: "chill",
    youtubeId: "T2QZpy07j4s",
  },
  {
    id: "brainfm-30",
    title: "30 Minute Focus — Dreamlight",
    channel: "Brain.fm",
    duration: "30:02",
    vibe: "ambient",
    youtubeId: "UpPmnnJcy6A",
  },
  {
    id: "chill-inspiring",
    title: "Chill — Deep Focus & Inspiring",
    channel: "Chill Music Lab",
    duration: "2:33:06",
    vibe: "chill",
    youtubeId: "-sZqtdT-GVw",
  },
  {
    id: "classical-study",
    title: "Classical Music for Studying",
    channel: "HALIDONMUSIC",
    duration: "2:27:57",
    vibe: "classical",
    youtubeId: "mdJU5ogrPMY",
  },
];

export const FOCUS_MUSIC_KEY = "ff-focus-track";

/** Match a local filename that contains a YouTube id. */
export function matchLocalTrack(filename: string, tracks = FOCUS_TRACKS): FocusTrack | undefined {
  const lower = filename.toLowerCase();
  return tracks.find((t) => lower.includes(t.youtubeId.toLowerCase()));
}
