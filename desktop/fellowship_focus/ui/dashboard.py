"""Dashboard — KPIs, OKRs, guild ladder preview (web parity)."""

from PySide6.QtGui import QFont
from PySide6.QtWidgets import (
    QGridLayout,
    QHBoxLayout,
    QLabel,
    QProgressBar,
    QPushButton,
    QVBoxLayout,
    QWidget,
)

from fellowship_focus.ui.components import GlassCard, KpiCard, PageHeader, PageScaffold
from fellowship_focus.ui.theme import font_display, font_sans


def _okr_row(label: str, current: float, target: float, unit: str = "") -> QWidget:
    row = QWidget()
    layout = QVBoxLayout(row)
    layout.setContentsMargins(0, 0, 0, 8)
    pct = min(100, int((current / target) * 100)) if target > 0 else 0
    header = QHBoxLayout()
    lbl = QLabel(label)
    lbl.setFont(font_sans(12, QFont.Weight.Medium))
    header.addWidget(lbl)
    header.addStretch()
    val = QLabel(f"{current:g}{unit} / {target:g}{unit} ({pct}%)")
    val.setStyleSheet("color: #9ca3af; font-size: 11px;")
    header.addWidget(val)
    layout.addLayout(header)
    bar = QProgressBar()
    bar.setRange(0, 100)
    bar.setValue(pct)
    bar.setFixedHeight(4)
    layout.addWidget(bar)
    return row


