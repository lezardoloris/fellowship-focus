"""Dashboard — KPIs, OKRs, guild ladder preview (web parity)."""

from PySide6.QtGui import QFont
from PySide6.QtCore import Qt
from PySide6.QtGui import QPixmap
from PySide6.QtWidgets import (
    QGridLayout,
    QHBoxLayout,
    QLabel,
    QProgressBar,
    QPushButton,
    QScrollArea,
    QVBoxLayout,
    QWidget,
)

from fellowship_focus.ui.theme import ASSETS_DIR, font_display, font_sans


def _kpi_card(title: str, value: str, subtitle: str = "") -> QWidget:
    card = QWidget()
    card.setObjectName("kpiCard")
    layout = QVBoxLayout(card)
    layout.setContentsMargins(16, 14, 16, 14)
    t = QLabel(title.upper())
    t.setObjectName("kpiLabel")
    t.setFont(font_sans(10))
    v = QLabel(value)
    v.setObjectName("kpiValue")
    v.setFont(font_display(26, bold=True))
    layout.addWidget(t)
    layout.addWidget(v)
    if subtitle:
        s = QLabel(subtitle)
        s.setStyleSheet("color: #666; font-size: 11px;")
        s.setFont(font_sans(11))
        layout.addWidget(s)
    return card


def _okr_row(label: str, current: float, target: float, unit: str = "") -> QWidget:
    row = QWidget()
    layout = QVBoxLayout(row)
    layout.setContentsMargins(0, 0, 0, 8)
    pct = min(100, int((current / target) * 100)) if target > 0 else 0
    header = QHBoxLayout()
    header.addWidget(QLabel(label))
    header.addStretch()
    val = QLabel(f"{current:g}{unit} / {target:g}{unit} ({pct}%)")
    val.setStyleSheet("color: #d4af37; font-size: 11px;")
    header.addWidget(val)
    layout.addLayout(header)
    bar = QProgressBar()
    bar.setRange(0, 100)
    bar.setValue(pct)
    bar.setFixedHeight(8)
    layout.addWidget(bar)
    return row


