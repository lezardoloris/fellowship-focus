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
    QProgressBar,
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
    blocker_log,
    force_release_blocker,
    is_mitmdump_running,
    proxy_engine_available,
    set_system_proxy,
    start_mitmdump,
)
from fellowship_focus.cert_setup import install_cert_windows, is_cert_installed, is_cert_generated
from fellowship_focus.config import load_config, save_config
from fellowship_focus.invite import apply_parsed_config, parse_invite_or_sync
from fellowship_focus.constants import DEFAULT_BLOCKED_SITES, DEFAULT_REDIRECTS, effective_block_lists
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
    MiniShieldToggle,
    NavSidebar,
    PageHeader,
    PageScaffold,
    ShieldHeroCard,
    StatusPill,
)
from fellowship_focus.ui.dashboard import DashboardPage
from fellowship_focus.ui.music_player import FocusMusicPlayer
from fellowship_focus.ui.float_timer import FloatTimerWindow
from fellowship_focus.ui.theme import ASSETS_DIR, app_stylesheet, font_sans, load_fonts, resolve_app_icon_path
from fellowship_focus.ui.toast import ToastManager
from fellowship_focus.ui.usage_page import UsagePage
from fellowship_focus.ui.session_nudge import SessionNudge
from fellowship_focus.ui.web_dashboard import WebDashboardPage
from fellowship_focus.usage_tracker import UsageTracker, focus_score
from fellowship_focus.updater import apply_git_update, check_for_updates
from fellowship_focus.version import APP_VERSION


