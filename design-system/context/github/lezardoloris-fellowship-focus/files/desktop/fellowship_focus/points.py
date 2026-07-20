"""XP economy — mirrors web/src/lib/points.ts"""

BLOCK_BASE_PENALTY = 10
BLOCK_REPEAT_BONUS = 5
BLOCK_MAX_PENALTY = 30
BLOCK_FELLOWSHIP_TAX = 3

XP_PER_FOCUS_MINUTE = 1
DAILY_QUEST_MINUTES = 25
DAILY_QUEST_BONUS = 10
SESSION_COMPLETE_BONUS = 5
ZERO_BLOCKS_SESSION_BONUS = 15
STREAK_BONUS_EVERY_7_DAYS = 50


def calc_block_penalty(recent_block_count: int) -> int:
    penalty = BLOCK_BASE_PENALTY + recent_block_count * BLOCK_REPEAT_BONUS
    return min(penalty, BLOCK_MAX_PENALTY)


def calc_session_xp(minutes: int, completed: bool, had_blocks: bool) -> int:
    xp = minutes * XP_PER_FOCUS_MINUTE if completed else max(0, minutes // 2)
    if completed:
        xp += SESSION_COMPLETE_BONUS
    if completed and minutes >= DAILY_QUEST_MINUTES:
        xp += DAILY_QUEST_BONUS
    if completed and not had_blocks:
        xp += ZERO_BLOCKS_SESSION_BONUS
    return xp
