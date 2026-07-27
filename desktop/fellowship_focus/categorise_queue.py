"""[TRK-8] Ask once, about what costs the most, and never ask again.

Half of measured time currently lands in `neutral` (9.5h against 9.7h of work
over seven days), and no rule table will fix that, because the context is
personal: `whispering` is a work tool on this machine and an unknown word on
anyone else's. The only source of truth is the person being measured.

The design constraints all come from one observation: a tracker that interrupts
gets uninstalled.

* At most three questions a day, and never during a focus session. They are
  asked when the day is being closed, which is the moment someone is already
  reviewing their time.
* Only about the pattern that cost the most minutes this week. Asking about a
  four-minute unknown spends the user's patience on nothing.
* One answer settles it forever, as a rule. A question that comes back is a
  bug, not a reminder.
* Answering is optional. Skipped patterns stay unknown and simply come round
  again next week if they still cost enough to be worth it.
"""

from __future__ import annotations

import json
import time
from pathlib import Path

STATE_DIR = Path.home() / ".fellowship-focus"
RULES_PATH = STATE_DIR / "category-rules.json"
ASKED_PATH = STATE_DIR / "category-asked.json"

MAX_QUESTIONS_PER_DAY = 3
#: Below this, a pattern is not worth a question.
MIN_SECONDS_TO_ASK = 10 * 60
#: A skipped pattern is not re-asked before this.
COOLDOWN_DAYS = 7


def _load(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def _save(path: Path, data) -> None:
    try:
        STATE_DIR.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    except Exception:
        pass


def load_rules() -> dict:
    """{pattern: {"category": str, "client": str|None}} — the user's own answers."""
    data = _load(RULES_PATH, {})
    return data if isinstance(data, dict) else {}


def rule_for(pattern: str) -> dict | None:
    return load_rules().get(pattern)


def answer(pattern: str, category: str, client: str | None = None) -> None:
    """Record a decision. This is what stops the question coming back."""
    rules = load_rules()
    rules[pattern] = {"category": category, "client": client, "at": int(time.time())}
    _save(RULES_PATH, rules)


def skip(pattern: str) -> None:
    """Not now. Comes round again after the cooldown if it still costs enough."""
    asked = _load(ASKED_PATH, {})
    if not isinstance(asked, dict):
        asked = {}
    asked[pattern] = int(time.time())
    _save(ASKED_PATH, asked)


def _recently_asked(pattern: str, now: float) -> bool:
    asked = _load(ASKED_PATH, {})
    if not isinstance(asked, dict):
        return False
    at = asked.get(pattern)
    if not isinstance(at, (int, float)):
        return False
    return (now - at) < COOLDOWN_DAYS * 86400


def build_questions(spans: list[dict], now: float | None = None) -> list[dict]:
    """The (at most three) patterns worth asking about, dearest first.

    `spans` are TRK-1 event rows: {app, title, cat, sec}. A pattern is the app
    plus its label, which is the level a person can actually answer about —
    nobody can categorise 40 individual window titles, but everyone knows what
    "Cursor" or "Instagram · explore" means to them.
    """
    now = time.time() if now is None else now
    rules = load_rules()
    cost: dict[str, int] = {}
    sample: dict[str, str] = {}

    for span in spans:
        if span.get("cat") not in (None, "", "neutral"):
            continue
        pattern = str(span.get("app") or "").strip()
        if not pattern:
            continue
        if pattern in rules or _recently_asked(pattern, now):
            continue
        cost[pattern] = cost.get(pattern, 0) + int(span.get("sec") or 0)
        sample.setdefault(pattern, str(span.get("title") or ""))

    ranked = sorted(cost.items(), key=lambda kv: -kv[1])
    return [
        {"pattern": p, "seconds": s, "example": sample.get(p, "")}
        for p, s in ranked
        if s >= MIN_SECONDS_TO_ASK
    ][:MAX_QUESTIONS_PER_DAY]


def apply_rules(spans: list[dict]) -> list[dict]:
    """Re-categorise spans using the answers already given.

    Applied on read rather than rewritten into the log: the recording stays a
    record of what happened, and the interpretation stays changeable.
    """
    rules = load_rules()
    out = []
    for span in spans:
        row = dict(span)
        rule = rules.get(str(row.get("app") or ""))
        if rule and row.get("cat") in (None, "", "neutral"):
            row["cat"] = rule.get("category") or row.get("cat")
            if rule.get("client"):
                row["client"] = rule["client"]
        out.append(row)
    return out


def coverage(spans: list[dict]) -> float:
    """Share of seconds that carry a real category. The number this epic moves.

    Measured at 51% when the queue was designed; the target is above 85%.
    """
    total = sum(int(s.get("sec") or 0) for s in spans)
    if total <= 0:
        return 1.0
    known = sum(
        int(s.get("sec") or 0)
        for s in spans
        if s.get("cat") not in (None, "", "neutral")
    )
    return known / total
