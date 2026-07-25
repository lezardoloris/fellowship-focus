# Plan — "What makes me money" (DataFast for your TIME)

*2026-07-25. Goal: answer in 3 seconds — "what earns me money, and how much time did I give it this week / this month".*

---

## 1. How DataFast actually works (researched, sourced)

**Tracking.** A ~4KB first-party script sets two cookies (`datafast_visitor_id`, persistent + `datafast_session_id`, per session). At session start it captures **UTM params + document.referrer** and the backend classifies them into channels (Google, X, newsletter, direct…). Events POST to their ingest (proxyable through your own domain to survive adblockers). Marc Lou is explicit: cookies over anonymity, because "revenue attribution is impossible without cookies".

**Revenue attribution (the core trick).** A **two-sided join**:
- *Deterministic path*: your backend stamps the two cookie IDs into **Stripe metadata** when creating the checkout; DataFast consumes `payment_intent.succeeded` webhooks and joins payment → session → visitor → **original channel**.
- *Heuristic fallback*: a client-side `datafast("payment", { email })` on the success page, joined by email to the Stripe customer. Deduped server-side.
- *Stitching*: `identify(user_id)` re-links visitors across devices/cookie resets.

**Dashboard.** Revenue per channel, revenue per visitor, conversion rates per source, customer-journey view, revenue per keyword. Why it beats GA: **one screen denominated in money**, zero vanity metrics.

**Stack hints.** Event store migrated MongoDB → Tinybird (ClickHouse) for aggregates; entities stay in a classic DB. Dedup on cookie/payment IDs.

---

## 2. The abstraction, mapped to us

DataFast: *low-value raw events (pageviews) → attributed to a money-bearing entity (channel) via a deterministic join + a heuristic fallback → everything displayed in currency.*

Us: *low-value raw events (window polls, focus minutes) → attributed to a money-bearing entity (client/project) via the focus session (deterministic) + app→client rules (heuristic) → everything displayed in euros.*

| DataFast | Fellowship Focus |
|---|---|
| Visitor / pageview | Minute of tracked time / `app_usage` sample |
| Session id cookie | `focus_session` (has `client_id`/`project_id`) |
| Channel (Google, X…) | **Client**, or activity class (client work / admin / prospecting / distraction) |
| UTM + referrer classifier | **`client_rules`** : app + window-title pattern → client |
| Stripe metadata join (deterministic) | Session started ON a client → minutes are his, period |
| Email fallback (heuristic) | Rule match on foreground app for untagged time |
| `identify()` stitching | Reassignment UI ("this block was Client X") that also creates the rule |
| Revenue per visitor | **Effective €/h** (earned € / total hours) |
| Conversion rate per channel | **Billable ratio** (billable minutes / total minutes) |

**We already have almost everything**: `clients.hourly_rate_cents`, `projects.estimate_minutes`, `focus_sessions.client_id/project_id`, `offline_time`, `client_rules` + `suggestClientForApp()`, `app_usage.hourly_json/apps_json`, `billableSummary`, `projectProfitability`. What's missing is the **attribution projection** and the **money-first views**.

---

## 3. Data model additions (minimal)

### 3a. `time_attributions` (a recomputable projection, not a source of truth)
Each time slice of the week gets attributed:

```
slice (from focus_sessions ∪ offline_time ∪ app_usage rollups)
  → { client_id | activity_class, minutes,
      source: 'session' | 'rule' | 'unattributed',
      value_cents = minutes/60 × client.hourly_rate_cents }
```

Rules of the join (mirrors DataFast exactly):
1. **Session wins** (deterministic — like Stripe metadata): minutes inside a focus session attributed to a client belong to that client.
2. Else **first matching `client_rules`** on (app, window title) — the heuristic email-match.
3. Else **`unattributed`** — surfaced loudly (DataFast's "direct/unknown"), with one-click "assign + create rule" so the engine self-improves.

Projection = recomputable: edit a rule → history re-attributes (DataFast-style retroactive join). No new ingestion needed; compute on read for a week/month window (SQLite handles this fine at our scale).

### 3b. Activity classes for non-client time
`admin` · `prospecting` · `learning` · `distraction` (from usage_tracker categories). They show **at 0 €** in the money table — the opportunity cost made visible.

### 3c. (Later) `earnings` — invoices actually paid per client → *realized* € vs *worked* €. The true Stripe analog. Out of scope v1.

---

## 4. The views (in priority order)

### V1 — "What makes me money" (the channels table) · THE HOMEPAGE
One ranked table, selector Week / Month:

| Client / Activity | Hours | € earned | eff. €/h | Billable % | trend |
|---|---|---|---|---|---|
| Acme Corp | 12.5h | 1 000 € | 80 €/h | 92% | ▂▄▆█ |
| Sweet Label | 6h | 480 € | 80 €/h | 74% | ▄▂▃▅ |
| Prospecting | 4h | 0 € | — | — | |
| Admin | 3h | 0 € | — | — | |
| Distraction | 2.1h | 0 € | — | — | |

Headline tiles above it: **"This week: 31h tracked · 19h billable (61%) · 1 480 € · 47 €/h effectif"** with deltas vs last week. *Everything denominated in euros — never raw minutes alone.*

### V2 — Journey timeline (the customer-journey view)
Horizontal day/week timeline colored by client/class (built from `hourly_json` + sessions + offline_time), euros accruing along it. Hover = the apps behind the block. Click an unattributed block → assign + "create rule?".

### V3 — Trends (€/h + billable ratio over time)
The two curves that tell a freelancer if their business is getting healthier: effective €/h and billable %, week over week, month over month.

### V4 — Profitability burn (already ½ built: E5-S6)
Per project: estimate vs actual, effective rate erosion ("140% over estimate → your 60 €/h became 43 €/h"). Add the burn-down bar to the existing report.

---

## 5. Build order

1. **`timeAttributions(memberId, from, to)`** in backlog.ts — the projection (session-wins → rules → unattributed) + per-client/class rollup with value_cents. *(backend, S)*
2. **`GET /api/money?window=week|month`** — returns tiles + table + trends series. *(S)*
3. **V1 MoneyPanel** (premium-panel style) on the Focus tab — tiles + ranked table. *(M)*
4. **V2 timeline** in the same panel (canvas or flex bars from hourly_json). *(M)*
5. **V3 trends** (reuse the sparkline pattern) + **V4 burn bar** on profitability. *(S)*
6. Desktop parity later (webview already shows the web dashboard).

**Two principles stolen verbatim from DataFast:**
- Denominate everything in **euros**, never in raw minutes alone — that's the whole reason it beats GA.
- Make the deterministic path effortless (start a session on a client = metadata) while the heuristic path **self-improves** (each manual correction creates a rule, remembered forever).
