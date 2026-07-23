/**
 * Client-side habit row order — guild habits use a localStorage overlay
 * (API has no sort field yet); solo habits reorder the solo store array directly.
 */

const ORDER_KEY = "ff-habit-order-v1";

type OrderStore = Record<string, string[]>;

function loadOrderStore(): OrderStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(ORDER_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as OrderStore;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveOrderStore(store: OrderStore): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ORDER_KEY, JSON.stringify(store));
}

export function getSavedHabitOrder(scope: string): string[] | null {
  const ids = loadOrderStore()[scope];
  return Array.isArray(ids) && ids.length > 0 ? ids : null;
}

export function saveHabitOrder(scope: string, ids: string[]): void {
  const store = loadOrderStore();
  store[scope] = ids;
  saveOrderStore(store);
}

/** Re-sort rows by saved id list; unknown ids keep their relative order at the end. */
export function applyHabitOrder<T extends { id: string }>(rows: T[], scope: string): T[] {
  const saved = getSavedHabitOrder(scope);
  if (!saved) return rows;

  const byId = new Map(rows.map((r) => [r.id, r]));
  const ordered: T[] = [];
  for (const id of saved) {
    const row = byId.get(id);
    if (row) {
      ordered.push(row);
      byId.delete(id);
    }
  }
  for (const row of rows) {
    if (byId.has(row.id)) ordered.push(row);
  }
  return ordered;
}

export function moveInOrder(ids: string[], fromIndex: number, toIndex: number): string[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= ids.length) return ids;
  const next = [...ids];
  const [item] = next.splice(fromIndex, 1);
  if (!item) return ids;
  let insertAt = toIndex;
  if (fromIndex < toIndex) insertAt = toIndex - 1;
  next.splice(insertAt, 0, item);
  return next;
}
