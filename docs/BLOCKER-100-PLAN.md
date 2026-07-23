# Blocker 100% — Unified Reliability Plan

**Date:** 2026-07-23  
**Scope:** Chrome MV3 extension, Windows desktop mitm/proxy, Shield UI truth, layered failover.  
**Sources:** 10 blocker-scenario reviews (DNR/YouTube · Edge/Safari/Firefox · Desktop mitm · Dual-engine races · Shield UI/arming · Timer vs shield · Hosts/DNS/firewall · YouTube bypass catalog · AV/VPN conflicts · Continuous health/canary).  
**Related:** [`FOCUS-WEB-MASTER-PLAN.md`](./FOCUS-WEB-MASTER-PLAN.md) (product/trust waves) · [`BROWSER-HONESTY.md`](./BROWSER-HONESTY.md) (surface matrix).

---

## 1. Executive summary

Users report Shield **connected / ON** while YouTube still loads (especially SPA navigations), and X sometimes keeps stale DNR rules. That is not “blocking is hard” in the abstract — it is **enforcement dead while UI still smiles**.

**Smoking gun (P0):** `extension/background.js` after commit `9083d6c` had a **syntax error** (stray `};` / `}` after `getStatus()`). An MV3 service worker that fails to parse **never registers listeners**, never rebuilds DNR, and never runs `webNavigation` enforce. The web app can still talk to a previously-alive worker or show cached “connected” state → **false confidence**. Hotfix: Wave **B0**.

Beyond the SW parse kill, the same reviews converge on a second pattern: **truth gaps** (faked `ruleCount` in notify mode, arm toasts before rules land, timer Start without verified shield) and **single-layer fragility** (DNR alone loses YouTube SPA / QUIC / VPN / other browsers). Practical “100%” is **layered parallel methods with failover + verified canary**, not one magic switch.

---

## 2. Architecture — layered parallel methods

```text
L1  Chrome DNR (declarativeNetRequest)     — primary hard block / redirect
L2  webNavigation + tab sweep              — SPA (historyState), already-open tabs, notify bounce
L3  Desktop mitm + system proxy            — whole-machine Chromium/Firefox coverage on Windows
L4  Hosts / DNS sinkhole                   — last-resort name resolution kill (admin; blunt)
L5  OS policies / firewall                 — enterprise / power-user; optional, honest about scope
```

**Failover rules**

| Failure | Escalate to |
|---------|-------------|
| SW dead / DNR empty while Shield claimed ON | B0 repair + refuse “ON” until canary |
| YouTube in-app click (no full load) | L2 `onHistoryStateUpdated` → same enforce as `onBeforeNavigate` |
| Extension absent / Incognito denied / non-Chrome | L3 desktop proxy (or honest “unprotected”) |
| QUIC / HTTP3 bypasses proxy TLS | Force TCP/HTTPS or disable QUIC; cert health check |
| User uninstalls extension + skips desktop | L4/L5 optional; never claim full coverage without them |

**Invariant:** never show Shield ON without a **verified canary** (probe a listed host / synthetic navigation / DNR+enforce path returns “blocked”). Ping ≠ armed.

---

## 3. Honesty boundary (locked)

| Claim | Reality |
|-------|---------|
| “100% of the internet forever” | **Impossible** (Admin, other OS users, TV apps, rooted devices, DNS over HTTPS edge cases) |
| Safari / iOS / Smart TV YouTube apps | **Out of scope** — no MV3; say so in UI ([`BROWSER-HONESTY.md`](./BROWSER-HONESTY.md)) |
| Firefox / Edge-by-default | Not shipped as first-class engines; Edge may load Chrome MV3 if user installs it |
| **Practical 100%** | Listed sites blocked on **covered surfaces**: Chrome (+ Incognito if allowed) and/or Windows desktop proxy, with hard-mode YouTube family hosts, SPA catch, and canary-verified arm |

Copy and toasts must match this matrix. Prefer under-claim + prove over over-claim + hope.

---

## 4. Synthesis of the 10 lenses

### 1) Chrome DNR + YouTube
- Full-domain rules for listed + hard-mode optional hosts (`youtube.com`, `youtu.be`, `m.youtube.com`, `music.youtube.com`, …).
- DNR alone misses many SPA transitions → must pair with L2.
- Stale rules after SW death leave asymmetric behavior (e.g. X still blocked, YT not).

### 2) Edge / Safari / Firefox matrix
- Document in honesty doc; Wave B3 packages Edge store listing if we invest; Safari = no.
- Desktop L3 is the cross-browser answer on Windows.

