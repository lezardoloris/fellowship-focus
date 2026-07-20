# Fellowship Focus — Points, Ladder & Escrow Stakes

## Philosophy

> Focus = currency. Distraction = debt. Optional real money = skin in the game.

Three layers stack:

1. **XP** — instant feedback (Duolingo)
2. **Weekly ladder** — social competition (league)
3. **Escrow stakes** (optional) — real money on the line (Cold Turkey × Duolingo)

---

## XP Economy

### Gains

| Action | XP | Condition |
|--------|-----|-----------|
| Focus minute | +1 XP/min | Session completed |
| Daily quest | +10 XP | ≥25 min in one day |
| Session complete | +5 XP | Full Pomodoro finished |
| Clean session | +15 XP | Zero block attempts during session |
| 7-day streak | +50 XP | Every 7th consecutive day |
| Abandon early | +½ XP/min | Partial credit |

### Penalties — "You cannot pass" page

Every time the block page loads during an active focus session:

| Event | Personal XP | Fellowship pool | Ladder |
|-------|-------------|-----------------|--------|
| 1st block/hour | −10 XP | −3 XP | Weekly net −10 |
| 2nd block/hour | −15 XP | −3 XP | Weekly net −15 |
| 3rd+ block/hour | −20 to −30 XP | −3 XP | Capped at −30 |

**Escalation formula:** `min(30, 10 + 5 × recent_blocks_this_hour)`

The block page shows:
- Premium "You cannot pass" artwork
- Exact penalty: "−15 XP"
- Weekly rank impact: "You dropped to #3 on the ladder"
- Fellowship feed: "Boromir tried twitter.com (−15 XP)"

### Weekly ladder (NET score)

```
weekly_net = Σ(session_xp this week) − Σ(block_penalties this week)
```

Ranked by `weekly_net`, not gross XP. Cheaters who browse distractions sink.

### Leagues (reset Monday)

| League | Weekly net XP | Perk |
|--------|---------------|------|
| **Mordor** | ≥500 | Gold badge, champion title |
| **Gondor** | ≥300 | Silver badge |
| **Rohan** | ≥150 | Bronze badge |
| **Shire** | <150 | Starting league |

Top 3 in fellowship each week get feed shoutout.

---

## Journey map (co-op)

Fellowship **pool XP** = sum of all members' total XP minus fellowship block tax.

```
fellowship_pool -= 3 XP per block event (any member)
```

One person's distraction slows the whole Fellowship on the map.

---

## Escrow stakes (Phase 2 — your Escrow.com API)

Uses existing `cessionpro/lib/escrow.ts` pattern (`ESCROW_API_KEY`, `ESCROW_EMAIL`).

### Concept: "The Ring Deposit"

Each member optionally puts **€5–€50** in Escrow at the start of a **weekly challenge**.

| Outcome | Money |
|---------|-------|
| Complete daily quest 5/7 days | Keep 100% |
| Complete 7/7 days | Keep 100% + split pot of failures |
| Miss ≥3 daily quests | Forfeit 50% to fellowship pot |
| ≥5 block events in a week | Forfeit 25% |
| Quit mid-week | Forfeit 100% |

### Flow

```
1. Fellowship leader creates "Weekly Stakes" challenge (€10/member)
2. Each member registers on Escrow.com (API: POST /customer)
3. API creates transaction (POST /transaction) — funds held
4. Fellowship Focus tracks quests/blocks via existing API
5. Sunday 23:59 — auto-settlement:
   - Winners: Escrow releases funds back
   - Losers: partial release to winners (broker_fee = platform cut optional)
```

### API integration sketch

```typescript
// fellowship-focus/web/src/lib/escrow-stakes.ts
import { escrowConfigured, createEscrowTransaction } from "@/lib/escrow"; // reuse cessionpro

export async function createWeeklyStake(fellowshipId, amountEur, memberEmails) {
  // 1. Ensure all members are Escrow customers
  // 2. Create multi-party transaction with milestone: "7 daily quests"
  // 3. Store stake_id in SQLite stakes table
  // 4. Webhook on escrow.com/payment_received → mark stake as funded
}
```

### Database additions (Phase 2)

```sql
CREATE TABLE stakes (
  id TEXT PRIMARY KEY,
  fellowship_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  escrow_transaction_id TEXT,
  week_start TEXT NOT NULL,
  status TEXT DEFAULT 'pending' -- pending | active | settled
);

CREATE TABLE stake_members (
  stake_id TEXT,
  member_id TEXT,
  escrow_email TEXT,
  funded INTEGER DEFAULT 0,
  outcome TEXT -- winner | partial | forfeited
);
```

### Why Escrow.com fits

- Already integrated in your stack (CessionPro)
- KYC + regulated holding
- API 2017-09-01 for programmatic transactions
- Sandbox mode for testing (`ESCROW_SANDBOX=1`)

---

## Anti-cheat

| Cheat | Counter |
|-------|---------|
| Close blocker | Desktop app = system proxy, can't bypass without cert removal |
| Fake sessions | Min 5 min to count; extension/desktop token required |
| Spam block page | Escalating penalties; fellowship sees feed |
| Alt accounts | One token per browser fingerprint (Phase 3) |

---

## MVP (implemented now)

- [x] Premium block page with image
- [x] Escalating XP penalties
- [x] Fellowship pool tax on blocks
- [x] Weekly NET ladder
- [x] League tiers
- [ ] Escrow weekly stakes (Phase 2)

---

## Example week

**Aragorn:** 5 sessions × 25 min = 125 XP + bonuses = ~160 gross, 0 blocks → **160 net** → Gondor league

**Boromir:** 3 sessions = 90 gross, 4 block events (−10, −15, −20, −25) = **20 net** → Shire league, feed shame

**Fellowship pool:** 340 gross − 12 block tax = slower map progress

**If stakes enabled:** Boromir forfeits €2.50 to pot; Aragorn gets bonus share Sunday.
