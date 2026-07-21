"""Screen time page — today's app usage, categories and focus score."""

from __future__ import annotations

from PySide6.QtCore import Qt
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

from fellowship_focus.ui.components import (
    GlassCard,
    KpiCard,
    MutedLabel,
    PageHeader,
    PageScaffold,
    ToggleSwitch,
)
from fellowship_focus.ui.theme import ACCENT, BORDER, MUTED, RED, SUCCESS, WARNING, font_sans
from fellowship_focus.usage_tracker import CATEGORIES, focus_score

CATEGORY_META = {
    "work": ("Work", SUCCESS),
    "distraction": ("Distraction", RED),
    "personal": ("Personal", WARNING),
    "neutral": ("Neutral", MUTED),
}


def _fmt_duration(seconds: int) -> str:
    seconds = int(seconds)
    hours, rem = divmod(seconds, 3600)
    minutes = rem // 60
    if hours:
        return f"{hours}h {minutes:02d}m"
    if minutes:
        return f"{minutes}m"
    return f"{seconds}s"


class _BarRow(QWidget):
    """A labeled horizontal bar (app name · duration · proportion)."""

    def __init__(self, label: str, seconds: int, total: int, color: str) -> None:
        super().__init__()
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(3)

        top = QHBoxLayout()
        top.setContentsMargins(0, 0, 0, 0)
        name = QLabel(label)
        name.setFont(font_sans(12, QFont.Weight.Medium))
        dur = MutedLabel(_fmt_duration(seconds))
        dur.setFont(font_sans(11))
        top.addWidget(name, 1)
        top.addWidget(dur, 0, Qt.AlignmentFlag.AlignRight)
        layout.addLayout(top)

        bar = QProgressBar()
        bar.setTextVisible(False)
        bar.setFixedHeight(6)
        bar.setRange(0, max(1, total))
        bar.setValue(seconds)
        bar.setStyleSheet(
            f"QProgressBar{{background:{BORDER};border:none;border-radius:3px;}}"
            f"QProgressBar::chunk{{background:{color};border-radius:3px;}}"
        )
        layout.addWidget(bar)


class UsagePage(PageScaffold):
    """Read-only dashboard fed by the background UsageTracker."""

    def __init__(
        self, tracker, config=None, save_config_cb=None, parent: QWidget | None = None
    ) -> None:
        super().__init__(parent)
        self._tracker = tracker
        self._config = config if config is not None else {}
        self._save = save_config_cb

        header_row = QHBoxLayout()
        header_row.addWidget(
            PageHeader("Screen time", "Where your day actually goes — tracked in the background"),
            1,
        )
        self.enable_toggle = ToggleSwitch()
        self.enable_toggle.setToolTip("Track foreground app usage in the background")
        self.enable_toggle.setChecked(
            bool(self._config.get("screen_time_enabled", True)), animate=False
        )
        self.enable_toggle.toggled.connect(self._on_enable_toggled)
        header_row.addWidget(self.enable_toggle, 0, Qt.AlignmentFlag.AlignTop)
        self.refresh_btn = QPushButton("Refresh")
        self.refresh_btn.setObjectName("ghostBtn")
        self.refresh_btn.clicked.connect(self.refresh)
        header_row.addWidget(self.refresh_btn, 0, Qt.AlignmentFlag.AlignTop)
        header_wrap = QWidget()
        header_wrap.setLayout(header_row)
        self.add(header_wrap)

        kpi_row = QGridLayout()
        kpi_row.setSpacing(12)
        self.kpi_total = KpiCard("Active today", "—", "time at the keyboard")
        self.kpi_work = KpiCard("Focused work", "—", "productive apps")
        self.kpi_distraction = KpiCard("Distraction", "—", "time bleed")
        self.kpi_score = KpiCard("Focus score", "—", "work vs distraction")
        for i, card in enumerate(
            (self.kpi_total, self.kpi_work, self.kpi_distraction, self.kpi_score)
        ):
            kpi_row.addWidget(card, 0, i)
        kpi_wrap = QWidget()
        kpi_wrap.setLayout(kpi_row)
        self.add(kpi_wrap)

        self.category_card = GlassCard()
        self._category_layout = QVBoxLayout(self.category_card)
        self._category_layout.setContentsMargins(20, 18, 20, 18)
        self._category_layout.setSpacing(10)
        self._category_layout.addWidget(PageHeader("By category", ""))
        self.add(self.category_card)

        self.apps_card = GlassCard()
        self._apps_layout = QVBoxLayout(self.apps_card)
        self._apps_layout.setContentsMargins(20, 18, 20, 18)
        self._apps_layout.setSpacing(10)
        self._apps_layout.addWidget(PageHeader("Top apps", ""))
        self.add(self.apps_card)

        self.add_stretch()
        self.refresh()

    def _on_enable_toggled(self, on: bool) -> None:
        self._config["screen_time_enabled"] = bool(on)
        if self._save:
            try:
                self._save(self._config)
            except Exception:
                pass
        if self._tracker:
            if on:
                self._tracker.start()
            else:
                self._tracker.stop()

    def _clear_dynamic(self, layout: QVBoxLayout) -> None:
        # Keep the first widget (the PageHeader), drop the rest.
        while layout.count() > 1:
            item = layout.takeAt(1)
            w = item.widget()
            if w is not None:
                w.deleteLater()

    def refresh(self) -> None:
        data = self._tracker.today() if self._tracker else {"apps": {}, "categories": {}}
        cats = data.get("categories", {})
        apps = data.get("apps", {})

        total = sum(int(v) for v in cats.values()) or sum(int(v) for v in apps.values())
        work = int(cats.get("work", 0))
        distraction = int(cats.get("distraction", 0))
        score = focus_score(data)

        self.kpi_total.set_value(_fmt_duration(total))
        self.kpi_work.set_value(_fmt_duration(work))
        self.kpi_distraction.set_value(_fmt_duration(distraction))
        self.kpi_score.set_value(f"{score}%")

        self._clear_dynamic(self._category_layout)
        if total <= 0:
            self._category_layout.addWidget(
                MutedLabel("No activity tracked yet today. Keep working — this fills in live.")
            )
        else:
            for cat in CATEGORIES:
                label, color = CATEGORY_META[cat]
                seconds = int(cats.get(cat, 0))
                if seconds <= 0:
                    continue
                self._category_layout.addWidget(_BarRow(label, seconds, total, color))

        self._clear_dynamic(self._apps_layout)
        ranked = sorted(apps.items(), key=lambda kv: int(kv[1]), reverse=True)[:10]
        if not ranked:
            self._apps_layout.addWidget(MutedLabel("Nothing yet."))
        else:
            app_total = max(int(v) for _, v in ranked)
            for label, seconds in ranked:
                self._apps_layout.addWidget(_BarRow(label, int(seconds), app_total, ACCENT))
