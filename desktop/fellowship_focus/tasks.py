import json
import uuid
from pathlib import Path

TASKS_FILE = Path.home() / ".fellowship-focus" / "tasks.json"


def _ensure_dir() -> None:
    TASKS_FILE.parent.mkdir(parents=True, exist_ok=True)


def load_tasks() -> list[dict]:
    _ensure_dir()
    if not TASKS_FILE.exists():
        return []
    try:
        return json.loads(TASKS_FILE.read_text(encoding="utf-8"))
    except Exception:
        return []


def save_tasks(tasks: list[dict]) -> None:
    _ensure_dir()
    TASKS_FILE.write_text(json.dumps(tasks, indent=2), encoding="utf-8")


def new_task(title: str, parent_id: str | None = None) -> dict:
    return {
        "id": str(uuid.uuid4())[:8],
        "title": title,
        "completed": False,
        "parent_id": parent_id,
        "time_spent_seconds": 0,
        "estimate_minutes": 0,
    }


def add_task(title: str, parent_id: str | None = None) -> dict:
    tasks = load_tasks()
    task = new_task(title, parent_id)
    tasks.append(task)
    save_tasks(tasks)
    return task


def update_task(task_id: str, **fields) -> None:
    tasks = load_tasks()
    for t in tasks:
        if t["id"] == task_id:
            t.update(fields)
            break
    save_tasks(tasks)


def delete_task(task_id: str) -> None:
    tasks = load_tasks()
    ids_to_remove = {task_id}
    changed = True
    while changed:
        changed = False
        for t in tasks:
            if t.get("parent_id") in ids_to_remove and t["id"] not in ids_to_remove:
                ids_to_remove.add(t["id"])
                changed = True
    tasks = [t for t in tasks if t["id"] not in ids_to_remove]
    save_tasks(tasks)


def get_task(task_id: str) -> dict | None:
    for t in load_tasks():
        if t["id"] == task_id:
            return t
    return None


def format_time(seconds: int) -> str:
    h = seconds // 3600
    m = (seconds % 3600) // 60
    s = seconds % 60
    return f"{h:02d}:{m:02d}:{s:02d}"
