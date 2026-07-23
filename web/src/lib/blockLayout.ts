/** Persist Block tab panel layout (named CSS grid areas). */

export const BLOCK_LAYOUT_KEY = "ff-block-layout-v1";

export type BlockLayoutId = "session-top" | "session-side" | "classic-3";
export type PanelId = "timer" | "block" | "music";
export type AreaId = "a" | "b" | "c";
export type AreaAssignment = Record<AreaId, PanelId>;

export type BlockLayoutPrefs = {
  layoutId: BlockLayoutId;
  areas: AreaAssignment;
};

export const DEFAULT_BLOCK_LAYOUT: BlockLayoutPrefs = {
  layoutId: "session-top",
  areas: { a: "timer", b: "music", c: "block" },
};

export const LAYOUT_LABELS: Record<BlockLayoutId, string> = {
  "session-top": "Session top",
  "session-side": "Side rail",
  "classic-3": "Three columns",
};

function isPanelId(v: unknown): v is PanelId {
  return v === "timer" || v === "block" || v === "music";
}

function isLayoutId(v: unknown): v is BlockLayoutId {
  return v === "session-top" || v === "session-side" || v === "classic-3";
}

/** Every panel exactly once. */
function isValidAssignment(areas: AreaAssignment): boolean {
  const vals = [areas.a, areas.b, areas.c];
  if (!vals.every(isPanelId)) return false;
  return new Set(vals).size === 3;
}

/** Defaults for a layout id (block stays in the primary slot). */
export function defaultAreasFor(layoutId: BlockLayoutId): AreaAssignment {
  if (layoutId === "classic-3") {
    return { a: "timer", b: "block", c: "music" };
  }
  // session-top & session-side: c = block (full-width / main column)
  return { a: "timer", b: "music", c: "block" };
}

export function normalizeBlockLayout(
  raw: Partial<BlockLayoutPrefs> | null | undefined
): BlockLayoutPrefs {
  const layoutId = isLayoutId(raw?.layoutId) ? raw.layoutId : DEFAULT_BLOCK_LAYOUT.layoutId;
  let areas = raw?.areas;
  if (
    !areas ||
    !isPanelId(areas.a) ||
    !isPanelId(areas.b) ||
    !isPanelId(areas.c) ||
    !isValidAssignment(areas as AreaAssignment)
  ) {
    return { layoutId, areas: defaultAreasFor(layoutId) };
  }
  const next = areas as AreaAssignment;
  // Keep block in the primary slot for session layouts.
  if (layoutId !== "classic-3" && next.c !== "block") {
    return { layoutId, areas: defaultAreasFor(layoutId) };
  }
  return { layoutId, areas: next };
}

export function readBlockLayout(): BlockLayoutPrefs {
  if (typeof window === "undefined") return DEFAULT_BLOCK_LAYOUT;
  try {
    const raw = localStorage.getItem(BLOCK_LAYOUT_KEY);
    if (!raw) return DEFAULT_BLOCK_LAYOUT;
    return normalizeBlockLayout(JSON.parse(raw) as Partial<BlockLayoutPrefs>);
  } catch {
    return DEFAULT_BLOCK_LAYOUT;
  }
}

export function writeBlockLayout(prefs: BlockLayoutPrefs) {
  const normalized = normalizeBlockLayout(prefs);
  localStorage.setItem(BLOCK_LAYOUT_KEY, JSON.stringify(normalized));
  return normalized;
}

/** Invert areas → which grid area a panel occupies. */
export function areaForPanel(areas: AreaAssignment, panel: PanelId): AreaId {
  for (const id of ["a", "b", "c"] as AreaId[]) {
    if (areas[id] === panel) return id;
  }
  return "a";
}

/** Swap timer ↔ music without remounting other state. */
export function swapTimerMusic(areas: AreaAssignment): AreaAssignment {
  const next = { ...areas };
  let timerArea: AreaId | null = null;
  let musicArea: AreaId | null = null;
  for (const id of ["a", "b", "c"] as AreaId[]) {
    if (next[id] === "timer") timerArea = id;
    if (next[id] === "music") musicArea = id;
  }
  if (!timerArea || !musicArea) return areas;
  next[timerArea] = "music";
  next[musicArea] = "timer";
  return next;
}

export function setLayoutId(
  current: BlockLayoutPrefs,
  layoutId: BlockLayoutId
): BlockLayoutPrefs {
  if (current.layoutId === layoutId) return current;
  // Preserve timer/music order when switching between session layouts.
  if (layoutId !== "classic-3" && current.layoutId !== "classic-3") {
    const timerLeft = areaForPanel(current.areas, "timer") === "a";
    return {
      layoutId,
      areas: timerLeft
        ? { a: "timer", b: "music", c: "block" }
        : { a: "music", b: "timer", c: "block" },
    };
  }
  return { layoutId, areas: defaultAreasFor(layoutId) };
}

/** Compact music strip for session row / side rail; fuller panel for classic-3. */
export function musicCompactFor(layoutId: BlockLayoutId): boolean {
  return layoutId !== "classic-3";
}
