# Fellowship Focus — UX / Design / Notifications Plan

Audit date: 2026-07-23. Scope: Block · Focus · Guild tabs, chrome, toasts, desktop notice parity.

## Product north star

1. **Blocker Mode is the moat** — always in sticky chrome; one ON/OFF truth.
2. **One dialect** — Shield · Focus · Guild (not Fellowship/Quest in chrome).
3. **One surface** — `glass-panel` for primary sections.
4. **One feedback channel** — toasts for transient success/info; durable banners for “not connected”.
5. **English UI** in HabitTracker and chrome.

---

## Exhaustive backlog

### A. Chrome & navigation
| ID | Item | Priority | Status |
|----|------|----------|--------|
| A1 | Brand mark in sticky header | P1 | Done |
| A2 | `header-glass` scrim under sticky chrome | P1 | Done |
| A3 | Tablist a11y (`role`, `aria-selected`) | P2 | Done |
| A4 | Auth: “Sign in with Google” / “Sign out” | P0 | Done |
| A5 | Share → toast “Invite link copied” | P0 | Done |
| A6 | Leave guild: confirm + “Leave” label (not raw code) | P0 | Done |
| A7 | Mobile Blocker Mode label ≠ “Block” → “Shield” | P1 | Done |
| A8 | Align content max-width (6xl vs Block 7xl) | P3 | Deferred |
| A9 | `inert` on hidden Block panel | P3 | Deferred |

### B. Notifications
| ID | Item | Priority | Status |
|----|------|----------|--------|
| B1 | Web toasts bottom-right (match desktop, clear header) | P1 | Done |
| B2 | Success label (not “OK”); cancel → `info` not `error` | P1 | Done |
| B3 | Desktop shield toggle toast ON/OFF | P1 | Done |
| B4 | Float timer × uses same Stop + unlock path | P0 | Done |
| B5 | Reduce desktop OS + in-app double notify on break | P3 | Deferred |
| B6 | Quest → Focus wording on desktop native toasts | P3 | Deferred |

### C. Block tab
| ID | Item | Priority | Status |
|----|------|----------|--------|
| C1 | “Alarm” section label | P2 | Done |
| C2 | Clearer Whole sites / List only copy | P1 | Done (prior) |
| C3 | Surface history scan on Block (not only Settings) | P3 | Deferred |
| C4 | Visible copy when armFailed | P2 | Deferred |

### D. Focus tab
| ID | Item | Priority | Status |
|----|------|----------|--------|
| D1 | Week KPIs before Habit tracker | P1 | Done |
| D2 | Demote duplicate “This week” → “Week overview” | P2 | Done |
| D3 | Gondor league color off purple → stone/gold | P2 | Done |
| D4 | GitHub errors via toast | P3 | Deferred |

### E. Guild tab
| ID | Item | Priority | Status |
|----|------|----------|--------|
| E1 | Dashboard `glass-card` → `glass-panel` | P1 | Done |
| E2 | “Join this Guild” (not Fellowship) | P0 | Done |
| E3 | Copy invite → toast | P1 | Done |
| E4 | Spacing unify to `space-y-5` | P2 | Done |
| E5 | Deduplicate HabitTracker Guild vs Focus | P3 | Deferred (product) |

### F. HabitTracker
| ID | Item | Priority | Status |
|----|------|----------|--------|
| F1 | English pass (kill FR + PERSO.xlsx) | P0 | Done |
| F2 | Empty state = accent glass callout | P1 | Done |
| F3 | Month/day `aria-label`s | P2 | Done |

### G. Settings / a11y
| ID | Item | Priority | Status |
|----|------|----------|--------|
| G1 | `aria-modal="true"` + Escape to close | P2 | Done |
| G2 | Focus trap in settings dialog | P3 | Deferred |

---

## Applied in this pass

See commit message. Deferred items stay here for follow-up sessions.
