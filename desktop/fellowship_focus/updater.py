"""Auto-update — checks GitHub releases and git pull for source installs."""

from __future__ import annotations

import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

import requests

from fellowship_focus.version import APP_VERSION, GITHUB_RELEASES_URL, GITHUB_REPO

REPO_ROOT = Path(__file__).resolve().parents[2]


@dataclass
class UpdateInfo:
    available: bool
    current: str
    latest: str
    release_notes: str
    release_url: str
    can_auto_apply: bool
    message: str


def _parse_version(tag: str) -> tuple[int, ...]:
    nums = re.findall(r"\d+", tag)
    return tuple(int(n) for n in nums) if nums else (0,)


def _is_git_repo(path: Path) -> bool:
    return (path / ".git").exists()


def _git_behind_remote() -> int | None:
    """Commits behind origin/master, or None if not a git repo."""
    if not _is_git_repo(REPO_ROOT):
        return None
    try:
        subprocess.run(
            ["git", "fetch", "origin", "master", "--quiet"],
            cwd=REPO_ROOT,
            capture_output=True,
            timeout=30,
            creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0,
        )
        result = subprocess.run(
            ["git", "rev-list", "--count", "HEAD..origin/master"],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            timeout=10,
            creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0,
        )
        if result.returncode == 0:
            return int(result.stdout.strip() or "0")
    except Exception:
        pass
    return None


def check_for_updates(timeout: int = 8) -> UpdateInfo:
    current = APP_VERSION
    latest = current
    notes = ""
    url = f"https://github.com/{GITHUB_REPO}/releases/latest"

    try:
        r = requests.get(
            GITHUB_RELEASES_URL,
            headers={"Accept": "application/vnd.github+json"},
            timeout=timeout,
        )
        if r.status_code == 200:
            data = r.json()
            latest = (data.get("tag_name") or data.get("name") or current).lstrip("v")
            notes = (data.get("body") or "")[:300]
            url = data.get("html_url") or url
    except Exception:
        behind = _git_behind_remote()
        if behind and behind > 0:
            return UpdateInfo(
                available=True,
                current=current,
                latest=f"+{behind} commits",
                release_notes="Git updates on origin/master",
                release_url=f"https://github.com/{GITHUB_REPO}",
                can_auto_apply=True,
                message=f"{behind} update(s) available on GitHub — click to install.",
            )
        return UpdateInfo(
            available=False,
            current=current,
            latest=current,
            release_notes="",
            release_url=url,
            can_auto_apply=False,
            message="Could not reach GitHub — offline mode.",
        )

    behind = _git_behind_remote()
    version_newer = _parse_version(latest) > _parse_version(current)
    git_newer = bool(behind and behind > 0)

    if version_newer or git_newer:
        msg = f"v{latest} available" if version_newer else f"{behind} git commit(s) behind"
        if git_newer and _is_git_repo(REPO_ROOT):
            msg += " — auto-update ready"
        return UpdateInfo(
            available=True,
            current=current,
            latest=latest if version_newer else f"{current} (+{behind})",
            release_notes=notes,
            release_url=url,
            can_auto_apply=git_newer and _is_git_repo(REPO_ROOT),
            message=msg,
        )

    return UpdateInfo(
        available=False,
        current=current,
        latest=latest,
        release_notes=notes,
        release_url=url,
        can_auto_apply=False,
        message=f"Up to date (v{current})",
    )


def apply_git_update() -> tuple[bool, str]:
    if not _is_git_repo(REPO_ROOT):
        return False, "Not a git install — download from GitHub releases."
    try:
        result = subprocess.run(
            ["git", "pull", "origin", "master"],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            timeout=120,
            creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0,
        )
        if result.returncode == 0:
            return True, "Updated! Restart Fellowship Focus to apply."
        return False, result.stderr or result.stdout or "git pull failed"
    except Exception as e:
        return False, str(e)
