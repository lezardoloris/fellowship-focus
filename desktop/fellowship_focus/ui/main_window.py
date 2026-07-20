import sys
import webbrowser
from pathlib import Path

from PySide6.QtCore import Qt, QTimer
from PySide6.QtGui import QAction, QCloseEvent, QFont, QIcon
from PySide6.QtWidgets import (
    QApplication,
    QCheckBox,
    QComboBox,
    QFormLayout,
    QHBoxLayout,
    QInputDialog,
    QLabel,
    QLineEdit,
    QListWidget,
    QListWidgetItem,
    QMainWindow,
    QMessageBox,
    QPushButton,
    QSpinBox,
    QStackedWidget,
    QSystemTrayIcon,
    QTextEdit,
    QVBoxLayout,
    QWidget,
)

from fellowship_focus.activity_tracker import ActivityTracker
from fellowship_focus.api_client import FellowshipApi
from fellowship_focus.blocker.manager import (
    find_mitmdump,
    set_system_proxy,
    shutdown_mitmdump_gracefully,
    start_mitmdump,
)
from fellowship_focus.cert_setup import install_cert_windows, is_cert_installed, is_cert_generated
from fellowship_focus.config import load_config, save_config
from fellowship_focus.invite import apply_parsed_config, parse_invite_or_sync
from fellowship_focus.constants import DEFAULT_BLOCKED_SITES, DEFAULT_PATH_RULES, DEFAULT_REDIRECTS, HARD_HOSTS_OPTIONAL
from fellowship_focus.notifications import (
    notify,
    notify_back_to_focus,
    notify_blocker_penalty,
    notify_break,
    notify_focus_started,
    notify_xp,
)
from fellowship_focus.pomodoro_engine import PomodoroEngine
from fellowship_focus.proof_worker import ProofWorker
from fellowship_focus.startup import is_startup_enabled, set_startup_enabled
from fellowship_focus.tasks import (
    add_task,
    delete_task,
    format_time,
    get_task,
    load_tasks,
    update_task,
)
from fellowship_focus.ui.components import (
    FocusRing,
    GlassCard,
    NavSidebar,
    PageHeader,
    PageScaffold,
    StatusPill,
)
from fellowship_focus.ui.dashboard import DashboardPage
from fellowship_focus.ui.theme import ASSETS_DIR, app_stylesheet, font_sans, load_fonts
from fellowship_focus.ui.toast import ToastManager
from fellowship_focus.ui.web_dashboard import WebDashboardPage
from fellowship_focus.updater import apply_git_update, check_for_updates
from fellowship_focus.version import APP_VERSION