### 3) Desktop mitm failures (QUIC / VPN / cert)
- QUIC bypass, broken/untrusted cert, VPN that ignores system proxy → silent miss.
- B1: QUIC disable guidance/automation, cert readiness gate before “Shield ON”, VPN detect toast.

### 4) Dual-engine races + failover
- Extension + desktop both arming/clearing → races, double XP, orphan rules.
- Single arm coordinator: one owner of “effective shield”, ordered teardown, shared site list.

### 5) Shield UI truth / arming
- `ruleCount` must be **real DNR count**; notify mode exposes `coveredSites` (do not fake DNR).
- Arm wait: poll status until rules/coverage + optional canary; no premature “ON” toast.
- Direct channel when content script missing.

### 6) Timer vs shield lock
- Focus Start must not train “timer works, blocking optional” without explicit unprotected confirm.
- While focus locked, shield toggle respects lock; clocks stay single-owned (web XOR extension).

### 7) Hosts / DNS / firewall layers
- Wave B2 optional L4/L5 for power users; warn about bluntness (CDN shared IPs, DoH).

### 8) YouTube bypass catalog
- SPA history, `youtu.be`, music/m. sites, embeds, PWA, Incognito, other browsers, TV.
- Each bypass maps to a layer or an honesty string.

### 9) AV / VPN / firewall conflicts
- Cert pinning blockers, “HTTPS scanning”, kill-switch VPNs — detect + guided repair, not silent fail.

### 10) Continuous health / verified canary
- Periodic probe: SW alive, DNR count coherent, sample navigate/enforce, desktop proxy path.
- Fail → UI “degraded” / auto-rebuild / escalate layer — never green lie.

---

## 5. Phased backlog

### Wave B0 — Hotfix *(ship now)*

| ID | Outcome | Primary files |
|----|---------|---------------|
| B0-1 | Fix SW parse error after `getStatus()`; `node --check` clean | `extension/background.js` |
| B0-2 | `onHistoryStateUpdated` → same enforce path as `onBeforeNavigate` | `extension/background.js` |
| B0-3 | Hard mode merges `HARD_HOSTS_OPTIONAL` when rebuilding rules (parity) | `extension/background.js` |
| B0-4 | Honest `ruleCount` (real dnrCount) + `coveredSites`; `isArmed` understands notify | `extension/background.js`, `web/src/lib/extensionBridge.ts` |

### Wave B1 — Truth + health + QUIC + arm wait

| ID | Outcome |
|----|---------|
| B1-1 | Verified canary before Shield ON toast / `isArmed` green |
| B1-2 | Arm wait / no OFF flash while rebuilding |
| B1-3 | Desktop: cert ready + QUIC/VPN conflict surfacing |
| B1-4 | Dual-engine arm coordinator (extension ↔ desktop) |
| B1-5 | Timer Start: require armed or explicit unprotected confirm |
| B1-6 | Continuous health alarm (SW + DNR coherence + last canary) |

### Wave B2 — Hosts + policies

| ID | Outcome |
|----|---------|
| B2-1 | Optional hosts-file / DNS sinkhole assist with clear warnings |
| B2-2 | Optional firewall / policy hooks for power users |
| B2-3 | Soft/hard shared host matrix documented + tested |

### Wave B3 — Edge package + honesty polish

| ID | Outcome |
|----|---------|
| B3-1 | Edge add-on package / listing if ROI justifies |
| B3-2 | UI copy fully aligned with [`BROWSER-HONESTY.md`](./BROWSER-HONESTY.md) |
| B3-3 | Incognito allow prompt + first-run surface matrix |

---

## 6. Acceptance (practical 100%)

- [ ] `node --check extension/background.js` passes; SW registers on install/reload.
- [ ] Hard mode: YouTube family hosts in DNR (or notify enforce list) without requiring manual add.
- [ ] YouTube in-site navigation triggers block/notify via `onHistoryStateUpdated`.
- [ ] Notify mode: `ruleCount === 0` DNR but `coveredSites > 0` and UI still armed when shield on.
- [ ] Shield ON UI only after canary (B1) — until then, no green lie.
- [ ] Desktop path documented for non-Chrome; Safari/TV never claimed.
- [ ] Cross-links stay current with master plan Wave 0 blocker truth items.

---

## 7. Mapping to master plan

Product/trust items in [`FOCUS-WEB-MASTER-PLAN.md`](./FOCUS-WEB-MASTER-PLAN.md) Wave 0–1 (Notify honesty, hard-mode hosts, arm channel, unprotected Start) remain authoritative for **web UX**. This doc owns **enforcement layers, failover, canary, and multi-surface honesty** so blocker work does not get lost inside layout/copy waves.