class DashboardPage(QWidget):
    def __init__(self, on_start_pomo, on_open_web) -> None:
        super().__init__()
        self._on_start_pomo = on_start_pomo
        self._on_open_web = on_open_web

        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QScrollArea.Shape.NoFrame)
        scroll.setStyleSheet("background: transparent; border: none;")

        content = QWidget()
        root = QVBoxLayout(content)
        root.setContentsMargins(20, 16, 20, 20)
        root.setSpacing(16)

        # Hero banner
        hero_wrap = QWidget()
        hero_wrap.setFixedHeight(140)
        hero_wrap.setStyleSheet("border-radius: 14px;")
        hero_l = QVBoxLayout(hero_wrap)
        hero_l.setContentsMargins(0, 0, 0, 0)
        self.hero_label = QLabel()
        self.hero_label.setScaledContents(True)
        self.hero_label.setFixedHeight(140)
        hero_path = ASSETS_DIR / "journey-map.jpg"
        if hero_path.exists():
            self.hero_label.setPixmap(QPixmap(str(hero_path)))
        overlay = QLabel("Your Quest Dashboard", hero_wrap)
        overlay.setFont(font_display(20, bold=True))
        overlay.setStyleSheet(
            "background: rgba(6,8,6,0.7); color: #f0d878; padding: 16px 20px; border: none;"
        )
        overlay.setGeometry(0, 90, 800, 50)
        hero_l.addWidget(self.hero_label)
        root.addWidget(hero_wrap)

        # KPI grid
        kpi_grid = QGridLayout()
        kpi_grid.setSpacing(12)
        self.kpi_focus = _kpi_card("Focus today", "—", "minutes")
        self.kpi_xp = _kpi_card("Weekly net XP", "—", "ladder score")
        self.kpi_habits = _kpi_card("Habits", "—", "monthly rate")
        self.kpi_streak = _kpi_card("Streak", "—", "days")
        for i, w in enumerate([self.kpi_focus, self.kpi_xp, self.kpi_habits, self.kpi_streak]):
            kpi_grid.addWidget(w, 0, i)
        root.addLayout(kpi_grid)

        # OKRs
        okr_card = QWidget()
        okr_card.setObjectName("glassCard")
        okr_layout = QVBoxLayout(okr_card)
        okr_layout.setContentsMargins(18, 16, 18, 16)
        okr_title = QLabel("Weekly OKRs")
        okr_title.setObjectName("goldTitle")
        okr_title.setFont(font_display(16, bold=True))
        okr_layout.addWidget(okr_title)
        okr_sub = QLabel("Freelance productivity loop — track like PERSO.xlsx")
        okr_sub.setStyleSheet("color: #666; font-size: 11px; margin-bottom: 8px;")
        okr_layout.addWidget(okr_sub)
        self.okr_focus = _okr_row("Focus hours", 0, 20, "h")
        self.okr_habits = _okr_row("Habit completion", 0, 80, "%")
        self.okr_revenue = _okr_row("Freelance revenue", 0, 3000, "€")
        okr_layout.addWidget(self.okr_focus)
        okr_layout.addWidget(self.okr_habits)
        okr_layout.addWidget(self.okr_revenue)
        root.addWidget(okr_card)

        # Guild ladder preview
        guild_card = QWidget()
        guild_card.setObjectName("glassCard")
        guild_layout = QVBoxLayout(guild_card)
        guild_layout.setContentsMargins(18, 16, 18, 16)
        gtitle = QLabel("Guild Ladder")
        gtitle.setObjectName("goldTitle")
        gtitle.setFont(font_display(16, bold=True))
        guild_layout.addWidget(gtitle)
        self.ladder_label = QLabel("Join a Fellowship to see your clan ranking.")
        self.ladder_label.setWordWrap(True)
        self.ladder_label.setFont(font_sans(12))
        self.ladder_label.setStyleSheet("color: #aaa; line-height: 1.5;")
        guild_layout.addWidget(self.ladder_label)
        self.journey_label = QLabel("")
        self.journey_label.setWordWrap(True)
        self.journey_label.setFont(font_sans(11))
        self.journey_label.setStyleSheet("color: #666;")
        guild_layout.addWidget(self.journey_label)
        root.addWidget(guild_card)

        # Stakes hint
        stakes_card = QWidget()
        stakes_card.setObjectName("glassCard")
        stakes_layout = QVBoxLayout(stakes_card)
        stakes_layout.setContentsMargins(18, 14, 18, 14)
        st = QLabel("💰 Ring Deposit")
        st.setFont(font_display(14, bold=True))
        st.setStyleSheet("color: #d4af37;")
        stakes_layout.addWidget(st)
        self.stakes_label = QLabel(
            "Bet €5–50/week with your guild via Escrow. Auto-verified focus + habits."
        )
        self.stakes_label.setWordWrap(True)
        self.stakes_label.setStyleSheet("color: #888; font-size: 12px;")
        stakes_layout.addWidget(self.stakes_label)
        root.addWidget(stakes_card)

        # Quick actions
        actions = QHBoxLayout()
        start_btn = QPushButton("▶  Start Focus Quest")
        start_btn.setObjectName("goldBtn")
        start_btn.setFont(font_sans(13, QFont.Weight.DemiBold))
        start_btn.clicked.connect(self._on_start_pomo)
        web_btn = QPushButton("Open Web Dashboard")
        web_btn.clicked.connect(self._on_open_web)
        actions.addWidget(start_btn)
        actions.addWidget(web_btn)
        actions.addStretch()
        root.addLayout(actions)
        root.addStretch()

        scroll.setWidget(content)
        outer = QVBoxLayout(self)
        outer.setContentsMargins(0, 0, 0, 0)
        outer.addWidget(scroll)

    def update_data(self, fellowship_data: dict | None, config: dict) -> None:
        if not fellowship_data:
            return

        stats = fellowship_data.get("stats", {})
        leaderboard = fellowship_data.get("leaderboard", [])
        habit_board = fellowship_data.get("habitLeaderboard", [])
        my_name = config.get("member_name", "")
        journey = fellowship_data.get("journey", {})

        # KPIs
        self._set_kpi(self.kpi_focus, str(stats.get("totalMinutes", 0) // max(1, len(leaderboard) or 1)))
        me = next((m for m in leaderboard if m.get("name") == my_name), leaderboard[0] if leaderboard else None)
        if me:
            self._set_kpi(self.kpi_xp, str(me.get("weekly_net", 0)), me.get("league", "Shire"))
            self._set_kpi(self.kpi_streak, f"{me.get('streak', 0)}d")
        me_h = next((h for h in habit_board if h.get("name") == my_name), habit_board[0] if habit_board else None)
        if me_h:
            self._set_kpi(self.kpi_habits, f"{me_h.get('completion_rate', 0)}%")

        # OKRs from config
        focus_target = config.get("okr_weekly_focus_hours", 20)
        habit_target = config.get("okr_habit_rate", 80)
        revenue_target = config.get("okr_freelance_revenue_eur", 3000)
        focus_done = (stats.get("totalMinutes", 0) / 60) if stats else 0
        habit_done = me_h.get("completion_rate", 0) if me_h else 0
        revenue_done = config.get("okr_revenue_current_eur", 0)
        self._set_okr(self.okr_focus, focus_done, focus_target, "h")
        self._set_okr(self.okr_habits, habit_done, habit_target, "%")
        self._set_okr(self.okr_revenue, revenue_done, revenue_target, "€")

        # Ladder
        if leaderboard:
            lines = []
            for i, m in enumerate(leaderboard[:5]):
                medal = ["🥇", "🥈", "🥉", "4.", "5."][i]
                you = " (you)" if m.get("name") == my_name else ""
                lines.append(
                    f"{medal} {m['name']}{you} — {m.get('weekly_net', 0)} net XP · {m.get('league', '')}"
                )
            self.ladder_label.setText("\n".join(lines))

        wp = journey.get("currentWaypoint", {})
        self.journey_label.setText(
            f"📍 {wp.get('name', 'Bag End')} — {fellowship_data.get('totalXp', 0):,} XP · "
            f"{journey.get('progress', 0)}% to next waypoint"
        )

    def _set_kpi(self, card: QWidget, value: str, subtitle: str = "") -> None:
        labels = card.findChildren(QLabel)
        if len(labels) >= 2:
            labels[1].setText(value)
        if subtitle and len(labels) >= 3:
            labels[2].setText(subtitle)

    def _set_okr(self, row: QWidget, current: float, target: float, unit: str) -> None:
        labels = row.findChildren(QLabel)
        bar = row.findChildren(QProgressBar)
        pct = min(100, int((current / target) * 100)) if target > 0 else 0
        if len(labels) >= 2:
            labels[1].setText(f"{current:g}{unit} / {target:g}{unit} ({pct}%)")
        if bar:
            bar[0].setValue(pct)