class MainWindow(QMainWindow):
    def __init__(self) -> None:
        super().__init__()
        self.config = load_config()
        self.mitm_process = None
        self.blocker_active = False
        self.selected_task_id: str | None = None
        self.task_timer_seconds = 0
        self.task_tick = QTimer()
        self.task_tick.timeout.connect(self._on_task_tick)

        self.pomodoro = PomodoroEngine()
        self.activity = ActivityTracker()
        self.proof_worker = ProofWorker(lambda: self.config, lambda: self.activity)
        self.proof_worker.proof_sent.connect(lambda app: self.toasts.show("Guild Trust", f"Proof · {app}", "success", 2000))
        self._active_session_id: str | None = None
        self._blocker_on_for_session = False
        self._prev_pomo_phase = PomodoroEngine.PHASE_IDLE
        self.pomodoro.tick.connect(self._on_pomo_tick)
        self.pomodoro.phase_changed.connect(self._on_pomo_phase)
        self.pomodoro.session_finished.connect(self._on_pomo_finished)

        self.setWindowTitle("Fellowship Focus")
        self.setMinimumSize(1080, 700)
        self.resize(1180, 780)
        load_fonts()
        self.setStyleSheet(app_stylesheet())
        self.setFont(font_sans())
        for icon_name in ("fellowship.ico", "app-icon.png", "fellowship.jpg"):
            icon_file = ASSETS_DIR / icon_name
            if icon_file.exists():
                self.setWindowIcon(QIcon(str(icon_file)))
                break

        self.toasts = ToastManager(self)
        self._fellowship_cache: dict | None = None
        self._phase_total_seconds = 45 * 60

        root = QWidget()
        self.setCentralWidget(root)
        outer = QHBoxLayout(root)
        outer.setContentsMargins(0, 0, 0, 0)
        outer.setSpacing(0)

        self.sidebar = NavSidebar()
        self.sidebar.changed.connect(self._on_nav)
        outer.addWidget(self.sidebar)

        right = QWidget()
        right.setObjectName("contentArea")
        right_layout = QVBoxLayout(right)
        right_layout.setContentsMargins(0, 0, 0, 0)
        right_layout.setSpacing(0)

        top = QWidget()
        top.setObjectName("topBar")
        top.setFixedHeight(48)
        top_row = QHBoxLayout(top)
        top_row.setContentsMargins(24, 0, 24, 0)
        self.page_title = QLabel("Fellowship")
        self.page_title.setObjectName("topBarTitle")
        self.page_title.setFont(font_sans(15, QFont.Weight.DemiBold))
        top_row.addWidget(self.page_title)
        top_row.addStretch()
        self.status_guild = StatusPill("Not connected", "neutral")
        self.status_blocker = StatusPill("Blocker standby", "neutral")
        top_row.addWidget(self.status_guild)
        top_row.addSpacing(8)
        top_row.addWidget(self.status_blocker)
        right_layout.addWidget(top)

        self.stack = QStackedWidget()
        right_layout.addWidget(self.stack, 1)
        outer.addWidget(right, 1)

        self.web_dashboard = WebDashboardPage(
            lambda: self.config,
            self._open_dashboard,
            self._on_web_config_updated,
        )
        self.stack.addWidget(self.web_dashboard)
        self.dashboard_page = DashboardPage(self._go_pomodoro, self._open_dashboard)
        self.stack.addWidget(self.dashboard_page)
        self._build_tasks_page()
        self._build_pomodoro_page()
        self._build_blocker_page()
        self._build_fellowship_page()

        self._init_tray()
        self._load_config_to_ui()
        self._refresh_tasks()
        self.sidebar.set_current(0)
        self._update_chrome_status()

        if not is_cert_installed():
            self.sidebar.set_current(4)
            QTimer.singleShot(
                800,
                lambda: self.toasts.show(
                    "Certificate needed",
                    "Install once in Blocker tab — then blocking works forever.",
                    "warning",
                ),
            )
        else:
            self.config["cert_setup_done"] = True
            save_config(self.config)
            QTimer.singleShot(
                600,
                lambda: self.toasts.show(
                    "Shield armed",
                    "Certificate ready — distraction sites blocked during focus.",
                    "success",
                    3500,
                ),
            )

        self._refresh_journey()
        self._sync_timer = QTimer(self)
        self._sync_timer.timeout.connect(self._refresh_journey)
        self._sync_timer.start(30000)

        QTimer.singleShot(2000, self._check_updates_silent)
        QTimer.singleShot(500, self.web_dashboard.reload_dashboard)

    def resizeEvent(self, event) -> None:
        super().resizeEvent(event)
        self.toasts.reposition()

    def _go_pomodoro(self) -> None:
        self.sidebar.set_current(3)
        self._start_pomodoro()

    def _style_pill(self, pill: QLabel, kind: str, text: str) -> None:
        pill.style().unpolish(pill)
        pill.setText(text)
        pill.setObjectName(f"statusPill_{kind}")
        pill.style().polish(pill)

    def _update_chrome_status(self) -> None:
        code = self.config.get("fellowship_code", "")
        name = self.config.get("member_name", "")
        if code and name:
            self._style_pill(self.status_guild, "active", f"{name} · {code}")
        elif code:
            self._style_pill(self.status_guild, "neutral", code)
        else:
            self._style_pill(self.status_guild, "neutral", "Not connected")

        if self.blocker_active:
            self._style_pill(self.status_blocker, "active", "Shield active")
        elif not is_cert_installed():
            self._style_pill(self.status_blocker, "warn", "Cert needed")
        else:
            self._style_pill(self.status_blocker, "neutral", "Blocker standby")
        self.sidebar.set_status(f"v{APP_VERSION}")

    def _check_updates_silent(self) -> None:
        if not self.config.get("auto_update", True):
            return
        info = check_for_updates()
        if info.available:
            self.toasts.show("Update available", info.message, "info", 8000)

    def _apply_update(self) -> None:
        ok, msg = apply_git_update()
        self.toasts.show("Update", msg, "success" if ok else "warning", 6000)

    def _check_updates_manual(self) -> None:
        info = check_for_updates()
        if info.available and info.can_auto_apply:
            self._apply_update()
        elif info.available:
            self.toasts.show(f"Update — v{info.latest}", info.message, "info", 8000)
            webbrowser.open(info.release_url)
        else:
            self.toasts.show("Up to date", info.message, "success", 3000)

    # ── Tasks ──────────────────────────────────────────────

    def _build_tasks_page(self) -> None:
        page = QWidget()
        layout = QVBoxLayout(page)
        layout.setContentsMargins(0, 0, 0, 0)

        scaffold = PageScaffold()
        header = QHBoxLayout()
        header.addStretch()
        for text, slot, style in [
            ("+", self._add_task, "iconBtn"),
            ("Edit", self._edit_task, ""),
            ("Delete", self._delete_task, "dangerBtn"),
        ]:
            btn = QPushButton(text)
            if style:
                btn.setObjectName(style)
            btn.clicked.connect(slot)
            header.addWidget(btn)
        header_wrap = QWidget()
        header_wrap.setLayout(header)
        scaffold.add(header_wrap)

        todo_card = GlassCard()
        todo_layout = QVBoxLayout(todo_card)
        todo_layout.setContentsMargins(18, 16, 18, 16)
        todo_layout.addWidget(PageHeader("To do", "Double-click a task to start focus"))
        self.todo_list = QListWidget()
        self.todo_list.setObjectName("taskList")
        self.todo_list.itemClicked.connect(self._select_task)
        self.todo_list.itemDoubleClicked.connect(lambda _: self._start_task_pomodoro())
        todo_layout.addWidget(self.todo_list)
        scaffold.add(todo_card)

        done_card = GlassCard()
        done_layout = QVBoxLayout(done_card)
        done_layout.setContentsMargins(18, 16, 18, 16)
        done_layout.addWidget(PageHeader("Completed"))
        self.done_list = QListWidget()
        self.done_list.setObjectName("taskList")
        done_layout.addWidget(self.done_list)
        scaffold.add(done_card)

        self.play_task_btn = QPushButton("Start Focus Quest on selected task")
        self.play_task_btn.setObjectName("primaryBtn")
        self.play_task_btn.setMaximumWidth(320)
        self.play_task_btn.clicked.connect(self._start_task_pomodoro)
        scaffold.add(self.play_task_btn)
        scaffold.add_stretch()

        layout.addWidget(scaffold)
        self.stack.addWidget(page)

    def _refresh_tasks(self) -> None:
        self.todo_list.clear()
        self.done_list.clear()
        tasks = load_tasks()
        roots = [t for t in tasks if not t.get("parent_id")]
        for root in roots:
            self._add_task_item(self.todo_list if not root["completed"] else self.done_list, root, tasks, 0)
        if self.selected_task_id:
            for i in range(self.todo_list.count()):
                item = self.todo_list.item(i)
                if item.data(Qt.ItemDataRole.UserRole) == self.selected_task_id:
                    self.todo_list.setCurrentItem(item)
                    break

    def _add_task_item(self, widget: QListWidget, task: dict, all_tasks: list, depth: int) -> None:
        indent = "    " * depth
        spent = format_time(task.get("time_spent_seconds", 0))
        est = task.get("estimate_minutes", 0)
        est_str = f"{est:02d}:00:00" if est else "00:00:00"
        text = f"{indent}{task['title']}     {spent} / {est_str}"
        item = QListWidgetItem(text)
        item.setData(Qt.ItemDataRole.UserRole, task["id"])
        widget.addItem(item)
        children = [t for t in all_tasks if t.get("parent_id") == task["id"]]
        for child in children:
            self._add_task_item(widget, child, all_tasks, depth + 1)

    def _select_task(self, item: QListWidgetItem) -> None:
        self.selected_task_id = item.data(Qt.ItemDataRole.UserRole)

    def _add_task(self) -> None:
        title, ok = QInputDialog.getText(self, "New Task", "Task name:")
        if ok and title.strip():
            parent = self.selected_task_id if self.selected_task_id else None
            task = add_task(title.strip(), parent)
            self.selected_task_id = task["id"]
            self._refresh_tasks()

    def _edit_task(self) -> None:
        if not self.selected_task_id:
            return
        task = get_task(self.selected_task_id)
        if not task:
            return
        title, ok = QInputDialog.getText(self, "Edit Task", "Task name:", text=task["title"])
        if ok and title.strip():
            update_task(self.selected_task_id, title=title.strip())
            self._refresh_tasks()

    def _delete_task(self) -> None:
        if not self.selected_task_id:
            return
        if QMessageBox.question(self, "Delete", "Delete task and subtasks?") == QMessageBox.StandardButton.Yes:
            delete_task(self.selected_task_id)
            self.selected_task_id = None
            self._refresh_tasks()

    def _start_task_pomodoro(self) -> None:
        if not self.selected_task_id:
            QMessageBox.information(self, "Tasks", "Select a task first.")
            return
        self.sidebar.set_current(3)
        self._start_pomodoro()

    def _on_task_tick(self) -> None:
        if self.selected_task_id and self.pomodoro.is_work_phase:
            self.task_timer_seconds += 1
            if self.task_timer_seconds % 10 == 0:
                task = get_task(self.selected_task_id)
                if task:
                    update_task(
                        self.selected_task_id,
                        time_spent_seconds=task.get("time_spent_seconds", 0) + 10,
                    )

    # ── Pomodoro ───────────────────────────────────────────

    def _build_pomodoro_page(self) -> None:
        page = QWidget()
        root = QHBoxLayout(page)
        root.setContentsMargins(24, 20, 24, 24)
        root.setSpacing(20)

        left = QVBoxLayout()

        self.current_task_label = QLabel("No task selected")
        self.current_task_label.setObjectName("mutedLabel")
        self.current_task_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        left.addWidget(self.current_task_label)

        self.focus_ring = FocusRing()
        left.addWidget(self.focus_ring, 1)

        self.waypoint_label = QLabel("")
        self.waypoint_label.setObjectName("mutedLabel")
        self.waypoint_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.waypoint_label.setWordWrap(True)
        left.addWidget(self.waypoint_label)

        btn_row = QHBoxLayout()
        self.pomo_start_btn = QPushButton("Start Quest")
        self.pomo_start_btn.setObjectName("goldBtn")
        self.pomo_start_btn.clicked.connect(self._start_pomodoro)
        self.pomo_pause_btn = QPushButton("Pause")
        self.pomo_pause_btn.setObjectName("ghostBtn")
        self.pomo_pause_btn.clicked.connect(self._pause_pomodoro)
        self.pomo_pause_btn.setEnabled(False)
        self.pomo_stop_btn = QPushButton("Stop")
        self.pomo_stop_btn.setObjectName("dangerBtn")
        self.pomo_stop_btn.clicked.connect(self._stop_pomodoro)
        self.pomo_stop_btn.setEnabled(False)
        self.pomo_skip_btn = QPushButton("Skip")
        self.pomo_skip_btn.clicked.connect(self.pomodoro.skip)
        self.pomo_skip_btn.setEnabled(False)
        for b in [self.pomo_start_btn, self.pomo_pause_btn, self.pomo_stop_btn, self.pomo_skip_btn]:
            btn_row.addWidget(b)
        left.addLayout(btn_row)
        root.addLayout(left, 3)

        settings_card = GlassCard()
        settings_card.setFixedWidth(300)
        settings_layout = QVBoxLayout(settings_card)
        settings_layout.setContentsMargins(20, 18, 20, 18)
        settings_layout.addWidget(PageHeader("Session", "Default 45 min work / 10 min break"))
        form = QFormLayout()
        self.work_spin = QSpinBox()
        self.work_spin.setRange(1, 120)
        self.break_spin = QSpinBox()
        self.break_spin.setRange(1, 60)
        self.long_break_spin = QSpinBox()
        self.long_break_spin.setRange(1, 60)
        self.intervals_spin = QSpinBox()
        self.intervals_spin.setRange(1, 10)
        for w in [self.work_spin, self.break_spin, self.long_break_spin, self.intervals_spin]:
            w.setSuffix(" min")
        form.addRow("Work", self.work_spin)
        form.addRow("Break", self.break_spin)
        form.addRow("Long break", self.long_break_spin)
        form.addRow("Intervals", self.intervals_spin)
        settings_layout.addLayout(form)
        save_pomo = QPushButton("Save durations")
        save_pomo.setObjectName("ghostBtn")
        save_pomo.clicked.connect(self._save_pomo_settings)
        settings_layout.addWidget(save_pomo)
        settings_layout.addStretch()
        root.addWidget(settings_card, 1)

        self.stack.addWidget(page)
        self._sync_focus_ring("45:00", "Ready", 1.0, False)

    def _save_pomo_settings(self) -> None:
        self.config.update({
            "work_duration": self.work_spin.value(),
            "break_duration": self.break_spin.value(),
            "long_break_duration": self.long_break_spin.value(),
            "work_intervals": self.intervals_spin.value(),
        })
        save_config(self.config)
        self.pomodoro.configure(
            self.work_spin.value(),
            self.break_spin.value(),
            self.long_break_spin.value(),
            self.intervals_spin.value(),
        )

    def _start_pomodoro(self) -> None:
        if self.pomodoro.is_running:
            return
        if self.config.get("enable_website_blocker", True) and not self._ensure_blocker_ready():
            return
        self._save_pomo_settings()
        if self.selected_task_id:
            task = get_task(self.selected_task_id)
            self.current_task_label.setText(f"Working on: {task['title']}" if task else "")
        self.task_timer_seconds = 0
        self.task_tick.start(1000)
        self.pomodoro.start_work()
        self._set_pomo_buttons(running=True)
        api = FellowshipApi(self.config.get("api_url", ""), self.config.get("member_token", ""))
        self._active_session_id = api.start_session()
        self._blocker_on_for_session = False
        if self._active_session_id:
            self.proof_worker.start(self._active_session_id)
        self.activity.start()

    def _pause_pomodoro(self) -> None:
        paused = self.pomodoro.pause_resume()
        self.pomo_pause_btn.setText("Resume" if paused else "Pause")
        if paused:
            self.task_tick.stop()
            self.proof_worker.stop()
            self._disable_blocker()
        elif self.pomodoro.is_work_phase:
            self.task_tick.start(1000)
            if self._active_session_id:
                self.proof_worker.start(self._active_session_id)
            if self.config.get("enable_website_blocker", True):
                self._enable_blocker()

    def _stop_pomodoro(self) -> None:
        self.proof_worker.stop()
        self.activity.stop()
        self._active_session_id = None
        self.task_tick.stop()
        if self.selected_task_id and self.task_timer_seconds > 0:
            task = get_task(self.selected_task_id)
            if task:
                update_task(
                    self.selected_task_id,
                    time_spent_seconds=task.get("time_spent_seconds", 0) + self.task_timer_seconds,
                )
                self.task_timer_seconds = 0
                self._refresh_tasks()
        self.pomodoro.stop()
        self._disable_blocker()
        self._set_pomo_buttons(running=False)
        self._sync_focus_ring(f"{self.work_spin.value():02d}:00", "Ready", 1.0, False)

    def _sync_focus_ring(self, time_text: str, phase: str, progress: float, active: bool) -> None:
        if hasattr(self, "focus_ring"):
            self.focus_ring.set_state(time_text, phase, progress, active)

    def _phase_total(self, phase: str) -> int:
        if phase == PomodoroEngine.PHASE_WORK:
            return self.pomodoro.work_minutes * 60
        if phase == PomodoroEngine.PHASE_LONG_BREAK:
            return self.pomodoro.long_break_minutes * 60
        if phase == PomodoroEngine.PHASE_BREAK:
            return self.pomodoro.break_minutes * 60
        return self.work_spin.value() * 60

    def _set_pomo_buttons(self, running: bool) -> None:
        self.pomo_start_btn.setEnabled(not running)
        self.pomo_pause_btn.setEnabled(running)
        self.pomo_stop_btn.setEnabled(running)
        self.pomo_skip_btn.setEnabled(running)
        self.pomo_pause_btn.setText("Pause")

    def _on_pomo_tick(self, remaining: int, phase: str) -> None:
        m, s = divmod(remaining, 60)
        total = max(1, self._phase_total(self.pomodoro.phase))
        progress = remaining / total if total else 0
        active = self.pomodoro.is_running and self.pomodoro.phase != PomodoroEngine.PHASE_IDLE
        self._sync_focus_ring(f"{m:02d}:{s:02d}", phase, progress, active)

    def _on_pomo_phase(self, phase: str) -> None:
        prev = self._prev_pomo_phase
        self._prev_pomo_phase = phase

        if prev == PomodoroEngine.PHASE_WORK and phase in (
            PomodoroEngine.PHASE_BREAK,
            PomodoroEngine.PHASE_LONG_BREAK,
        ):
            mins = self.config.get("work_duration", 45)
            msg = f"{mins} min focus complete — take a break."
            self.toasts.show("Quest interval done", msg, "success", 6000)
            notify_break(msg, getattr(self, "tray", None))
        elif prev in (PomodoroEngine.PHASE_BREAK, PomodoroEngine.PHASE_LONG_BREAK) and phase == PomodoroEngine.PHASE_WORK:
            msg = "Break over — distractions blocked again."
            self.toasts.show("Back to focus", msg, "info", 5000)
            notify_back_to_focus(getattr(self, "tray", None))
        elif phase == PomodoroEngine.PHASE_WORK and prev == PomodoroEngine.PHASE_IDLE:
            mins = self.config.get("work_duration", 45)
            notify_focus_started(mins, getattr(self, "tray", None), self._dashboard_url())

        if phase == PomodoroEngine.PHASE_WORK and self.config.get("enable_website_blocker", True):
            self._enable_blocker()
        else:
            self._disable_blocker()

    def _on_pomo_finished(self, completed: bool, work_minutes: int) -> None:
        self.proof_worker.stop()
        activity_score = self.activity.stop()
        self._disable_blocker()
        self._set_pomo_buttons(running=False)
        self._blocker_on_for_session = False
        if work_minutes > 0:
            api = FellowshipApi(self.config.get("api_url", ""), self.config.get("member_token", ""))
            result = api.log_session(work_minutes, completed, self._active_session_id, activity_score)
            self._active_session_id = None
            xp = result.get("xpEarned", 0) if result else 0
            if completed and xp:
                self.toasts.show("Quest complete!", f"+{xp} XP earned", "success")
                notify_xp(xp, getattr(self, "tray", None), self._dashboard_url())
        self._refresh_journey()

    # ── Website Blocker ────────────────────────────────────

    def _build_blocker_page(self) -> None:
        page = QWidget()
        layout = QVBoxLayout(page)
        layout.setContentsMargins(0, 0, 0, 0)

        scaffold = PageScaffold()

        status_card = GlassCard()
        status_layout = QVBoxLayout(status_card)
        status_layout.setContentsMargins(20, 18, 20, 18)
        status_layout.addWidget(PageHeader("Status", "Install certificate once — permanent on Windows"))
        self.blocker_status = QLabel("")
        self.blocker_status.setObjectName("mutedLabel")
        self.blocker_status.setWordWrap(True)
        status_layout.addWidget(self.blocker_status)
        cert_row = QHBoxLayout()
        gen_btn = QPushButton("Generate certificate")
        gen_btn.setObjectName("ghostBtn")
        gen_btn.clicked.connect(self._generate_cert)
        inst_btn = QPushButton("Install certificate")
        inst_btn.setObjectName("goldBtn")
        inst_btn.clicked.connect(self._install_cert)
        cert_row.addWidget(gen_btn)
        cert_row.addWidget(inst_btn)
        status_layout.addLayout(cert_row)

        pause_row = QHBoxLayout()
        pause_lbl = QLabel("Impulse pause (timed unlock):")
        pause_lbl.setObjectName("mutedLabel")
        pause_row.addWidget(pause_lbl)
        for mins in (5, 15, 30):
            btn = QPushButton(f"{mins} min")
            btn.setObjectName("ghostBtn")
            btn.clicked.connect(lambda checked=False, m=mins: self._pause_blocker_timed(m))
            pause_row.addWidget(btn)
        status_layout.addLayout(pause_row)
        scaffold.add(status_card)

        rules_card = GlassCard()
        rules_layout = QVBoxLayout(rules_card)
        rules_layout.setContentsMargins(20, 18, 20, 18)
        rules_layout.addWidget(
            PageHeader("Rules", "Soft = Shorts/Reels only · Hard = full YouTube/Instagram")
        )
        self.blocker_enabled_check = QCheckBox(
            "Enable website blocker during focus sessions (optional — guild may penalize bypass)"
        )
        self.blocker_enabled_check.setChecked(True)
        rules_layout.addWidget(self.blocker_enabled_check)

        mode_row = QHBoxLayout()
        mode_row.addWidget(QLabel("Mode"))
        self.blocker_mode_combo = QComboBox()
        self.blocker_mode_combo.addItem("Soft — allow YouTube tutorials, block Shorts/Reels", "soft")
        self.blocker_mode_combo.addItem("Hard — block YouTube & Instagram entirely", "hard")
        mode_row.addWidget(self.blocker_mode_combo, 1)
        rules_layout.addLayout(mode_row)

        self.sites_edit = QTextEdit()
        self.sites_edit.setPlainText("\n".join(DEFAULT_BLOCKED_SITES))
        self.sites_edit.setMinimumHeight(200)
        rules_layout.addWidget(self.sites_edit)
        save_btn = QPushButton("Save blocker settings")
        save_btn.setObjectName("primaryBtn")
        save_btn.setMaximumWidth(240)
        save_btn.clicked.connect(self._save_blocker_settings)
        rules_layout.addWidget(save_btn)
        scaffold.add(rules_card)
        scaffold.add_stretch()

        layout.addWidget(scaffold)
        self.stack.addWidget(page)
        self._update_blocker_status()

    def _pause_blocker_timed(self, minutes: int) -> None:
        """Impulse Blocker pattern — timed pause during focus, then auto re-arm."""
        if not self.blocker_active and not self.pomodoro.is_work_phase:
            self.toasts.show("Pause", "Start a focus session first.", "info", 2500)
            return
        if self.blocker_active:
            self._disable_blocker(work_bypass=True)
            if self.blocker_active:
                return
        self.config["pause_blocker_minutes"] = minutes
        save_config(self.config)
        self.toasts.show(
            "Blocker paused",
            f"Sites unlocked for {minutes} min — then shield re-arms.",
            "warning",
            4000,
        )
        if not hasattr(self, "_pause_timer"):
            self._pause_timer = QTimer(self)
            self._pause_timer.setSingleShot(True)
            self._pause_timer.timeout.connect(self._resume_after_pause)
        self._pause_timer.start(minutes * 60_000)

    def _resume_after_pause(self) -> None:
        self.config["pause_blocker_minutes"] = 0
        save_config(self.config)
        if self.pomodoro.is_work_phase and self.config.get("enable_website_blocker", True):
            self._enable_blocker()
            self.toasts.show("Shield re-armed", "Focus pause ended — distractions blocked again.", "success", 4000)

    def _save_blocker_settings(self) -> None:
        sites = [s.strip() for s in self.sites_edit.toPlainText().splitlines() if s.strip()]
        was_enabled = self.config.get("enable_website_blocker", True)
        now_enabled = self.blocker_enabled_check.isChecked()
        if was_enabled and not now_enabled and self.pomodoro.is_work_phase and self.blocker_active:
            self._disable_blocker(work_bypass=True)
            if self.blocker_active:
                return
        self.config["blocked_sites"] = sites or DEFAULT_BLOCKED_SITES
        self.config["enable_website_blocker"] = now_enabled
        self.config["blocker_mode"] = self.blocker_mode_combo.currentData() or "soft"
        save_config(self.config)
        if self.blocker_active:
            self._disable_blocker()
            self._enable_blocker()
        QMessageBox.information(self, "Saved", "Blocker settings saved.")

    def _update_blocker_status(self) -> None:
        gen = "Ready" if is_cert_generated() else "Missing"
        inst = "Installed" if is_cert_installed() else "Install once"
        active = "Active during focus" if self.blocker_active else "Standby"
        mode = self.config.get("blocker_mode", "soft")
        self.blocker_status.setText(
            f"Certificate file: {gen}\nWindows trust store: {inst}\nBlocker: {active} · mode {mode}\n\n"
            "Soft mode blocks YouTube Shorts & Instagram Reels only (Curbox).\n"
            "Hard mode blocks full domains. Pause = Impulse timed unlock."
        )
        self._update_chrome_status()

    def _ensure_blocker_ready(self) -> bool:
        if not is_cert_installed():
            QMessageBox.warning(self, "Certificate", "Install mitmproxy certificate first (Blocker tab).")
            self.sidebar.set_current(4)
            return False
        if not find_mitmdump():
            QMessageBox.critical(self, "Error", "mitmdump not found.")
            return False
        return True

    def _effective_block_lists(self) -> tuple[list[str], list]:
        sites = list(self.config.get("blocked_sites", DEFAULT_BLOCKED_SITES))
        path_rules = list(self.config.get("blocked_path_rules", DEFAULT_PATH_RULES))
        mode = self.config.get("blocker_mode", "soft")
        if mode == "hard":
            for host in HARD_HOSTS_OPTIONAL:
                if host not in sites:
                    sites.append(host)
        else:
            # Soft: YouTube/Instagram only via path rules — remove from full list if present
            soft_hosts = set(HARD_HOSTS_OPTIONAL)
            sites = [s for s in sites if s not in soft_hosts]
        return sites, path_rules

    def _enable_blocker(self) -> None:
        if self.blocker_active:
            return
        sites, path_rules = self._effective_block_lists()
        redirects = self.config.get("block_redirects", DEFAULT_REDIRECTS)
        self.mitm_process = start_mitmdump(
            sites,
            self.config.get("api_url", ""),
            self.config.get("member_token", ""),
            path_rules=path_rules,
            redirects=redirects,
        )
        if self.mitm_process:
            set_system_proxy(True)
            self.blocker_active = True
            self._blocker_on_for_session = True
            self._update_blocker_status()

    def _guild_bypass_penalty(self) -> int:
        if not self._fellowship_cache:
            return 0
        f = self._fellowship_cache.get("fellowship", {})
        return int(f.get("blocker_bypass_penalty", 0) or 0)

    def _disable_blocker(self, *, work_bypass: bool = False) -> None:
        if not self.blocker_active:
            return
        if (
            work_bypass
            and self.pomodoro.is_work_phase
            and self._active_session_id
            and self._blocker_on_for_session
        ):
            penalty = self._guild_bypass_penalty()
            if penalty > 0:
                ans = QMessageBox.question(
                    self,
                    "Disable blocker?",
                    f"Your guild penalizes turning off the blocker during focus (−{penalty} XP).\n\nContinue anyway?",
                    QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
                )
                if ans != QMessageBox.StandardButton.Yes:
                    return
                api = FellowshipApi(self.config.get("api_url", ""), self.config.get("member_token", ""))
                result = api.bypass_blocker(self._active_session_id)
                if result and result.get("penalty"):
                    self.toasts.show(
                        "Blocker off",
                        f"−{result['penalty']} XP · guild accountability",
                        "warning",
                        5000,
                    )
                    notify_blocker_penalty(int(result["penalty"]), getattr(self, "tray", None))
                self._refresh_journey()
            elif self._active_session_id:
                api = FellowshipApi(self.config.get("api_url", ""), self.config.get("member_token", ""))
                api.bypass_blocker(self._active_session_id)
        shutdown_mitmdump_gracefully()
        set_system_proxy(False)
        self.blocker_active = False
        self._update_blocker_status()

    # ── Fellowship ─────────────────────────────────────────

    def _build_fellowship_page(self) -> None:
        page = QWidget()
        layout = QVBoxLayout(page)
        layout.setContentsMargins(0, 0, 0, 0)

        scaffold = PageScaffold()

        connect_card = GlassCard()
        connect_layout = QVBoxLayout(connect_card)
        connect_layout.setContentsMargins(20, 18, 20, 18)
        connect_layout.addWidget(PageHeader("Connection", "Invite link or manual credentials"))
        form = QFormLayout()
        self.invite_input = QLineEdit()
        self.invite_input.setPlaceholderText("https://…/f/your-code")
        import_btn = QPushButton("Import")
        import_btn.setObjectName("ghostBtn")
        import_btn.clicked.connect(self._import_invite_link)
        invite_row = QHBoxLayout()
        invite_row.addWidget(self.invite_input, 1)
        invite_row.addWidget(import_btn)
        self.api_url_input = QLineEdit()
        self.token_input = QLineEdit()
        self.token_input.setEchoMode(QLineEdit.EchoMode.Password)
        self.token_input.setPlaceholderText("••••••••")
        self.code_input = QLineEdit()
        self.name_input = QLineEdit()
        form.addRow("Invite link", invite_row)
        form.addRow("API URL", self.api_url_input)
        form.addRow("Member token", self.token_input)
        form.addRow("Fellowship code", self.code_input)
        form.addRow("Your name", self.name_input)
        connect_layout.addLayout(form)
        scaffold.add(connect_card)

        okr_card = GlassCard()
        okr_layout = QVBoxLayout(okr_card)
        okr_layout.setContentsMargins(20, 18, 20, 18)
        okr_layout.addWidget(PageHeader("Weekly OKRs", "Freelance productivity loop — synced with Overview"))
        okr_form = QFormLayout()
        self.okr_focus_spin = QSpinBox()
        self.okr_focus_spin.setRange(1, 80)
        self.okr_focus_spin.setSuffix(" h/week")
        self.okr_habit_spin = QSpinBox()
        self.okr_habit_spin.setRange(10, 100)
        self.okr_habit_spin.setSuffix(" %")
        self.okr_revenue_spin = QSpinBox()
        self.okr_revenue_spin.setRange(0, 100000)
        self.okr_revenue_spin.setSuffix(" €/month")
        self.okr_revenue_current = QSpinBox()
        self.okr_revenue_current.setRange(0, 100000)
        self.okr_revenue_current.setSuffix(" €")
        okr_form.addRow("Focus target", self.okr_focus_spin)
        okr_form.addRow("Habit target", self.okr_habit_spin)
        okr_form.addRow("Revenue target", self.okr_revenue_spin)
        okr_form.addRow("Revenue this month", self.okr_revenue_current)
        okr_layout.addLayout(okr_form)
        scaffold.add(okr_card)

        trust_card = GlassCard()
        trust_layout = QVBoxLayout(trust_card)
        trust_layout.setContentsMargins(20, 18, 20, 18)
        trust_layout.addWidget(PageHeader("Guild Trust", "Privacy-first proofs during focus sessions"))
        trust_form = QFormLayout()
        self.proof_mode_combo = QComboBox()
        self.proof_mode_combo.addItems(["off", "signal", "blur", "full"])
        self.proof_interval_spin = QSpinBox()
        self.proof_interval_spin.setRange(5, 15)
        self.proof_interval_spin.setSuffix(" min")
        self.proof_webcam_check = QCheckBox("Optional webcam presence (blurred, once per session)")
        trust_form.addRow("Proof mode", self.proof_mode_combo)
        trust_form.addRow("Proof interval", self.proof_interval_spin)
        trust_form.addRow("", self.proof_webcam_check)
        trust_layout.addLayout(trust_form)
        scaffold.add(trust_card)

        system_card = GlassCard()
        system_layout = QVBoxLayout(system_card)
        system_layout.setContentsMargins(20, 18, 20, 18)
        system_layout.addWidget(PageHeader("System", "Non-intrusive by default"))
        self.tray_check = QCheckBox("Minimize to system tray when closing")
        self.startup_check = QCheckBox("Start with Windows (minimized)")
        self.start_min_check = QCheckBox("Start minimized to tray")
        self.auto_update_check = QCheckBox("Check for updates automatically")
        for w in [self.tray_check, self.startup_check, self.start_min_check, self.auto_update_check]:
            system_layout.addWidget(w)
        row = QHBoxLayout()
        save_btn = QPushButton("Save settings")
        save_btn.setObjectName("primaryBtn")
        save_btn.setMaximumWidth(240)
        save_btn.clicked.connect(self._save_fellowship_settings)
        dash_btn = QPushButton("Open web dashboard")
        dash_btn.setObjectName("ghostBtn")
        dash_btn.clicked.connect(self._open_dashboard)
        row.addWidget(save_btn)
        row.addWidget(dash_btn)
        system_layout.addLayout(row)
        scaffold.add(system_card)
        scaffold.add_stretch()

        layout.addWidget(scaffold)
        self.stack.addWidget(page)

    def _on_web_config_updated(self, config: dict) -> None:
        self.config = config
        save_config(self.config)
        self.api_url_input.setText(config.get("api_url", "https://fellowship-focus-production.up.railway.app"))
        self.token_input.setText(config.get("member_token", ""))
        self.code_input.setText(config.get("fellowship_code", ""))
        self.name_input.setText(config.get("member_name", ""))
        self._refresh_journey()
        self._update_chrome_status()

    def _import_invite_link(self) -> None:
        parsed = parse_invite_or_sync(self.invite_input.text())
        if not parsed:
            self.toasts.show("Import failed", "Paste a valid invite link.", "warning")
            return
        apply_parsed_config(self.config, parsed)
        save_config(self.config)
        self._load_config_to_ui()
        self.web_dashboard.reload_dashboard()
        self.toasts.show("Connected", "Fellowship linked — open the Fellowship tab.", "success", 3000)

    def _save_fellowship_settings(self) -> None:
        self.config.update({
            "api_url": self.api_url_input.text().strip(),
            "member_token": self.token_input.text().strip(),
            "fellowship_code": self.code_input.text().strip(),
            "member_name": self.name_input.text().strip(),
            "minimize_to_tray": self.tray_check.isChecked(),
            "start_minimized": self.start_min_check.isChecked(),
            "auto_update": self.auto_update_check.isChecked(),
            "okr_weekly_focus_hours": self.okr_focus_spin.value(),
            "okr_habit_rate": self.okr_habit_spin.value(),
            "okr_freelance_revenue_eur": self.okr_revenue_spin.value(),
            "okr_revenue_current_eur": self.okr_revenue_current.value(),
            "proof_mode": self.proof_mode_combo.currentText(),
            "proof_interval_min": self.proof_interval_spin.value(),
            "proof_webcam": self.proof_webcam_check.isChecked(),
        })
        save_config(self.config)
        if self.startup_check.isChecked() != is_startup_enabled():
            ok, msg = set_startup_enabled(self.startup_check.isChecked())
            self.toasts.show("Startup", msg, "success" if ok else "warning")
        self._refresh_journey()
        self.web_dashboard.reload_dashboard()
        self.toasts.show("Saved", "Guild settings updated.", "success", 2500)

    def _refresh_journey(self) -> None:
        code = self.config.get("fellowship_code", "")
        api_url = self.config.get("api_url", "")
        if not code or not api_url:
            self.waypoint_label.setText("")
            return
        data = FellowshipApi(api_url, self.config.get("member_token", "")).get_fellowship(code)
        if not data:
            self.waypoint_label.setText("Could not reach Fellowship API.")
            return
        self._fellowship_cache = data
        wp = data["journey"]["currentWaypoint"]
        self.waypoint_label.setText(
            f"{wp['name']} — {data['totalXp']:,} XP · {data['journey']['progress']}% to next waypoint"
        )
        self.dashboard_page.update_data(data, self.config)
        self._update_chrome_status()

    def _dashboard_url(self) -> str | None:
        code = self.config.get("fellowship_code", "")
        api = self.config.get("api_url", "").rstrip("/")
        if code and api:
            return f"{api}/f/{code}"
        return None

    def _open_dashboard(self) -> None:
        url = self._dashboard_url()
        if url:
            webbrowser.open(url)

    def _load_config_to_ui(self) -> None:
        c = self.config
        self.api_url_input.setText(c.get("api_url", "https://fellowship-focus-production.up.railway.app"))
        self.token_input.setText(c.get("member_token", ""))
        self.code_input.setText(c.get("fellowship_code", ""))
        self.name_input.setText(c.get("member_name", ""))
        self.tray_check.setChecked(c.get("minimize_to_tray", True))
        self.start_min_check.setChecked(c.get("start_minimized", True))
        self.auto_update_check.setChecked(c.get("auto_update", True))
        self.startup_check.setChecked(is_startup_enabled())
        self.okr_focus_spin.setValue(c.get("okr_weekly_focus_hours", 20))
        self.okr_habit_spin.setValue(c.get("okr_habit_rate", 80))
        self.okr_revenue_spin.setValue(c.get("okr_freelance_revenue_eur", 3000))
        self.okr_revenue_current.setValue(c.get("okr_revenue_current_eur", 0))
        self.proof_mode_combo.setCurrentText(c.get("proof_mode", "signal"))
        self.proof_interval_spin.setValue(c.get("proof_interval_min", 10))
        self.proof_webcam_check.setChecked(c.get("proof_webcam", False))
        self.work_spin.setValue(c.get("work_duration", 45))
        self.break_spin.setValue(c.get("break_duration", 10))
        self.long_break_spin.setValue(c.get("long_break_duration", 15))
        self.intervals_spin.setValue(c.get("work_intervals", 2))
        self.blocker_enabled_check.setChecked(c.get("enable_website_blocker", True))
        mode = c.get("blocker_mode", "soft")
        idx = self.blocker_mode_combo.findData(mode)
        if idx >= 0:
            self.blocker_mode_combo.setCurrentIndex(idx)
        self.sites_edit.setPlainText("\n".join(c.get("blocked_sites", DEFAULT_BLOCKED_SITES)))
        self.pomodoro.configure(
            self.work_spin.value(), self.break_spin.value(),
            self.long_break_spin.value(), self.intervals_spin.value(),
        )
        self._sync_focus_ring(f"{self.work_spin.value():02d}:00", "Ready", 1.0, False)
        self._refresh_journey()

    def _generate_cert(self) -> None:
        if not find_mitmdump():
            QMessageBox.critical(self, "Error", "mitmdump not found.")
            return
        self.mitm_process = start_mitmdump(["example.com"])
        set_system_proxy(True)
        QTimer.singleShot(3000, self._finish_cert_generation)

    def _finish_cert_generation(self) -> None:
        shutdown_mitmdump_gracefully()
        set_system_proxy(False)
        self._update_blocker_status()

    def _install_cert(self) -> None:
        ok, msg = install_cert_windows()
        self._update_blocker_status()
        if ok:
            self.config["cert_setup_done"] = True
            save_config(self.config)
            self.toasts.show("Certificate installed", msg, "success")
        else:
            self.toasts.show("Certificate", msg, "warning")

    def _on_nav(self, index: int) -> None:
        self.stack.setCurrentIndex(index)
        titles = NavSidebar.NAV
        if 0 <= index < len(titles):
            self.page_title.setText(titles[index][0])
        if index == 0:
            self.web_dashboard.reload_dashboard()
        elif index == 1:
            self._refresh_journey()

    # ── Tray & lifecycle ───────────────────────────────────

    def _init_tray(self) -> None:
        from PySide6.QtWidgets import QMenu

        self.tray = QSystemTrayIcon(self)
        self.tray.setToolTip("Fellowship Focus")
        menu = QMenu()
        show_a = QAction("Show", self)
        show_a.triggered.connect(self.show)
        update_a = QAction("Check for updates", self)
        update_a.triggered.connect(self._check_updates_manual)
        quit_a = QAction("Quit", self)
        quit_a.triggered.connect(self._quit_app)
        menu.addAction(show_a)
        menu.addAction(update_a)
        menu.addSeparator()
        menu.addAction(quit_a)
        self.tray.setContextMenu(menu)
        self.tray.activated.connect(lambda r: self.show() if r == QSystemTrayIcon.ActivationReason.Trigger else None)
        icon_path = next(
            (ASSETS_DIR / n for n in ("fellowship.ico", "app-icon.png", "fellowship.jpg") if (ASSETS_DIR / n).exists()),
            None,
        )
        if icon_path:
            self.tray.setIcon(QIcon(str(icon_path)))
        else:
            self.tray.setIcon(self.windowIcon())
        self.tray.show()

    def closeEvent(self, event: QCloseEvent) -> None:
        if self.config.get("minimize_to_tray", True):
            event.ignore()
            self.hide()
            return
        self._quit_app()

    def _quit_app(self) -> None:
        self.task_tick.stop()
        if self.pomodoro.is_running:
            self._stop_pomodoro()
        else:
            self._disable_blocker()
        self.tray.hide()
        QApplication.quit()


def run(start_minimized: bool = False) -> None:
    app = QApplication(sys.argv)
    app.setQuitOnLastWindowClosed(False)
    window = MainWindow()
    if start_minimized or "--minimized" in sys.argv:
        window.hide()
    else:
        window.show()
    sys.exit(app.exec())