class MainWindow(QMainWindow):
    def __init__(self) -> None:
        super().__init__()
        self.config = load_config()
        self.mitm_process = None
        self.blocker_active = False
        self._blocker_arming = False
        # Detects a dead engine and releases the system proxy so a crash can
        # never leave the whole machine without internet.
        self._blocker_watchdog = QTimer(self)
        self._blocker_watchdog.timeout.connect(self._watchdog_tick)
        self._wizard_running = False
        self._cert_ok = is_cert_installed()
        force_release_blocker()
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
        # Compact three-panel shell (Block · Focus · Music) — fixed default every launch.
        self.setMinimumSize(980, 640)
        self._apply_default_window_size()
        load_fonts()
        self.setStyleSheet(app_stylesheet())
        self.setFont(font_sans())
        icon_file = resolve_app_icon_path()
        if icon_file:
            self.setWindowIcon(QIcon(str(icon_file)))

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
        self.top_bar = top
        self._immersive = False
        self._pre_immersive_geo = None
        self._pre_immersive_flags = None

        self.stack = QStackedWidget()
        right_layout.addWidget(self.stack, 1)
        outer.addWidget(right, 1)

        self.web_dashboard = WebDashboardPage(
            lambda: self.config,
            self._open_dashboard,
            self._on_web_config_updated,
            blocker_api={
                "state": self._web_blocker_state,
                "set_shield": self._web_set_shield,
                "add_sites": self._web_add_sites,
                "remove_site": self._web_remove_site,
                "weekly_stats": self._web_weekly_stats,
                "set_okr": self._web_set_okr,
                "show_float_timer": self._web_show_float_timer,
                "hide_float_timer": self._web_hide_float_timer,
                "music_state": self._web_music_state,
                "music_cmd": self._web_music_cmd,
                "set_prefs": self._web_set_prefs,
            },
        )
        self.stack.addWidget(self.web_dashboard)
        self.dashboard_page = DashboardPage(self._go_pomodoro, self._open_dashboard)
        self.stack.addWidget(self.dashboard_page)
        self._build_tasks_page()
        self._build_pomodoro_page()
        self._build_blocker_page()
        self._build_fellowship_page()

        self._float_timer = FloatTimerWindow()
        self._float_timer.closed_by_user.connect(self._on_float_timer_closed)
        self._float_timer.dismissed_by_user.connect(self._refresh_tray_menu)
        self._float_timer.open_app_requested.connect(self._show_from_tray)
        self._float_timer.remaining_changed.connect(self._on_float_remaining)

        self.usage_tracker = UsageTracker(lambda: self.config)
        self.usage_page = UsagePage(self.usage_tracker, self.config, save_config)
        self.stack.addWidget(self.usage_page)
        if bool(self.config.get("screen_time_enabled", True)):
            self.usage_tracker.start()

        self._init_tray()
        self._load_config_to_ui()
        self._refresh_tasks()
        self.sidebar.set_current(0)
        self._update_chrome_status()

        if not self._cert_ok:
            self.sidebar.set_current(4)
            QTimer.singleShot(
                800,
                lambda: self.toasts.show(
                    "One-time setup",
                    "Click Activate Shield — takes about 15 seconds, once.",
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

        # Proactive nudge: if you're clearly working (active input, no session,
        # window hidden), offer to start a session so the deep-work time gets
        # tracked. Discreet, self-dismissing, never nags twice in a row.
        self._nudge = SessionNudge()
        self._nudge.accepted.connect(self._on_nudge_accept)
        self._nudge.dismissed.connect(self._on_nudge_dismiss)
        self._nudge_snooze_until = 0.0
        self._nudge_active_streak = 0
        self._nudge_timer = QTimer(self)
        self._nudge_timer.timeout.connect(self._maybe_nudge_session)
        if bool(self.config.get("session_nudge_enabled", True)):
            self._nudge_timer.start(30000)

        self._usage_sync_timer = QTimer(self)
        self._usage_sync_timer.timeout.connect(self._sync_usage)
        self._usage_sync_timer.start(300000)

        QTimer.singleShot(2000, self._check_updates_silent)
        QTimer.singleShot(500, self.web_dashboard.reload_dashboard)

    def resizeEvent(self, event) -> None:
        super().resizeEvent(event)
        self.toasts.reposition()

    def _apply_default_window_size(self) -> None:
        """Always open at the compact three-panel size (screenshot default)."""
        from PySide6.QtGui import QGuiApplication

        # Drop any legacy maximized/fullscreen blob so reload cannot re-inflate.
        if self.config.pop("window_geometry", None) is not None:
            try:
                save_config(self.config)
            except Exception:
                pass

        width, height = 1180, 740
        # Clear maximized/fullscreen before resize — Windows may restore
        # the previous show state and ignore a plain resize().
        self.setWindowState(Qt.WindowState.WindowNoState)
        self.resize(width, height)
        screen = QGuiApplication.primaryScreen()
        if screen is not None:
            geo = screen.availableGeometry()
            # Prefer last position if still on-screen; else center.
            x = self.config.get("window_x")
            y = self.config.get("window_y")
            if isinstance(x, int) and isinstance(y, int):
                if geo.contains(x + 40, y + 40):
                    self.move(x, y)
                    return
            x = geo.x() + max(0, (geo.width() - width) // 2)
            y = geo.y() + max(0, (geo.height() - height) // 2)
            self.move(x, y)

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
        # Older configs stored a pasted invite blob here; never render it.
        if name.startswith("{") or "://" in name:
            name = ""
        name = name[:40]
        if code and name:
            self._style_pill(self.status_guild, "active", f"{name} · {code}")
        elif code:
            self._style_pill(self.status_guild, "neutral", code)
        else:
            self._style_pill(self.status_guild, "neutral", "Not connected")

        if self.blocker_active:
            self._style_pill(self.status_blocker, "active", "Shield active")
        elif not self._cert_ok:
            self._style_pill(self.status_blocker, "warn", "Setup needed")
        else:
            self._style_pill(self.status_blocker, "neutral", "Shield standby")
        self.sidebar.set_status(f"v{APP_VERSION}")

    def _check_updates_silent(self) -> None:
        if not self.config.get("auto_update", True):
            return
        # check_for_updates() does a network request plus a `git fetch` with a
        # 30 s timeout. Run on the GUI thread it froze the whole app right
        # after launch — a full-screen window stuck at "not responding".
        import threading

        self._update_info_pending = None

        def worker() -> None:
            try:
                self._update_info_pending = check_for_updates()
            except Exception:
                self._update_info_pending = None

        threading.Thread(target=worker, daemon=True, name="update-check").start()
        self._poll_update_result(attempts=120)

    def _poll_update_result(self, attempts: int) -> None:
        info = getattr(self, "_update_info_pending", None)
        if info is not None:
            self._update_info_pending = None
            if info.available:
                self.toasts.show("Update available", info.message, "info", 8000)
            return
        if attempts > 0:
            QTimer.singleShot(500, lambda: self._poll_update_result(attempts - 1))

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
        self.pomo_start_btn.setObjectName("primaryBtn")
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

        self.focus_shield = MiniShieldToggle()
        self.focus_shield.setting_changed.connect(self._on_shield_setting_changed)
        self.focus_shield.arm_requested.connect(self._on_shield_arm)
        self.focus_shield.disarm_requested.connect(self._on_shield_disarm)
        left.addWidget(self.focus_shield)
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

        right = QVBoxLayout()
        right.setSpacing(20)
        right.addWidget(settings_card)
        self.music_player = FocusMusicPlayer(self.config, save_config)
        self.music_player.setFixedWidth(300)
        right.addWidget(self.music_player)
        right.addStretch()
        root.addLayout(right, 1)

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
        self.music_player.on_focus_start()

    def _pause_pomodoro(self) -> None:
        paused = self.pomodoro.pause_resume()
        self.pomo_pause_btn.setText("Resume" if paused else "Pause")
        if paused:
            self.task_tick.stop()
            self.proof_worker.stop()
            self._disable_blocker()
            self.music_player.on_pause()
        elif self.pomodoro.is_work_phase:
            self.task_tick.start(1000)
            if self._active_session_id:
                self.proof_worker.start(self._active_session_id)
            if self.config.get("enable_website_blocker", True):
                self._enable_blocker()
            self.music_player.on_resume()

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
        self.music_player.on_session_end()
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
            self.music_player.on_break()
        elif prev in (PomodoroEngine.PHASE_BREAK, PomodoroEngine.PHASE_LONG_BREAK) and phase == PomodoroEngine.PHASE_WORK:
            msg = "Break over — distractions blocked again."
            self.toasts.show("Back to focus", msg, "info", 5000)
            notify_back_to_focus(getattr(self, "tray", None))
            self.music_player.on_focus_start()
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
        self.music_player.on_session_end()
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

        self.shield_hero = ShieldHeroCard()
        self.shield_hero.setting_changed.connect(self._on_shield_setting_changed)
        self.shield_hero.arm_requested.connect(self._on_shield_arm)
        self.shield_hero.disarm_requested.connect(self._on_shield_disarm)
        self.shield_hero.pause_requested.connect(self._pause_blocker_timed)
        scaffold.add(self.shield_hero)

        # One-time setup — visible only until the certificate is ready
        self.setup_card = GlassCard()
        setup_layout = QVBoxLayout(self.setup_card)
        setup_layout.setContentsMargins(20, 18, 20, 18)
        setup_layout.addWidget(PageHeader("One-time setup", "One click — about 15 seconds, then permanent"))
        self.setup_info = QLabel("")
        self.setup_info.setObjectName("mutedLabel")
        self.setup_info.setWordWrap(True)
        setup_layout.addWidget(self.setup_info)
        self.setup_progress = QProgressBar()
        self.setup_progress.setRange(0, 3)
        self.setup_progress.setValue(0)
        self.setup_progress.setTextVisible(False)
        self.setup_progress.setVisible(False)
        setup_layout.addWidget(self.setup_progress)
        setup_row = QHBoxLayout()
        self.setup_btn = QPushButton("Activate Shield")
        self.setup_btn.setObjectName("primaryBtn")
        self.setup_btn.clicked.connect(self._activate_shield_wizard)
        self.setup_help_btn = QPushButton("Get mitmproxy")
        self.setup_help_btn.setObjectName("ghostBtn")
        self.setup_help_btn.setVisible(False)
        self.setup_help_btn.clicked.connect(lambda: webbrowser.open("https://mitmproxy.org/downloads/"))
        setup_row.addWidget(self.setup_btn)
        setup_row.addWidget(self.setup_help_btn)
        setup_row.addStretch()
        setup_layout.addLayout(setup_row)
        scaffold.add(self.setup_card)

        # Rules — two presets, auto-saved, custom list folded away
        rules_card = GlassCard()
        rules_layout = QVBoxLayout(rules_card)
        rules_layout.setContentsMargins(20, 18, 20, 18)
        rules_layout.addWidget(PageHeader("What gets blocked", "Auto-saved — no Save button needed"))

        preset_row = QHBoxLayout()
        preset_row.setSpacing(8)
        self.preset_soft_btn = QPushButton("Deep Work")
        self.preset_hard_btn = QPushButton("Lockdown")
        for btn, mode in ((self.preset_soft_btn, "soft"), (self.preset_hard_btn, "hard")):
            btn.setObjectName("presetChip")
            btn.setCheckable(True)
            btn.setCursor(Qt.CursorShape.PointingHandCursor)
            btn.clicked.connect(lambda checked=False, m=mode: self._apply_mode(m))
            preset_row.addWidget(btn)
        preset_row.addStretch()
        rules_layout.addLayout(preset_row)

        self.preset_desc = QLabel("")
        self.preset_desc.setObjectName("mutedLabel")
        self.preset_desc.setWordWrap(True)
        rules_layout.addWidget(self.preset_desc)

        edit_row = QHBoxLayout()
        self.edit_sites_btn = QPushButton("Edit site list")
        self.edit_sites_btn.setObjectName("ghostBtn")
        self.edit_sites_btn.setCheckable(True)
        self.edit_sites_btn.toggled.connect(self._toggle_sites_editor)
        test_btn = QPushButton("Test the shield")
        test_btn.setObjectName("ghostBtn")
        test_btn.clicked.connect(self._test_shield)
        edit_row.addWidget(self.edit_sites_btn)
        edit_row.addWidget(test_btn)
        edit_row.addStretch()
        rules_layout.addLayout(edit_row)

        self.sites_edit = QTextEdit()
        self.sites_edit.setPlainText("\n".join(DEFAULT_BLOCKED_SITES))
        self.sites_edit.setMinimumHeight(180)
        self.sites_edit.setVisible(False)
        self._sites_save_timer = QTimer(self)
        self._sites_save_timer.setSingleShot(True)
        self._sites_save_timer.timeout.connect(self._autosave_sites)
        self.sites_edit.textChanged.connect(lambda: self._sites_save_timer.start(900))
        rules_layout.addWidget(self.sites_edit)

        scaffold.add(rules_card)
        scaffold.add_stretch()

        layout.addWidget(scaffold)
        self.stack.addWidget(page)
        self._update_blocker_status()

    def _toggle_sites_editor(self, show: bool) -> None:
        self.sites_edit.setVisible(show)
        self.edit_sites_btn.setText("Hide site list" if show else "Edit site list")

    # ── One-click setup wizard ─────────────────────────────

    def _refresh_setup_card(self) -> None:
        if not hasattr(self, "setup_card") or self._wizard_running:
            return
        if self._cert_ok and proxy_engine_available():
            self.setup_card.setVisible(False)
            return
        self.setup_card.setVisible(True)
        self.setup_progress.setVisible(False)
        self.setup_btn.setEnabled(True)
        if not proxy_engine_available():
            self.setup_info.setText(
                "The shield needs the free mitmproxy engine to filter sites.\n"
                "Install it below, then click Activate Shield."
            )
            self.setup_help_btn.setVisible(True)
        else:
            self.setup_info.setText(
                "One click sets up the blocking certificate on this PC.\n"
                "Windows asks you to confirm once — after that it's permanent."
            )
            self.setup_help_btn.setVisible(False)

    def _activate_shield_wizard(self) -> None:
        if not proxy_engine_available():
            self._refresh_setup_card()
            self.toasts.show(
                "Missing engine",
                "Install mitmproxy first (button below), then click Activate Shield again.",
                "warning",
                5000,
            )
            return
        if self._cert_ok and is_cert_generated():
            self._update_blocker_status()
            return
        self._wizard_running = True
        self.setup_btn.setEnabled(False)
        self.setup_help_btn.setVisible(False)
        self.setup_progress.setVisible(True)
        self.setup_progress.setValue(1)
        self.setup_info.setText("Step 1 of 3 — generating your certificate…")
        if not is_cert_generated():
            self.mitm_process = start_mitmdump(["example.com"])
            set_system_proxy(True)
        self._wizard_polls = 0
        QTimer.singleShot(700, self._wizard_wait_cert)

    def _wizard_wait_cert(self) -> None:
        self._wizard_polls += 1
        if not is_cert_generated() and self._wizard_polls < 20:
            QTimer.singleShot(500, self._wizard_wait_cert)
            return
        force_release_blocker()
        self.mitm_process = None
        if not is_cert_generated():
            self._wizard_fail("Could not generate the certificate. Close any VPN or proxy tool and try again.")
            return
        self.setup_progress.setValue(2)
        self.setup_info.setText("Step 2 of 3 — installing (Windows will ask you to confirm)…")
        QTimer.singleShot(200, self._wizard_install)

    def _wizard_install(self) -> None:
        ok, msg = install_cert_windows()
        if not ok:
            self._wizard_fail(f"Install failed: {msg}")
            return
        self.setup_progress.setValue(3)
        self._cert_ok = True
        self.config["cert_setup_done"] = True
        save_config(self.config)
        self._wizard_running = False
        self._update_blocker_status()
        self.toasts.show(
            "Shield ready",
            "Setup complete — distractions are blocked during every focus session.",
            "success",
            5000,
        )

    def _wizard_fail(self, message: str) -> None:
        self._wizard_running = False
        self.setup_progress.setVisible(False)
        self.setup_btn.setEnabled(True)
        self.setup_info.setText(f"{message}\nClick Activate Shield to try again.")
        self.toasts.show("Setup failed", message, "warning", 6000)
        self._update_blocker_status()

    def _test_shield(self) -> None:
        if not self._ensure_blocker_ready():
            return
        started_for_test = False
        if not self.blocker_active:
            self._enable_blocker()
            started_for_test = self.blocker_active
        if not self.blocker_active:
            self.toasts.show("Shield", "Could not start the shield — check the setup above.", "warning", 4000)
            return
        webbrowser.open("https://twitter.com")
        if started_for_test and not self.pomodoro.is_work_phase:
            self.toasts.show(
                "Shield test",
                "twitter.com should say 'You cannot pass.' Auto-off in 30 s.",
                "info",
                6000,
            )
            QTimer.singleShot(30_000, self._end_shield_test)
        else:
            self.toasts.show("Shield test", "twitter.com should say 'You cannot pass.'", "info", 5000)

    def _end_shield_test(self) -> None:
        if self.pomodoro.is_work_phase:
            return
        self._release_blocker_infra()
        self.toasts.show("Test over", "Shield is back on standby — it arms during focus.", "info", 3000)

    def _sync_shield_toggle(self) -> None:
        in_focus = self.pomodoro.is_running and self.pomodoro.is_work_phase
        state = dict(
            enabled=self.config.get("enable_website_blocker", True),
            active=self.blocker_active,
            in_focus=in_focus,
            ready=bool(self._cert_ok and proxy_engine_available()),
        )
        if hasattr(self, "shield_hero"):
            self.shield_hero.sync_state(**state)
        if hasattr(self, "focus_shield"):
            self.focus_shield.sync_state(**state)

    def _on_shield_setting_changed(self, enabled: bool) -> None:
        was_enabled = self.config.get("enable_website_blocker", True)
        if was_enabled and not enabled and self.pomodoro.is_work_phase and self.blocker_active:
            self._disable_blocker(work_bypass=True)
            if self.blocker_active:
                self._sync_shield_toggle()
                return
        self.config["enable_website_blocker"] = enabled
        save_config(self.config)
        if not enabled:
            self._release_blocker_infra()
        self._sync_shield_toggle()
        label = "Shield armed for focus sessions" if enabled else "Shield disabled"
        self.toasts.show("Fellowship Shield", label, "success" if enabled else "info", 2500)

    def _on_shield_arm(self) -> None:
        if not self._ensure_blocker_ready():
            self._sync_shield_toggle()
            return
        self._enable_blocker()
        self._sync_shield_toggle()
        # No success toast here: the engine is still booting. Claiming
        # "distractions are blocked" while the pill honestly said OFF was a
        # visible contradiction — _wait_engine_then_arm announces the real
        # "Shield up" the moment the proxy answers.
        if self._blocker_arming:
            self.toasts.show("Arming…", "Starting the blocking engine.", "info", 2000)

    def _on_shield_disarm(self) -> None:
        if not self.blocker_active and not self._blocker_arming:
            return
        blocker_log("disarm requested by user")
        self._disable_blocker(work_bypass=True)
        self._sync_shield_toggle()

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

    def _apply_mode(self, mode: str) -> None:
        self.config["blocker_mode"] = mode
        save_config(self.config)
        self._sync_preset_ui()
        if self.blocker_active:
            self._release_blocker_infra()
            self._enable_blocker()
        label = (
            "List only — blocks what’s on your list (add YouTube yourself)."
            if mode == "soft"
            else "Whole sites — your list plus full YouTube, Instagram and LinkedIn."
        )
        self.toasts.show("Saved", label, "success", 2500)

    def _sync_preset_ui(self) -> None:
        mode = self.config.get("blocker_mode", "hard")
        self.preset_soft_btn.setChecked(mode == "soft")
        self.preset_hard_btn.setChecked(mode == "hard")
        if mode == "soft":
            self.preset_desc.setText(
                "Blocks only your site list. Add youtube.com (Video) to kill YouTube entirely."
            )
        else:
            self.preset_desc.setText(
                "Blocks your list plus full YouTube, Instagram and LinkedIn automatically."
            )

    def _autosave_sites(self) -> None:
        sites = [s.strip() for s in self.sites_edit.toPlainText().splitlines() if s.strip()]
        if sites == self.config.get("blocked_sites"):
            return
        self.config["blocked_sites"] = sites or DEFAULT_BLOCKED_SITES
        save_config(self.config)
        if self.blocker_active:
            self._release_blocker_infra()
            self._enable_blocker()
        self.toasts.show("Saved", f"{len(self.config['blocked_sites'])} sites in your blocklist.", "success", 1800)

    # ── Bridge for the embedded web app (Block tab) ────────────
    @staticmethod
    def _normalize_host(raw: str) -> str:
        s = (raw or "").strip().lower()
        if "://" in s:
            s = s.split("://", 1)[1]
        if s.startswith("www."):
            s = s[4:]
        return s.split("/", 1)[0].strip()

    def _web_set_prefs(self, patch: dict) -> dict:
        """Push prefs edited in the web UI (mode, block style…) into the desktop
        config the proxy actually reads, and re-arm if needed. Without this the
        'Whole sites / Feeds only' toggle changed only the web copy while the
        engine kept using config.json — so YouTube stayed reachable in soft mode
        even though the UI showed Lockdown."""
        if not isinstance(patch, dict):
            return self._web_blocker_state()
        mode = patch.get("blocker_mode")
        if mode in ("soft", "hard") and mode != self.config.get("blocker_mode"):
            self.config["blocker_mode"] = mode
            if hasattr(self, "preset_soft_btn"):
                self._sync_preset_ui()
        if "block_style" in patch:
            self.config["block_style"] = "notify" if patch["block_style"] == "notify" else "page"
        save_config(self.config)
        if self.blocker_active:
            self._release_blocker_infra()
            self._enable_blocker()
        return self._web_blocker_state()

    def _web_music_state(self) -> dict:
        return self.music_player.bridge_state()

    def _web_music_cmd(self, payload: dict) -> dict:
        return self.music_player.bridge_cmd(payload if isinstance(payload, dict) else {})

    def _web_blocker_state(self) -> dict:
        return {
            "shieldOn": bool(self.blocker_active),
            "active": bool(self.blocker_active),
            "arming": bool(self._blocker_arming),
            "certReady": bool(self._cert_ok and proxy_engine_available()),
            "sites": list(self.config.get("blocked_sites", [])),
        }

    def _web_set_shield(self, on: bool) -> dict:
        try:
            if on and not self.blocker_active:
                self._on_shield_arm()
            elif not on and self.blocker_active:
                self._on_shield_disarm()
        except Exception:
            pass
        return self._web_blocker_state()

    def _sync_sites_editor(self) -> None:
        editor = getattr(self, "sites_edit", None)
        if editor is None:
            return
        try:
            editor.blockSignals(True)
            editor.setPlainText("\n".join(self.config.get("blocked_sites", [])))
        finally:
            editor.blockSignals(False)

    def _web_reapply_sites(self) -> None:
        save_config(self.config)
        self._sync_sites_editor()
        if self.blocker_active:
            self._release_blocker_infra()
            self._enable_blocker()

    def _web_add_sites(self, sites: list[str]) -> dict:
        current = list(self.config.get("blocked_sites", []))
        changed = False
        for raw in sites or []:
            host = self._normalize_host(raw)
            if host and host not in current:
                current.append(host)
                changed = True
        if changed:
            self.config["blocked_sites"] = current
            self._web_reapply_sites()
        return self._web_blocker_state()

    def _web_remove_site(self, site: str) -> dict:
        host = self._normalize_host(site)
        current = list(self.config.get("blocked_sites", []))
        filtered = [x for x in current if x != host and x != (site or "").strip()]
        if len(filtered) != len(current):
            self.config["blocked_sites"] = filtered
            self._web_reapply_sites()
        return self._web_blocker_state()

    # ── Solo productivity bridge (no guild needed) ─────────────
    @staticmethod
    def _solo_league(hours: float) -> dict:
        tiers = [("Mordor", 20), ("Gondor", 10), ("Rohan", 5), ("Shire", 0)]
        name = "Shire"
        for tier_name, threshold in tiers:
            if hours >= threshold:
                name = tier_name
                break
        nxt = None
        for tier_name, threshold in reversed(tiers):
            if threshold > hours:
                nxt = {"name": tier_name, "at": threshold}
                break
        return {"name": name, "hours": hours, "next": nxt}

    def _web_weekly_stats(self) -> dict:
        from datetime import date, timedelta

        from fellowship_focus.usage_tracker import focus_score, load_day

        today = date.today()
        monday = today - timedelta(days=today.weekday())
        weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

        days = []
        work_total = 0
        distr_total = 0
        scores: list[int] = []
        for i in range(7):
            d = monday + timedelta(days=i)
            data = load_day(d.isoformat())
            cats = data.get("categories", {})
            work = int(cats.get("work", 0))
            distr = int(cats.get("distraction", 0))
            sc = focus_score(data)
            if d <= today:
                work_total += work
                distr_total += distr
                if work + distr > 0:
                    scores.append(sc)
            days.append({
                "date": d.isoformat(),
                "weekday": weekdays[i],
                "work_seconds": work,
                "distraction_seconds": distr,
                "focus_minutes": round(work / 60),
                "focus_score": sc,
            })

        # Streak: consecutive days (walking back from today) with >= 25 min focus.
        streak = 0
        cursor = today
        for _ in range(400):
            data = load_day(cursor.isoformat())
            if int(data.get("categories", {}).get("work", 0)) >= 1500:
                streak += 1
                cursor = cursor - timedelta(days=1)
            elif cursor == today:
                cursor = cursor - timedelta(days=1)  # today may still be ramping up
            else:
                break

        # 8-week history of weekly focus minutes + avg score.
        history = []
        for wk in range(7, -1, -1):
            wstart = monday - timedelta(weeks=wk)
            wmins = 0
            wscores: list[int] = []
            for i in range(7):
                d = wstart + timedelta(days=i)
                if d > today:
                    continue
                data = load_day(d.isoformat())
                cats = data.get("categories", {})
                work = int(cats.get("work", 0))
                wmins += work // 60
                if work + int(cats.get("distraction", 0)) > 0:
                    wscores.append(focus_score(data))
            history.append({
                "weekStart": wstart.isoformat(),
                "work_minutes": wmins,
                "avg_focus_score": round(sum(wscores) / len(wscores)) if wscores else 0,
            })

        work_hours = round(work_total / 3600, 1)
        avg_score = round(sum(scores) / len(scores)) if scores else 0
        cfg = self.config
        return {
            "available": True,
            "weekStart": monday.isoformat(),
            "days": days,
            "history": history,
            "kpis": {
                "focus_hours": work_hours,
                "avg_focus_score": avg_score,
                "distraction_hours": round(distr_total / 3600, 1),
                "streak": streak,
                "focus_days": len([d for d in days if d["work_seconds"] >= 1500 and d["date"] <= today.isoformat()]),
            },
            "league": self._solo_league(work_hours),
            "okr": {
                "focus_hours": {"current": work_hours, "target": cfg.get("okr_weekly_focus_hours", 20)},
                "focus_score": {"current": avg_score, "target": cfg.get("okr_focus_score", 70)},
                "revenue": {
                    "current_eur": cfg.get("okr_revenue_current_eur", 0),
                    "target_eur": cfg.get("okr_freelance_revenue_eur", 3000),
                },
            },
        }

    def _web_set_okr(self, patch: dict) -> dict:
        mapping = {
            "focus_hours_target": "okr_weekly_focus_hours",
            "focus_score_target": "okr_focus_score",
            "revenue_target_eur": "okr_freelance_revenue_eur",
            "revenue_current_eur": "okr_revenue_current_eur",
        }
        changed = False
        for key, cfg_key in mapping.items():
            if isinstance(patch, dict) and patch.get(key) is not None:
                try:
                    self.config[cfg_key] = max(0, int(patch[key]))
                    changed = True
                except (TypeError, ValueError):
                    pass
        if changed:
            save_config(self.config)
            try:
                self._sync_settings_from_config()
            except Exception:
                pass
        return self._web_weekly_stats()

    def _web_show_float_timer(self, payload: dict) -> dict:
        try:
            remaining = int(payload.get("remaining", 0))
        except (TypeError, ValueError):
            remaining = 0
        label = str(payload.get("label") or payload.get("phase") or "FOCUS")
        self._float_timer.update_timer(remaining, label)
        self._refresh_tray_menu()
        return {"ok": True, "remaining": remaining}

    def _web_hide_float_timer(self) -> dict:
        self._float_timer.hide_timer()
        self._refresh_tray_menu()
        return {"ok": True}

    def _on_float_timer_closed(self) -> None:
        """User chose End session (context menu / tray) — ask the web app to stop."""
        self._refresh_tray_menu()
        try:
            view = getattr(self.web_dashboard, "_view", None)
            if view is not None:
                view.page().runJavaScript(
                    "window.dispatchEvent(new CustomEvent('ff-float-closed'));"
                )
        except Exception:
            pass

    def _on_float_remaining(self, remaining: int, label: str) -> None:
        self._update_tray_tooltip(remaining, label)
    def _sync_settings_from_config(self) -> None:
        """Reflect OKR edits made from the web app back into the settings spinboxes."""
        c = self.config
        if hasattr(self, "okr_focus_spin"):
            self.okr_focus_spin.setValue(c.get("okr_weekly_focus_hours", 20))
        if hasattr(self, "okr_revenue_spin"):
            self.okr_revenue_spin.setValue(c.get("okr_freelance_revenue_eur", 3000))
        if hasattr(self, "okr_revenue_current"):
            self.okr_revenue_current.setValue(c.get("okr_revenue_current_eur", 0))

    def _update_blocker_status(self) -> None:
        self._refresh_setup_card()
        self._update_chrome_status()
        self._sync_shield_toggle()

    def _ensure_blocker_ready(self) -> bool:
        if not self._cert_ok:
            self._cert_ok = is_cert_installed()
        if not self._cert_ok or not proxy_engine_available():
            self.sidebar.set_current(4)
            self._update_blocker_status()
            self.toasts.show(
                "One-time setup",
                "Click Activate Shield — takes about 15 seconds, once.",
                "warning",
                5000,
            )
            return False
        return True

    def _effective_block_lists(self) -> tuple[list[str], list]:
        return effective_block_lists(self.config)

    def _enable_blocker(self) -> None:
        if self.blocker_active or self._blocker_arming:
            return
        sites, path_rules = self._effective_block_lists()
        redirects = self.config.get("block_redirects", DEFAULT_REDIRECTS)
        self.mitm_process = start_mitmdump(
            sites,
            self.config.get("api_url", ""),
            self.config.get("member_token", ""),
            path_rules=path_rules,
            redirects=redirects,
            dashboard_url=self._dashboard_url() or "",
        )
        if not self.mitm_process:
            self._on_blocker_failed("The blocking engine could not start on this PC.")
            return
        # CRITICAL ORDER: the system proxy is only switched on once the engine
        # answers. Flipping it first cut the whole machine off the internet for
        # the entire engine boot (ERR_PROXY_CONNECTION_FAILED everywhere), and
        # left it stranded if the engine never came up.
        self._blocker_arming = True
        self._update_blocker_status()
        QTimer.singleShot(1000, lambda: self._wait_engine_then_arm(attempts=25))

    def _wait_engine_then_arm(self, attempts: int) -> None:
        if not self._blocker_arming:
            return
        if self.mitm_process and self.mitm_process.poll() is not None:
            self._blocker_arming = False
            blocker_log("arm FAILED: engine process died during boot")
            self._on_blocker_failed(
                "The blocking engine crashed while starting (see ~/.fellowship-focus/proxy.log)."
            )
            return
        if is_mitmdump_running():
            self._blocker_arming = False
            blocker_log("engine up — arming system proxy")
            set_system_proxy(True)
            self.blocker_active = True
            self._blocker_on_for_session = True
            self._update_blocker_status()
            self._blocker_watchdog.start(15000)
            self.toasts.show("Shield up", "Distracting sites are now blocked.", "success", 2500)
            # Prove it actually filters, not just that the engine answers.
            self._verify_filtering()
            return
        if attempts > 0:
            QTimer.singleShot(1000, lambda: self._wait_engine_then_arm(attempts - 1))
            return
        self._blocker_arming = False
        self._on_blocker_failed("The blocking engine did not come up.")

    def _verify_filtering(self) -> None:
        """Confirm the proxy really serves the block page for a listed domain.

        The engine answering != the engine filtering. This hits one real
        blocked domain through the proxy on a worker thread and warns loudly if
        the block page does not come back.
        """
        import threading

        sites, _ = self._effective_block_lists()
        if not sites:
            return
        target = sites[0]
        self._filter_ok = None

        def worker() -> None:
            import ssl
            import urllib.request

            proxy = f"http://127.0.0.1:{PROXY_PORT}"
            opener = urllib.request.build_opener(
                urllib.request.ProxyHandler({"http": proxy, "https": proxy}),
                urllib.request.HTTPSHandler(context=ssl._create_unverified_context()),
            )
            ok = False
            try:
                with opener.open(f"http://{target}/", timeout=8) as resp:
                    ok = "Blocked — Fellowship Focus" in resp.read().decode("utf-8", "replace")
            except Exception as e:
                blocker_log(f"verify: request error {e}")
            self._filter_ok = ok

        def poll(attempts: int) -> None:
            if self._filter_ok is None:
                if attempts > 0:
                    QTimer.singleShot(500, lambda: poll(attempts - 1))
                return
            if self._filter_ok:
                blocker_log(f"verify: filtering confirmed on {target}")
            else:
                blocker_log(f"verify: NOT filtering {target}")
                self.toasts.show(
                    "Shield armed but not filtering",
                    "Sites may still load. See ~/.fellowship-focus/proxy.log.",
                    "warning",
                    7000,
                )

        threading.Thread(target=worker, daemon=True, name="verify-filter").start()
        QTimer.singleShot(1000, lambda: poll(20))

    def _watchdog_tick(self) -> None:
        """Release the system proxy only if the engine PROCESS actually died.

        The liveness signal is the child process, nothing else. An earlier
        version pinged the engine over HTTP with a 3 s timeout, but a busy
        proxy (many concurrent TLS handshakes) flunks that ping while working
        perfectly — so the watchdog kept killing healthy shields a couple of
        minutes in. A live process IS a live engine.
        """
        if not self.blocker_active:
            self._blocker_watchdog.stop()
            return
        if self.mitm_process and self.mitm_process.poll() is not None:
            self._blocker_watchdog.stop()
            blocker_log("WATCHDOG trip: engine process exited")
            self._on_blocker_failed("The blocking engine stopped (see ~/.fellowship-focus/proxy.log).")

    def _on_blocker_failed(self, detail: str) -> None:
        self._release_blocker_infra()
        self.toasts.show(
            "Shield NOT active",
            f"{detail} You are not protected. Try again from the Blocker tab.",
            "warning",
            8000,
        )

    def _guild_bypass_penalty(self) -> int:
        if not self._fellowship_cache:
            return 0
        f = self._fellowship_cache.get("fellowship", {})
        return int(f.get("blocker_bypass_penalty", 0) or 0)

    def _disable_blocker(self, *, work_bypass: bool = False) -> None:
        if self.blocker_active:
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
        self._release_blocker_infra()

    def _release_blocker_infra(self) -> None:
        self._blocker_arming = False
        self._blocker_watchdog.stop()
        force_release_blocker()
        self.mitm_process = None
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
        self.invite_input.setEchoMode(QLineEdit.EchoMode.Password)
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
        self.invite_input.clear()
        self._load_config_to_ui()
        self.web_dashboard.reload_dashboard()
        self.toasts.show("Connected", "Fellowship linked — open the Fellowship tab.", "success", 3000)

    def _clean_member_name(self) -> str:
        """Rescue a name field that got an invite link or sync JSON pasted into it."""
        raw = self.name_input.text().strip()
        if not raw:
            return ""
        if raw.startswith("{") or "://" in raw:
            parsed = parse_invite_or_sync(raw)
            if parsed:
                # Credentials belong in their own fields, not in the display name.
                if parsed.get("api_url"):
                    self.api_url_input.setText(parsed["api_url"])
                if parsed.get("member_token"):
                    self.token_input.setText(parsed["member_token"])
                if parsed.get("fellowship_code"):
                    self.code_input.setText(parsed["fellowship_code"])
                name = parsed.get("member_name", "")
                self.name_input.setText(name)
                self.toasts.show(
                    "Cleaned up",
                    "That looked like an invite, not a name — credentials moved to the right fields.",
                    "success",
                    3500,
                )
                return name
            self.name_input.setText("")
            return ""
        return raw[:40]

    def _save_fellowship_settings(self) -> None:
        self.config.update({
            "member_name": self._clean_member_name(),
            "api_url": self.api_url_input.text().strip(),
            "member_token": self.token_input.text().strip(),
            "fellowship_code": self.code_input.text().strip(),
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

    def _sync_usage(self) -> None:
        tracker = getattr(self, "usage_tracker", None)
        if tracker is None:
            return
        token = self.config.get("member_token", "")
        api_url = self.config.get("api_url", "")
        if not token or not api_url:
            return
        data = tracker.today()
        cats = data.get("categories", {})
        total = sum(int(v) for v in cats.values())
        if total <= 0:
            return
        try:
            FellowshipApi(api_url, token).sync_usage(
                work_seconds=int(cats.get("work", 0)),
                distraction_seconds=int(cats.get("distraction", 0)),
                personal_seconds=int(cats.get("personal", 0)),
                neutral_seconds=int(cats.get("neutral", 0)),
                focus_score=focus_score(data),
            )
        except Exception:
            pass

    def _dashboard_url(self) -> str | None:
        code = self.config.get("fellowship_code", "")
        api = self.config.get("api_url", "").rstrip("/")
        if code and api:
            return f"{api}/app?code={code}"
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
        code = c.get("fellowship_code", "").strip()
        api = c.get("api_url", "https://fellowship-focus-production.up.railway.app").rstrip("/")
        self.invite_input.clear()
        if code:
            self.invite_input.setPlaceholderText(f"{api}/f/{code}")
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
        self.sites_edit.blockSignals(True)
        self.sites_edit.setPlainText("\n".join(c.get("blocked_sites", DEFAULT_BLOCKED_SITES)))
        self.sites_edit.blockSignals(False)
        self._sync_preset_ui()
        self.pomodoro.configure(
            self.work_spin.value(), self.break_spin.value(),
            self.long_break_spin.value(), self.intervals_spin.value(),
        )
        self._sync_focus_ring(f"{self.work_spin.value():02d}:00", "Ready", 1.0, False)
        self._refresh_journey()
        self._sync_shield_toggle()

    def _on_nav(self, index: int) -> None:
        self.stack.setCurrentIndex(index)
        titles = NavSidebar.NAV
        if 0 <= index < len(titles):
            self.page_title.setText(titles[index][0])
        # Fellowship web app: borderless immersive chrome
        immersive = index == 0
        self.sidebar.setVisible(not immersive)
        self.top_bar.setVisible(not immersive)
        if immersive:
            self._enter_immersive_window()
            self.web_dashboard.reload_dashboard()
        else:
            self._exit_immersive_window()
            if index == 1:
                self._refresh_journey()
            elif index == 6:
                self.usage_page.refresh()

    def showEvent(self, event) -> None:  # noqa: N802
        super().showEvent(event)
        if not getattr(self, "_media_hotkeys_done", False):
            self._media_hotkeys_done = True
            self._register_media_hotkeys()

    def _register_media_hotkeys(self) -> None:
        """Global Play/Pause for the focus music, even when the app is hidden.

        The music runs in this app's native player, so the keyboard's media
        Play/Pause key did nothing here. RegisterHotKey routes it to us; if
        another app already owns it, we fall back to Ctrl+Alt+Space.
        """
        if sys.platform != "win32":
            return
        try:
            import ctypes

            self._media_hotkey_ids = []
            hwnd = int(self.winId())
            VK_MEDIA_PLAY_PAUSE = 0xB3
            MOD_CONTROL, MOD_ALT, MOD_NOREPEAT = 0x0002, 0x0001, 0x4000
            VK_SPACE = 0x20
            # id 1: the dedicated media key (no modifier)
            if ctypes.windll.user32.RegisterHotKey(hwnd, 1, MOD_NOREPEAT, VK_MEDIA_PLAY_PAUSE):
                self._media_hotkey_ids.append(1)
            # id 2: Ctrl+Alt+Space fallback that no media app steals
            if ctypes.windll.user32.RegisterHotKey(
                hwnd, 2, MOD_CONTROL | MOD_ALT | MOD_NOREPEAT, VK_SPACE
            ):
                self._media_hotkey_ids.append(2)
        except Exception:
            pass

    def nativeEvent(self, event_type, message):  # noqa: N802
        # WM_HOTKEY = 0x0312 — toggle the music player.
        if sys.platform == "win32" and event_type == "windows_generic_MSG":
            try:
                import ctypes
                import ctypes.wintypes

                msg = ctypes.wintypes.MSG.from_address(int(message))
                if msg.message == 0x0312 and hasattr(self, "music_player"):
                    self.music_player.toggle_play()
            except Exception:
                pass
        return super().nativeEvent(event_type, message)

    def _enter_immersive_window(self) -> None:
        """The web tab used to force borderless fullscreen. For a timer and a
        block list that is oversized — and it took away move/resize/maximize.
        The web tab now lives in a normal framed window like every other tab;
        only the Qt sidebar/top bar hide (the web app has its own nav)."""
        self._immersive = False

    def _exit_immersive_window(self) -> None:
        self._immersive = False

    def keyPressEvent(self, event) -> None:  # noqa: N802
        # Esc on the web tab brings the native sidebar back
        if event.key() == Qt.Key.Key_Escape and not self.sidebar.isVisible():
            self.sidebar.setVisible(True)
            self.top_bar.setVisible(True)
            self._exit_immersive_window()
            # Jump to Dashboard without re-entering immersive
            self.sidebar.blockSignals(True)
            self.sidebar.set_current(1)
            self.sidebar.blockSignals(False)
            self.stack.setCurrentIndex(1)
            self.page_title.setText(NavSidebar.NAV[1][0])
            self._refresh_journey()
            return
        super().keyPressEvent(event)

    # ── Tray & lifecycle ───────────────────────────────────

    def _init_tray(self) -> None:
        from PySide6.QtWidgets import QMenu

        self.tray = QSystemTrayIcon(self)
        self._tray_menu = QMenu()
        self.tray.setContextMenu(self._tray_menu)
        self.tray.activated.connect(self._on_tray_activated)
        icon_path = resolve_app_icon_path()
        if icon_path:
            self.tray.setIcon(QIcon(str(icon_path)))
        else:
            self.tray.setIcon(self.windowIcon())
        self._refresh_tray_menu()
        self._update_tray_tooltip(0, "")
        self.tray.show()

    def _on_tray_activated(self, reason) -> None:
        if reason in (
            QSystemTrayIcon.ActivationReason.Trigger,
            QSystemTrayIcon.ActivationReason.DoubleClick,
        ):
            self._toggle_from_tray()

    def _maybe_nudge_session(self) -> None:
        """Offer to start a session when the user is working untracked."""
        import time

        from fellowship_focus.usage_tracker import idle_seconds

        # Never over an already-running session, a visible main window, or a
        # still-showing nudge; respect a snooze after a dismissal.
        if self.pomodoro.is_running or self._float_timer.is_session_active():
            self._nudge_active_streak = 0
            return
        if self.isVisible() and not self.isMinimized():
            return
        if self._nudge.isVisible():
            return
        if time.monotonic() < self._nudge_snooze_until:
            return

        # Require a genuine stretch of activity (idle < 60s) sustained across a
        # few ticks, so it fires on real work, not a passing mouse wiggle.
        if idle_seconds() < 60:
            self._nudge_active_streak += 1
        else:
            self._nudge_active_streak = 0
        if self._nudge_active_streak < 4:  # ~2 min of continuous activity
            return

        self._nudge_active_streak = 0
        self._nudge.show_nudge()

    def _on_nudge_accept(self) -> None:
        self._show_from_tray()
        if not self.pomodoro.is_running:
            self._start_pomodoro()

    def _on_nudge_dismiss(self) -> None:
        import time

        # Snooze 30 min so a "not now" is respected.
        self._nudge_snooze_until = time.monotonic() + 1800

    def _show_from_tray(self) -> None:
        self._apply_default_window_size()
        self.showNormal()
        self.raise_()
        self.activateWindow()
        QTimer.singleShot(50, self.web_dashboard._apply_zoom)

    def _toggle_from_tray(self) -> None:
        if self.isVisible() and not self.isMinimized():
            self.hide()
        else:
            self._show_from_tray()

    def _update_tray_tooltip(self, remaining: int, label: str) -> None:
        if remaining > 0 and label:
            m, s = divmod(remaining, 60)
            tip = f"Fellowship Focus · {label} {m:02d}:{s:02d}"
        elif self._float_timer.is_session_active():
            tip = f"Fellowship Focus · {self._float_timer.phase_label() or 'Focus'}"
        else:
            tip = "Fellowship Focus — click to open"
        self.tray.setToolTip(tip)

    def _refresh_tray_menu(self) -> None:
        menu = self._tray_menu
        menu.clear()

        active = self._float_timer.is_session_active()
        if active:
            rem = self._float_timer.remaining()
            m, s = divmod(max(0, rem), 60)
            status = menu.addAction(
                f"{self._float_timer.phase_label()}  {m:02d}:{s:02d}"
            )
            status.setEnabled(False)
            menu.addSeparator()

        if self.blocker_active or self._blocker_arming:
            shield_a = QAction("Stop blocking", self)
            shield_a.triggered.connect(self._on_shield_disarm)
            menu.addAction(shield_a)
            menu.addSeparator()

        show_a = QAction("Open Fellowship Focus", self)
        show_a.triggered.connect(self._show_from_tray)
        menu.addAction(show_a)

        hide_a = QAction("Hide window", self)
        hide_a.triggered.connect(self.hide)
        menu.addAction(hide_a)

        if active:
            menu.addSeparator()
            end_a = QAction("End focus session", self)
            end_a.triggered.connect(self._tray_end_session)
            menu.addAction(end_a)

            if self._float_timer.is_dismissed() or not self._float_timer.isVisible():
                show_float = QAction("Show floating timer", self)
                show_float.triggered.connect(self._float_timer.reshow)
                menu.addAction(show_float)

        menu.addSeparator()
        update_a = QAction("Check for updates", self)
        update_a.triggered.connect(self._check_updates_manual)
        menu.addAction(update_a)
        quit_a = QAction("Quit", self)
        quit_a.triggered.connect(self._quit_app)
        menu.addAction(quit_a)

    def _tray_end_session(self) -> None:
        self._float_timer.hide_timer()
        self._on_float_timer_closed()
        self._refresh_tray_menu()

    def _save_window_geometry(self) -> None:
        # Size is fixed at launch (1180×740). Persist position only so a move
        # across monitors is remembered without reopening oversized.
        try:
            pos = self.pos()
            self.config["window_x"] = int(pos.x())
            self.config["window_y"] = int(pos.y())
            self.config.pop("window_geometry", None)
            save_config(self.config)
        except Exception:
            pass

    def closeEvent(self, event: QCloseEvent) -> None:
        self._save_window_geometry()
        if self.config.get("minimize_to_tray", True):
            # An armed shield SURVIVES closing the window. The old behavior
            # silently released it here whenever no Qt pomodoro was running —
            # so arming from the web tab then closing the window killed the
            # blocker with a toast nobody could see. "Block N sites" means
            # blocked until the user says stop, window open or not.
            session_on = self._float_timer.is_session_active() or self.pomodoro.is_running
            event.ignore()
            self.hide()
            if self.blocker_active or self._blocker_arming:
                blocker_log("window closed to tray — shield stays armed")
                self.tray.showMessage(
                    "Still blocking",
                    "The shield stays up in the tray. Right-click the tray icon to stop it.",
                    QSystemTrayIcon.MessageIcon.Information,
                    3500,
                )
            elif session_on:
                if self._float_timer.isVisible():
                    self._float_timer.raise_()
                self.tray.showMessage(
                    "Focus continues",
                    "Timer keeps running. Right-click the tray icon for controls.",
                    QSystemTrayIcon.MessageIcon.Information,
                    3500,
                )
            return
        self._quit_app()

    def _quit_app(self) -> None:
        self._save_window_geometry()
        self.task_tick.stop()
        if hasattr(self, "music_player"):
            self.music_player.on_session_end()
        if hasattr(self, "usage_tracker"):
            self.usage_tracker.stop()
            self._sync_usage()
        if self.pomodoro.is_running:
            self._stop_pomodoro()
        if hasattr(self, "_float_timer"):
            self._float_timer.hide_timer()
        if hasattr(self, "_nudge"):
            self._nudge.hide()
        self._release_blocker_infra()
        self.tray.hide()
        QApplication.quit()


def run(start_minimized: bool = False) -> None:
    app = QApplication(sys.argv)
    app.setQuitOnLastWindowClosed(False)

    # Single instance. Without this, every extra double-click piled up another
    # app, and each newcomer's startup cleanup killed the previous instance's
    # proxy engine (seen live in proxy.log: shutdown 50 ms after listen).
    from PySide6.QtCore import QLockFile
    from pathlib import Path as _Path

    lock_dir = _Path.home() / ".fellowship-focus"
    lock_dir.mkdir(parents=True, exist_ok=True)
    _lock = QLockFile(str(lock_dir / "app.lock"))
    _lock.setStaleLockTime(0)  # a dead process must never block a relaunch
    if not _lock.tryLock(100):
        QMessageBox.information(
            None,
            "Fellowship Focus",
            "Fellowship Focus is already running — look for it in the system tray.",
        )
        sys.exit(0)
    run._lock = _lock  # keep a reference for the process lifetime
    icon_file = resolve_app_icon_path()
    if icon_file:
        app.setWindowIcon(QIcon(str(icon_file)))
    window = MainWindow()
    if start_minimized or "--minimized" in sys.argv:
        window.hide()
    else:
        # showNormal + re-apply size after show so Windows cannot reopen
        # maximized from the last session (that looked like "zoom in").
        window.showNormal()
        window._apply_default_window_size()
        QTimer.singleShot(0, window._apply_default_window_size)
        QTimer.singleShot(80, window.web_dashboard._apply_zoom)
    sys.exit(app.exec())
