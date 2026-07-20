# Fellowship Focus — Product Plan

> Duolingo for deep work. One link. Your Fellowship marches to Mount Doom.

## One-liner

Block distractions, complete daily focus quests, and advance your Fellowship from the Shire to Mordor — with friends on a shared ladder.

## Core loop (Duolingo × LOTR × Koncentro)

```
Daily Quest (25 min focus)
    → Chrome extension blocks dopamine sites
    → Session completes → +25 Focus XP
    → Fellowship map advances
    → Streak maintained (Torch of Eärendil)
    → Weekly ladder updates
    → Next waypoint story unlocks
```

## The one link

Each Fellowship gets a single shareable URL:

```
https://your-app.com/f/shire-fellowship-abc123
```

Friends open it → pick a name → join. Everyone sees:
- Shared map progress (co-op)
- Weekly ladder (competition)
- Who focused today
- Who tried to visit blocked sites (accountability, optional)

## Metrics tracked

| Metric | Source | Effect |
|--------|--------|--------|
| Focus minutes | Extension timer | XP, map progress |
| Sessions completed | Extension | Streak, ladder |
| Blocked site attempts | Extension intercept | -5 XP penalty, fellowship feed |
| Daily quest done | 25+ min/day | Streak +1 |
| Weekly rank | Sum of focus XP | Ladder position |

## Waypoints & epic stories

### I. Bag End — *The Unexpected Party*
**0 XP** · The journey begins.

> You were comfortable. The Shire was warm. Then Gandalf knocked — and you realized comfort was the real distraction. Today you leave Bag End. Not because you feel ready. Because the Ring won't wait for your mood.

**Unlock:** Fellowship created. Share your link.

---

### II. Bree — *The Prancing Pony*
**500 XP** · First rest, first danger.

> At the Prancing Pony, Strider watched from the shadows. So do your blocked sites — they wait for you to slip. The Fellowship stayed one more night. You stay one more Pomodoro.

**Unlock:** Inn Rest badge (complete 3 sessions in one day).

---

### III. Weathertop — *The Wound*
**1,200 XP** · The Nazgûl find you when you look away.

> Frodo put on the Ring on Weathertop. One moment of weakness — and the wound never fully heals. Every tab you open to Twitter is a Ring on your finger. The extension blocks it. The Fellowship sees the attempt.

**Unlock:** Hard Mode available (tab-switch = session fail).

---

### IV. Rivendell — *The Council*
**2,500 XP** · Many paths. One choice.

> Elrond did not ask who was strongest. He asked who would go. Your Fellowship gathers here — not to compare talent, but to commit. The ladder shows who marched hardest this week. The map shows you march together.

**Unlock:** Weekly challenges ("Reach Moria by Sunday").

---

### V. Moria — *The Bridge*
**5,000 XP** · You cannot go back.

> "You cannot pass." Gandalf stood on the Bridge of Khazad-dûm so the Fellowship could run. Your streak is that bridge — burn it behind you. Miss a day and the Balrog takes your Torch.

**Unlock:** Balrog Slayer title (30-day streak).

---

### VI. Lothlórien — *The Mirror*
**10,000 XP** · Clarity after darkness.

> Galadriel showed Frodo what would happen if he failed. Your dashboard shows the same: days focused, sites resisted, friends still walking. Look at the mirror. Then close it and work.

**Unlock:** Golden map skin.

---

### VII. Helm's Deep — *The Dawn*
**20,000 XP** · Hold the line until dawn.

> They said it was over at midnight. The Fellowship held until the sun rose. Your weekly ladder resets Monday — hold your rank until dawn.

**Unlock:** Champion of the Deep (top of weekly ladder).

---

### VIII. Minas Tirith — *The Siege*
**35,000 XP** · The city holds because everyone shows up.

> Minas Tirith fell slowly, then all at once — when people stopped showing up. Your Fellowship doesn't need heroes. It needs everyone to complete their daily quest.

**Unlock:** Fellowship banner (custom name on map).

---

### IX. Mount Doom — *The Destruction*
**50,000 XP** · It ends where it began.

> Frodo couldn't destroy the Ring alone. Sam carried him up the mountain. Your Fellowship carried you here — every session logged, every blocked site resisted, every friend who didn't quit. Throw it in the fire.

**Unlock:** Ring Destroyed. Journey complete. New cycle begins.

---

## Social mechanics

### Fellowship (co-op)
- Shared XP pool advances the map
- All members visible on the route
- Feed: "Aragorn completed 25 min" / "Boromir resisted reddit.com"

### Weekly ladder (competition)
- Resets every Monday
- Ranked by focus XP this week
- Bronze → Silver → Gold leagues (top 3 promoted visually)

### Streak — Torch of Eärendil
- Complete daily quest (≥25 min) = streak +1
- Miss a day = streak resets to 0
- 7-day streak = +50 bonus XP
- 30-day streak = Balrog Slayer title

### Accountability
- Blocked site attempt during session: logged, -5 XP, optional feed message
- "Boromir looked at twitter.com during focus" (gentle shame, Duolingo owl energy)

## MVP scope (this build)

- [x] Next.js web app with SQLite
- [x] Create/join Fellowship via one link
- [x] Dashboard: map, ladder, streak, feed
- [x] Chrome extension: Pomodoro + site blocking
- [x] Extension syncs sessions + blocks to API

## Phase 2 (later)

- Desktop blocker (Koncentro fork)
- Push notifications
- Mobile companion
- Custom block lists per user
- Deploy to Vercel + Turso/Supabase

## Tech stack

| Layer | Tech |
|-------|------|
| Web | Next.js 15, Tailwind |
| DB | SQLite (better-sqlite3) |
| Extension | Chrome MV3 |
| Blocking | declarativeNetRequest |
