# Cursor prompt — positioning decision that maximises profit

*Paste everything below the line into Cursor (agent mode, repo root = `fellowship-focus/`).*

*Note: the BMAD skills in `.claude/skills/` are Claude Code skills — Cursor cannot invoke them. The method below is the BMAD analyst → market-research → product-brief chain written out inline, so this prompt is self-contained.*

---

You are acting as a **strategy analyst**, not an engineer. Do not write product code in this task. Your deliverable is a written decision with numbers, committed as `docs/POSITIONNEMENT.md`.

Read `PLAN-UX-DENSITE.md` and `PLAN-HUD.md` for context on the current product, then work the problem below.

## The question

**Which platform and which acquisition channel maximise the founder's profit over the next 12 months?**

Candidate axes he named: Chrome extension · mobile · Mac users · Windows users · Google Ads · Facebook Ads.

Rank them. Do not deliver a menu of possibilities — deliver one recommendation with the runners-up costed, and say what would have to be true for the ranking to flip.

## Verified facts about the asset (do not re-derive, do not contradict without evidence)

**Product surfaces that exist today:**
- Next.js 16 web app on Railway. Cross-platform by definition.
- PySide6 desktop app. **Windows only.** Ten modules are behind `sys.platform == "win32"` guards, including `desktop/fellowship_focus/activity_tracker.py`, `cert_setup.py`, `proof_capture.py`, `startup.py`, `notifications.py`, and the whole `blocker/` package.
- Chrome MV3 extension v1.5.4, `declarativeNetRequest` + `webNavigation` + `alarms` + `history`. Cross-platform, but sees the browser only.
- No mobile app of any kind.

**What the product actually does, ranked by defensibility:**
1. `usage_tracker.py` polls the foreground window every 5s **all day**, not only during sessions, and categorises time into work / distraction / personal / neutral. This is Rize-class automatic tracking.
2. Four-layer blocking: mitmproxy, hosts file, `netsh advfirewall` QUIC rule, browser extension. This is Cold Turkey-class enforcement.
3. Money layer: billable hours by client, effective hourly rate, per-project profitability, invoice PDF, attribution rules.
4. Peer stakes: freelancers bet real money against each other on weekly objectives (fall short of your peer, you lose the €5 you staked). Escrow-based.

**The central tension you must resolve.** The automatic app tracking is the moat, and it is Windows-only. The Chrome extension is the cheapest path to every OS but physically cannot see time spent outside the browser, so an extension-first strategy ships the product without its moat. Any recommendation that ignores this is wrong.

## The founder's constraints, which change the answer

- Solo. Every engineering week spent is a week not spent selling.
- **He is a professional Google Ads consultant** — this is his day job, with real client accounts. Paid search is his home turf; he can run campaigns at a competence and cost level a normal founder cannot. Weigh this as an asset, not as a neutral channel choice.
- He is not a Meta buyer by trade.
- He wants profit, not users. A free extension with 50k installs and no revenue is a failure by this brief's definition.

## What you must produce

### 1. Segment and job-to-be-done
Name the buyer precisely (not "freelancers" — which freelancers, billing what, on which OS). State the job in their words. If the segment splits, pick the one that pays.

### 2. The wedge feature, argued
Candidate: **reconciliation between tracked time and billed time.** The tracker knows 6.2h went to a client's repo; the billing layer knows what is on an invoice; the difference is "2.1h unbilled this week = €168 you forgot to charge". Toggl needs a manual timer people forget to start. Rize tracks automatically but has no invoice. Harvest bills but tracks manually. Nobody joins the two.

Argue for or against this as the wedge. If you argue against, name a better one and defend it with the same rigour.

### 3. Platform options, each costed
For **Mac**, **mobile (iOS and Android separately)**, **Chrome-extension-first**, and **double-down-on-Windows**, give:
- engineering weeks to reach parity with the current Windows product, and specifically what has to be rebuilt (for Mac: the blocking layer has no WinINET and no `netsh`; foreground-app tracking, notarisation, and any system extension have their own approval costs — research the actual current requirements rather than assuming);
- the reachable paying market, with a source;
- the revenue that platform can plausibly carry in 12 months;
- the payback in months.

Say plainly which platform is a trap.

### 4. Channel options, costed
For **Google Ads** and **Facebook Ads**, and any channel you think beats both:
- real search demand — pull actual volumes for the category (website blocker, time tracking for freelancers, competitor-alternative queries) rather than guessing;
- estimated CPC and a defensible CAC;
- how the founder's own Google Ads expertise changes the maths;
- whether the product's price point can carry that CAC at all.

If the honest answer is that neither paid channel works at this price point, say so and name what does.

### 5. Monetisation
Subscription, one-off licence, a rake on the peer bets, or a mix. Give a price and justify it against the competitors you cite. Note that the bets create a payments and escrow obligation — cost the compliance, do not wave it away.

### 6. The cold-start problem
Peer betting needs at least two committed users who know each other. State what the product is worth to a **single** user with nobody to bet against, because that is every user on day one. If the solo value is thin, the ranking changes and you must say so.

### 7. Recommendation
One ranked answer. A 90-day plan with weekly milestones. **Kill criteria**: the specific number that, if not reached by day 90, means abandon this direction.

## Rules

- **Research, do not recall.** Use the web for competitor pricing, search volumes, App Store and platform requirements. Cite each figure with its source and date. An uncited number is worthless here.
- Where you cannot get a real figure, write "estimate" and show the calculation.
- Cost everything in engineering-weeks and euros. "This would be nice to have" is not an output.
- Argue against your own recommendation once, in a section headed "Where I could be wrong", before concluding.
- No em dashes or en dashes anywhere in the document. Use commas, periods, parentheses, or a plain hyphen. Numeric ranges use a plain hyphen ("2-5 weeks").
- French or English, but pick one and hold it.

## Deliverable

`docs/POSITIONNEMENT.md`, committed with a message explaining the recommendation in two sentences. Do not push; leave the commit local so it can be reviewed first.