class DashboardPage(QWidget):
    def __init__(self, on_start_pomo, on_open_web) -> None:
        super().__init__()
        self._on_start_pomo = on_start_pomo
        self._on_open_web = on_open_web

        root = QVBoxLayout(self)
        root.setContentsMargins(0, 0, 0, 0)

        scaffold = PageScaffold()

        kpi_grid = QGridLayout()
        kpi_grid.setSpacing(14)
        self.kpi_focus = KpiCard("Focus today", "—", "minutes")
        self.kpi_xp = KpiCard("Weekly net XP", "—", "ladder score")
        self.kpi_habits = KpiCard("Habits", "—", "monthly rate")
        self.kpi_streak = KpiCard("Streak", "—", "days")
        kpi_host = QWidget()
        kpi_host.setLayout(kpi_grid)
        for i, w in enumerate([self.kpi_focus, self.kpi_xp, self.kpi_habits, self.kpi_streak]):
            kpi_grid.addWidget(w, 0, i)
        scaffold.add(kpi_host)

        okr_card = GlassCard()
        okr_layout = QVBoxLayout(okr_card)
        okr_layout.setContentsMargins(20, 18, 20, 18)
        okr_layout.addWidget(PageHeader("Weekly OKRs", "Freelance productivity loop — track like PERSO.xlsx"))
        self.okr_focus = _okr_row("Focus hours", 0, 20, "h")
        self.okr_habits = _okr_row("Habit completion", 0, 80, "%")
        self.okr_revenue = _okr_row("Freelance revenue", 0, 3000, "€")
        okr_layout.addWidget(self.okr_focus)
        okr_layout.addWidget(self.okr_habits)
        okr_layout.addWidget(self.okr_revenue)
        scaffold.add(okr_card)

        guild_card = GlassCard()
        guild_layout = QVBoxLayout(guild_card)
        guild_layout.setContentsMargins(20, 18, 20, 18)
        guild_layout.addWidget(PageHeader("Guild Ladder", "Top 5 this week"))
        self.ladder_label = QLabel("Join a Fellowship to see your clan ranking.")
        self.ladder_label.setWordWrap(True)
        self.ladder_label.setFont(font_sans(12))
        self.ladder_label.setObjectName("mutedLabel")
        guild_layout.addWidget(self.ladder_label)
        self.journey_label = QLabel("")
        self.journey_label.setWordWrap(True)
        self.journey_label.setFont(font_sans(11))
        self.journey_label.setObjectName("mutedLabel")
        guild_layout.addWidget(self.journey_label)
        scaffold.add(guild_card)

        stakes_card = GlassCard()
        stakes_layout = QVBoxLayout(stakes_card)
        stakes_layout.setContentsMargins(20, 16, 20, 16)
        stakes_layout.addWidget(PageHeader("Ring Deposit", "Bet with your guild via Escrow — auto-verified focus + habits"))
        self.stakes_label = QLabel(
            "Configure stakes on the web dashboard. Winners split the pot each Sunday."
        )
        self.stakes_label.setWordWrap(True)
        self.stakes_label.setObjectName("mutedLabel")
        stakes_layout.addWidget(self.stakes_label)
        scaffold.add(stakes_card)

        actions = QHBoxLayout()
        start_btn = QPushButton("Start Focus Quest")
        start_btn.setObjectName("goldBtn")
        start_btn.setFont(font_sans(13, QFont.Weight.DemiBold))
        start_btn.clicked.connect(self._on_start_pomo)
        web_btn = QPushButton("Open Web Dashboard")
        web_btn.setObjectName("ghostBtn")
        web_btn.clicked.connect(self._on_open_web)
        actions.addWidget(start_btn)
        actions.addWidget(web_btn)
        actions.addStretch()
        action_host = QWidget()
        action_host.setLayout(actions)
        scaffold.add(action_host)
        scaffold.add_stretch()

        root.addWidget(scaffold)

    def update_data(self, fellowship_data: dict | None, config: dict) -> None:
        if not fellowship_data:
            return

        stats = fellowship_data.get("stats", {})
        leaderboard = fellowship_data.get("leaderboard", [])
        habit_board = fellowship_data.get("habitLeaderboard", [])
        my_name = config.get("member_name", "")
        journey = fellowship_data.get("journey", {})

        self.kpi_focus.set_value(str(stats.get("totalMinutes", 0) // max(1, len(leaderboard) or 1)))
        me = next((m for m in leaderboard if m.get("name") == my_name), leaderboard[0] if leaderboard else None)
        if me:
            self.kpi_xp.set_value(str(me.get("weekly_net", 0)), me.get("league", "Shire"))
            self.kpi_streak.set_value(f"{me.get('streak', 0)}d")
        me_h = next((h for h in habit_board if h.get("name") == my_name), habit_board[0] if habit_board else None)
        if me_h:
            self.kpi_habits.set_value(f"{me_h.get('completion_rate', 0)}%")

        focus_target = config.get("okr_weekly_focus_hours", 20)
        habit_target = config.get("okr_habit_rate", 80)
        revenue_target = config.get("okr_freelance_revenue_eur", 3000)
        focus_done = (stats.get("totalMinutes", 0) / 60) if stats else 0
        habit_done = me_h.get("completion_rate", 0) if me_h else 0
        revenue_done = config.get("okr_revenue_current_eur", 0)
        self._set_okr(self.okr_focus, focus_done, focus_target, "h")
        self._set_okr(self.okr_habits, habit_done, habit_target, "%")
        self._set_okr(self.okr_revenue, revenue_done, revenue_target, "€")

        if leaderboard:
            lines = []
            for i, m in enumerate(leaderboard[:5]):
                rank = f"{i + 1}."
                you = " (you)" if m.get("name") == my_name else ""
                lines.append(
                    f"{rank} {m['name']}{you} — {m.get('weekly_net', 0)} net XP · {m.get('league', '')}"
                )
            self.ladder_label.setText("\n".join(lines))

        wp = journey.get("currentWaypoint", {})
        self.journey_label.setText(
            f"{wp.get('name', 'Bag End')} — {fellowship_data.get('totalXp', 0):,} XP · "
            f"{journey.get('progress', 0)}% to next waypoint"
        )

    def _set_okr(self, row: QWidget, current: float, target: float, unit: str) -> None:
        labels = row.findChildren(QLabel)
        bar = row.findChildren(QProgressBar)
        pct = min(100, int((current / target) * 100)) if target > 0 else 0
        if len(labels) >= 2:
            labels[1].setText(f"{current:g}{unit} / {target:g}{unit} ({pct}%)")
        if bar:
            bar[0].setValue(pct)
