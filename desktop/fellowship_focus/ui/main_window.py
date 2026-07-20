import sys
import webbrowser
from pathlib import Path

from PySide6.QtCore import Qt, QTimer
from PySide6.QtGui import QAction, QCloseEvent, QIcon, QPixmap
from PySide6.QtWidgets import (
    QApplication,
    QCheckBox,
    QComboBox,
    QFormLayout,
    QFrame,
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

from fellowship_focus.api_client import FellowshipApi
from fellowship_focus.blocker.manager import (
    find_mitmdump,
    set_system_proxy,
    shutdown_mitmdump_gracefully,
    start_mitmdump,
)
from fellowship_focus.cert_setup import install_cert_windows, is_cert_installed, is_cert_generated
from fellowship_focus.config import load_config, save_config
from fellowship_focus.constants import DEFAULT_BLOCKED_SITES
from fellowship_focus.pomodoro_engine import PomodoroEngine
from fellowship_focus.startup import is_startup_enabled, set_startup_enabled
from fellowship_focus.tasks import (
    add_task,
    delete_task,
    format_time,
    get_task,
    load_tasks,
    update_task,
)
from fellowship_focus.ui.dashboard import DashboardPage
from fellowship_focus.ui.theme import ASSETS_DIR, app_stylesheet, font_display, font_sans, font_timer, load_fonts
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
        self.pomodoro.tick.connect(self._on_pomo_tick)
        self.pomodoro.phase_changed.connect(self._on_pomo_phase)
        self.pomodoro.session_finished.connect(self._on_pomo_finished)

        self.setWindowTitle(f"Fellowship Focus v{APP_VERSION}")
        self.setMinimumSize(960, 640)
        self.resize(1040, 720)
        load_fonts()
        self.setStyleSheet(app_stylesheet())
        self.setFont(font_sans())

        self.toasts = ToastManager(self)
        self._fellowship_cache: dict | None = None

        root = QWidget()
        self.setCentralWidget(root)
        outer = QHBoxLayout(root)
        outer.setContentsMargins(0, 0, 0, 0)
        outer.setSpacing(0)

        self.sidebar = QListWidget()
        self.sidebar.setFixedWidth(210)
        self.sidebar.setObjectName("navList")
        self.sidebar.setFont(font_sans(13))

        brand = QLabel("FELLOWSHIP\nFOCUS")
        brand.setObjectName("brandTitle")
        brand.setFont(font_display(10, bold=True))
        brand.setAlignment(Qt.AlignmentFlag.AlignCenter)
        brand.setStyleSheet("padding: 22px 8px 10px; color: #d4af37; line-height: 1.5;")

        sidebar_wrap = QWidget()
        sidebar_wrap.setObjectName("sidebarPanel")
        sidebar_wrap.setFixedWidth(210)
        sb_layout = QVBoxLayout(sidebar_wrap)
        sb_layout.setContentsMargins(0, 0, 0, 0)
        sb_layout.addWidget(brand)
        sb_layout.addWidget(self.sidebar, 1)

        nav_items = [
            "  Fellowship",
            "  Overview",
            "  Tasks",
            "  Pomodoro",
            "  Blocker",
            "  Settings",
        ]
        for label in nav_items:
            self.sidebar.addItem(QListWidgetItem(label))
        self.sidebar.currentRowChanged.connect(self._on_nav)
        outer.addWidget(sidebar_wrap)

        line = QFrame()
        line.setFrameShape(QFrame.Shape.VLine)
        line.setStyleSheet("background: #2a3528;")
        outer.addWidget(line)

        self.stack = QStackedWidget()
        self.stack.setObjectName("contentArea")
        outer.addWidget(self.stack, 1)

        self.web_dashboard = WebDashboardPage(lambda: self.config, self._open_dashboard)
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
        self.sidebar.setCurrentRow(0)

        if not is_cert_installed():
            self.sidebar.setCurrentRow(4)
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
        self.sidebar.setCurrentRow(3)
        self._start_pomodoro()

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
        layout.setContentsMargins(20, 16, 20, 16)

        header = QHBoxLayout()
        title = QLabel("Tasks")
        title.setObjectName("goldTitle")
        title.setFont(font_display(20, bold=True))
        header.addWidget(title)
        header.addStretch()
        for text, slot in [("+", self._add_task), ("✎", self._edit_task), ("🗑", self._delete_task)]:
            btn = QPushButton(text)
            btn.setFixedSize(36, 36)
            btn.clicked.connect(slot)
            header.addWidget(btn)
        layout.addLayout(header)

        layout.addWidget(QLabel("To Do Tasks"))
        self.todo_list = QListWidget()
        self.todo_list.setObjectName("taskList")
        self.todo_list.itemClicked.connect(self._select_task)
        self.todo_list.itemDoubleClicked.connect(lambda _: self._start_task_pomodoro())
        layout.addWidget(self.todo_list, 2)

        layout.addWidget(QLabel("Completed Tasks"))
        self.done_list = QListWidget()
        self.done_list.setObjectName("taskList")
        layout.addWidget(self.done_list, 1)

        play_row = QHBoxLayout()
        self.play_task_btn = QPushButton("▶  Start Pomodoro on selected task")
        self.play_task_btn.setObjectName("goldBtn")
        self.play_task_btn.clicked.connect(self._start_task_pomodoro)
        play_row.addWidget(self.play_task_btn)
        layout.addLayout(play_row)

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
        text = f"{indent}▶ {task['title']}     {spent} / {est_str}"
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
        self.sidebar.setCurrentRow(3)
        self._start_pomodoro()

    def _check_updates_silent(self) -> None:
        if not self.config.get("auto_update", True):
            return
        info = check_for_updates()
        if info.available:
            self.toasts.show(
                "Update available",
                info.message,
                "info",
                8000,
            )
            if info.can_auto_apply:
                self._pending_update = info

    def _apply_update(self) -> None:
        ok, msg = apply_git_update()
        self.toasts.show("Update", msg, "success" if ok else "warning", 6000)

    def _check_updates_manual(self) -> None:
        info = check_for_updates()
        if info.available:
            self.toasts.show(f"Update — v{info.latest}", info.message, "info", 8000)
            if info.can_auto_apply:
                self._apply_update()
        else:
            self.toasts.show("Up to date", info.message, "success", 3000)

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
        layout = QVBoxLayout(page)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        banner = QLabel()
        banner.setFixedHeight(120)
        banner.setScaledContents(True)
        hero = ASSETS_DIR / "hero.jpg"
        if hero.exists():
            banner.setPixmap(QPixmap(str(hero)))
        overlay = QLabel(banner)
        overlay.setGeometry(0, 0, 700, 120)
        overlay.setStyleSheet("background: rgba(6,8,6,0.65);")
        overlay.setText("  Pomodoro Quest")
        overlay.setObjectName("sectionTitle")
        layout.addWidget(banner)

        inner = QWidget()
        v = QVBoxLayout(inner)
        v.setContentsMargins(24, 20, 24, 16)
        self.current_task_label = QLabel("No task selected")
        self.current_task_label.setStyleSheet("color: #888; font-style: italic;")
        self.current_task_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        v.addWidget(self.current_task_label)

        self.phase_label = QLabel("Ready")
        self.phase_label.setObjectName("phaseLabel")
        self.phase_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        v.addWidget(self.phase_label)

        self.timer_label = QLabel("25:00")
        self.timer_label.setObjectName("bigTimer")
        self.timer_label.setFont(font_timer(58))
        self.timer_label.setStyleSheet("color: #d4af37;")
        self.timer_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        v.addWidget(self.timer_label)

        self.waypoint_label = QLabel("")
        self.waypoint_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.waypoint_label.setWordWrap(True)
        self.waypoint_label.setStyleSheet("color: #666; padding: 8px;")
        v.addWidget(self.waypoint_label)

        btn_row = QHBoxLayout()
        self.pomo_start_btn = QPushButton("▶ Start")
        self.pomo_start_btn.setObjectName("goldBtn")
        self.pomo_start_btn.clicked.connect(self._start_pomodoro)
        self.pomo_pause_btn = QPushButton("⏸ Pause")
        self.pomo_pause_btn.clicked.connect(self._pause_pomodoro)
        self.pomo_pause_btn.setEnabled(False)
        self.pomo_stop_btn = QPushButton("■ Stop")
        self.pomo_stop_btn.setObjectName("dangerBtn")
        self.pomo_stop_btn.clicked.connect(self._stop_pomodoro)
        self.pomo_stop_btn.setEnabled(False)
        self.pomo_skip_btn = QPushButton("⏭ Skip")
        self.pomo_skip_btn.clicked.connect(self.pomodoro.skip)
        self.pomo_skip_btn.setEnabled(False)
        for b in [self.pomo_start_btn, self.pomo_pause_btn, self.pomo_stop_btn, self.pomo_skip_btn]:
            btn_row.addWidget(b)
        v.addLayout(btn_row)

        settings = QFormLayout()
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
        settings.addRow("Work", self.work_spin)
        settings.addRow("Break", self.break_spin)
        settings.addRow("Long break", self.long_break_spin)
        settings.addRow("Intervals", self.intervals_spin)
        save_pomo = QPushButton("Save durations")
        save_pomo.clicked.connect(self._save_pomo_settings)
        settings.addRow("", save_pomo)
        v.addLayout(settings)
        v.addStretch()
        layout.addWidget(inner, 1)
        self.stack.addWidget(page)

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

    def _pause_pomodoro(self) -> None:
        paused = self.pomodoro.pause_resume()
        self.pomo_pause_btn.setText("▶ Resume" if paused else "⏸ Pause")
        if paused:
            self.task_tick.stop()
            self._disable_blocker()
        elif self.pomodoro.is_work_phase:
            self.task_tick.start(1000)
            if self.config.get("enable_website_blocker", True):
                self._enable_blocker()

    def _stop_pomodoro(self) -> None:
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
        self.timer_label.setText(f"{self.work_spin.value():02d}:00")
        self.phase_label.setText("Ready")

    def _set_pomo_buttons(self, running: bool) -> None:
        self.pomo_start_btn.setEnabled(not running)
        self.pomo_pause_btn.setEnabled(running)
        self.pomo_stop_btn.setEnabled(running)
        self.pomo_skip_btn.setEnabled(running)
        self.pomo_pause_btn.setText("⏸ Pause")

    def _on_pomo_tick(self, remaining: int, phase: str) -> None:
        m, s = divmod(remaining, 60)
        self.timer_label.setText(f"{m:02d}:{s:02d}")
        self.phase_label.setText(phase)

    def _on_pomo_phase(self, phase: str) -> None:
        if phase == PomodoroEngine.PHASE_WORK and self.config.get("enable_website_blocker", True):
            self._enable_blocker()
        else:
            self._disable_blocker()

    def _on_pomo_finished(self, completed: bool, work_minutes: int) -> None:
        self._disable_blocker()
        self._set_pomo_buttons(running=False)
        if work_minutes > 0:
            api = FellowshipApi(self.config.get("api_url", ""), self.config.get("member_token", ""))
            result = api.log_session(work_minutes, completed)
            xp = result.get("xpEarned", 0) if result else 0
            if completed and xp:
                self.toasts.show("Quest complete!", f"+{xp} XP earned", "success")
        self._refresh_journey()

    # ── Website Blocker ────────────────────────────────────

    def _build_blocker_page(self) -> None:
        page = QWidget()
        layout = QVBoxLayout(page)
        layout.setContentsMargins(20, 16, 20, 16)

        layout.addWidget(QLabel("Website Blocker"))
        layout.addWidget(QLabel(
            "System-wide blocking via mitmproxy (same as Koncentro).\n"
            "Install the certificate once, then sites are blocked in all browsers during focus.\n"
            "Default list: social feeds, streaming, NSFW (edit below)."
        ))

        self.blocker_enabled_check = QCheckBox("Enable website blocker during Pomodoro work intervals")
        self.blocker_enabled_check.setChecked(True)
        layout.addWidget(self.blocker_enabled_check)

        layout.addWidget(QLabel("Blocked sites (one per line):"))
        self.sites_edit = QTextEdit()
        self.sites_edit.setPlainText("\n".join(DEFAULT_BLOCKED_SITES))
        layout.addWidget(self.sites_edit)

        self.blocker_status = QLabel("")
        layout.addWidget(self.blocker_status)

        cert_row = QHBoxLayout()
        gen_btn = QPushButton("Generate certificate")
        gen_btn.clicked.connect(self._generate_cert)
        inst_btn = QPushButton("Install certificate")
        inst_btn.setObjectName("goldBtn")
        inst_btn.clicked.connect(self._install_cert)
        cert_row.addWidget(gen_btn)
        cert_row.addWidget(inst_btn)
        layout.addLayout(cert_row)

        save_btn = QPushButton("Save blocker settings")
        save_btn.clicked.connect(self._save_blocker_settings)
        layout.addWidget(save_btn)
        layout.addStretch()
        self.stack.addWidget(page)
        self._update_blocker_status()

    def _save_blocker_settings(self) -> None:
        sites = [s.strip() for s in self.sites_edit.toPlainText().splitlines() if s.strip()]
        self.config["blocked_sites"] = sites or DEFAULT_BLOCKED_SITES
        self.config["enable_website_blocker"] = self.blocker_enabled_check.isChecked()
        save_config(self.config)
        QMessageBox.information(self, "Saved", "Blocker settings saved.")

    def _update_blocker_status(self) -> None:
        gen = "✅" if is_cert_generated() else "❌"
        inst = "✅ Permanent" if is_cert_installed() else "❌ Install once"
        active = "🛡️ ACTIVE" if self.blocker_active else "Standby"
        self.blocker_status.setText(
            f"Certificate file: {gen}  ·  Windows trust: {inst}  ·  Blocker: {active}\n"
            "Once installed, the certificate stays — no need to reinstall."
        )

    def _ensure_blocker_ready(self) -> bool:
        if not is_cert_installed():
            QMessageBox.warning(self, "Certificate", "Install mitmproxy certificate first (Blocker tab).")
            self.sidebar.setCurrentRow(4)
            return False
        if not find_mitmdump():
            QMessageBox.critical(self, "Error", "mitmdump not found.")
            return False
        return True

    def _enable_blocker(self) -> None:
        if self.blocker_active:
            return
        sites = self.config.get("blocked_sites", DEFAULT_BLOCKED_SITES)
        self.mitm_process = start_mitmdump(
            sites,
            self.config.get("api_url", ""),
            self.config.get("member_token", ""),
        )
        if self.mitm_process:
            set_system_proxy(True)
            self.blocker_active = True
            self._update_blocker_status()

    def _disable_blocker(self) -> None:
        if not self.blocker_active:
            return
        shutdown_mitmdump_gracefully()
        set_system_proxy(False)
        self.blocker_active = False
        self._update_blocker_status()

    # ── Fellowship ─────────────────────────────────────────

    def _build_fellowship_page(self) -> None:
        page = QWidget()
        layout = QVBoxLayout(page)
        layout.setContentsMargins(20, 16, 20, 16)
        title = QLabel("Guild Settings")
        title.setObjectName("goldTitle")
        title.setFont(font_display(20, bold=True))
        layout.addWidget(title)

        form = QFormLayout()
        self.api_url_input = QLineEdit()
        self.token_input = QLineEdit()
        self.token_input.setEchoMode(QLineEdit.EchoMode.Password)
        self.code_input = QLineEdit()
        self.name_input = QLineEdit()
        self.tray_check = QCheckBox("Minimize to system tray when closing")
        self.startup_check = QCheckBox("Start with Windows (minimized, non-intrusive)")
        self.start_min_check = QCheckBox("Start minimized to tray")
        self.auto_update_check = QCheckBox("Check for updates automatically (GitHub)")
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
        form.addRow("API URL", self.api_url_input)
        form.addRow("Member token", self.token_input)
        form.addRow("Fellowship code", self.code_input)
        form.addRow("Your name", self.name_input)
        form.addRow("OKR focus", self.okr_focus_spin)
        form.addRow("OKR habits", self.okr_habit_spin)
        form.addRow("OKR revenue target", self.okr_revenue_spin)
        form.addRow("Revenue this month", self.okr_revenue_current)
        form.addRow("", self.tray_check)
        form.addRow("", self.startup_check)
        form.addRow("", self.start_min_check)
        form.addRow("", self.auto_update_check)
        layout.addLayout(form)

        row = QHBoxLayout()
        save_btn = QPushButton("Save")
        save_btn.clicked.connect(self._save_fellowship_settings)
        dash_btn = QPushButton("Open dashboard")
        dash_btn.setObjectName("goldBtn")
        dash_btn.clicked.connect(self._open_dashboard)
        row.addWidget(save_btn)
        row.addWidget(dash_btn)
        layout.addLayout(row)
        layout.addStretch()
        self.stack.addWidget(page)

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
            f"📍 {wp['name']} — {data['totalXp']:,} XP · {data['journey']['progress']}% to next waypoint"
        )
        self.dashboard_page.update_data(data, self.config)

    def _open_dashboard(self) -> None:
        code = self.config.get("fellowship_code", "")
        if code:
            webbrowser.open(f"{self.config.get('api_url', 'http://localhost:3000').rstrip('/')}/f/{code}")

    def _load_config_to_ui(self) -> None:
        c = self.config
        self.api_url_input.setText(c.get("api_url", "http://localhost:3000"))
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
        self.work_spin.setValue(c.get("work_duration", 25))
        self.break_spin.setValue(c.get("break_duration", 5))
        self.long_break_spin.setValue(c.get("long_break_duration", 15))
        self.intervals_spin.setValue(c.get("work_intervals", 2))
        self.blocker_enabled_check.setChecked(c.get("enable_website_blocker", True))
        self.sites_edit.setPlainText("\n".join(c.get("blocked_sites", DEFAULT_BLOCKED_SITES)))
        self.pomodoro.configure(
            self.work_spin.value(), self.break_spin.value(),
            self.long_break_spin.value(), self.intervals_spin.value(),
        )
        self.timer_label.setText(f"{self.work_spin.value():02d}:00")
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
        if index == 0:
            self.web_dashboard.reload_dashboard()

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
        icon_path = ASSETS_DIR / "fellowship.jpg"
        if icon_path.exists():
            self.tray.setIcon(QIcon(str(icon_path)))
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
