#!/usr/bin/env python3
"""Trim promo intros/outros and rename focus tracks to clean focus-{id}.mp3 names.

Reads trim offsets from the same catalog as the web UI (exported JSON beside this script,
or the embedded FALLBACK below). Writes into ~/.fellowship-focus/music and mirrors to
web/public/audio + desktop/assets/music.
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
USER_MUSIC = Path.home() / ".fellowship-focus" / "music"
WEB_AUDIO = ROOT / "web" / "public" / "audio"
DESKTOP_MUSIC = ROOT / "desktop" / "assets" / "music"
CATALOG_JSON = Path(__file__).with_name("focus_music_catalog.json")

# Keep in sync with web/src/lib/focusMusic.ts (title, youtubeId, trimStart, trimEnd).
FALLBACK = [
    {"title": "CEO Penthouse", "youtubeId": "OWz7HiR6H-0", "trimStart": 14, "trimEnd": 18},
    {"title": "Hyperfocus Café", "youtubeId": "hpAD6SGi3j8", "trimStart": 12, "trimEnd": 16},
    {"title": "When the Stakes Are High", "youtubeId": "TIqsKXQHvFI", "trimStart": 10, "trimEnd": 14},
    {"title": "Force", "youtubeId": "WMdhPtS5vio", "trimStart": 8, "trimEnd": 12},
    {"title": "Spice Meditation", "youtubeId": "R75oWuI4te4", "trimStart": 12, "trimEnd": 16},
    {"title": "Deep Work Mix", "youtubeId": "UDTmUzu05BE", "trimStart": 14, "trimEnd": 18},
    {"title": "Dwarf Mountain Journey", "youtubeId": "4WIMyqBG9gs", "trimStart": 10, "trimEnd": 14},
    {"title": "Trap Beats for Work", "youtubeId": "7VAUDImpqGQ", "trimStart": 12, "trimEnd": 16},
    {"title": "Serious Grind", "youtubeId": "MYW0TgV67RE", "trimStart": 12, "trimEnd": 16},
    {"title": "Lock In", "youtubeId": "EN0A5derVo0", "trimStart": 12, "trimEnd": 16},
    {"title": "Peak Performance", "youtubeId": "5_4KRUx2iKY", "trimStart": 14, "trimEnd": 20},
    {"title": "Hyper Focus Mode", "youtubeId": "eo1gKGt6h9M", "trimStart": 14, "trimEnd": 18},
    {"title": "CEO Zero Distraction", "youtubeId": "ahawPLh4epk", "trimStart": 12, "trimEnd": 16},
    {"title": "Brain Performance", "youtubeId": "GaTy0vRmT9E", "trimStart": 14, "trimEnd": 18},
    {"title": "Super Focus Alpha", "youtubeId": "p2_zDvtPQ-g", "trimStart": 15, "trimEnd": 18},
    {"title": "Flow State Chillstep", "youtubeId": "am1VJP0RnmQ", "trimStart": 10, "trimEnd": 14},
    {"title": "Deep Future Garage", "youtubeId": "T2QZpy07j4s", "trimStart": 12, "trimEnd": 16},
    {"title": "Dreamlight 30m", "youtubeId": "UpPmnnJcy6A", "trimStart": 6, "trimEnd": 8},
    {"title": "Chill Deep Focus", "youtubeId": "-sZqtdT-GVw", "trimStart": 12, "trimEnd": 16},
    {"title": "Classical Study", "youtubeId": "mdJU5ogrPMY", "trimStart": 4, "trimEnd": 8},
]

YT_RE = re.compile(r"\[([A-Za-z0-9_-]{6,})\]")
FOCUS_RE = re.compile(r"^focus-([A-Za-z0-9_-]{6,})\.mp3$", re.I)


def load_catalog() -> list[dict]:
    if CATALOG_JSON.exists():
        return json.loads(CATALOG_JSON.read_text(encoding="utf-8"))
    return FALLBACK


def find_ffmpeg() -> str:
    which = shutil.which("ffmpeg")
    if which:
        return which
    candidate = Path(r"C:\ffmpeg\ffmpeg-master-latest-win64-gpl\bin\ffmpeg.exe")
    if candidate.exists():
        return str(candidate)
    raise SystemExit("ffmpeg not found on PATH")


def find_ffprobe(ffmpeg: str) -> str:
    p = Path(ffmpeg).with_name("ffprobe.exe" if sys.platform == "win32" else "ffprobe")
    if p.exists():
        return str(p)
    which = shutil.which("ffprobe")
    if which:
        return which
    raise SystemExit("ffprobe not found")


def duration_seconds(ffprobe: str, path: Path) -> float:
    out = subprocess.check_output(
        [
            ffprobe,
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(path),
        ],
        text=True,
    ).strip()
    return float(out)


def youtube_id_from_name(name: str) -> str | None:
    m = YT_RE.search(name)
    if m:
        return m.group(1)
    m = FOCUS_RE.match(name)
    if m:
        return m.group(1)
    return None


def find_source(yt: str, folders: list[Path]) -> Path | None:
    # Prefer already-clean focus-{id}.mp3 only if no original SEO-named source exists,
    # so re-runs don't double-trim. Prefer longest file for an id (usually the original).
    candidates: list[Path] = []
    for folder in folders:
        if not folder.exists():
            continue
        for path in folder.iterdir():
            if path.suffix.lower() != ".mp3":
                continue
            if youtube_id_from_name(path.name) == yt:
                candidates.append(path)
    if not candidates:
        return None
    # Prefer non-focus- named originals (longer SEO names) when present.
    originals = [p for p in candidates if not p.name.lower().startswith("focus-")]
    pool = originals or candidates
    return max(pool, key=lambda p: p.stat().st_size)


def trim_one(
    ffmpeg: str,
    ffprobe: str,
    src: Path,
    dest: Path,
    trim_start: float,
    trim_end: float,
) -> None:
    total = duration_seconds(ffprobe, src)
    keep = total - trim_start - trim_end
    if keep < 60:
        raise RuntimeError(f"trim too aggressive for {src.name}: {total:.1f}s → {keep:.1f}s")
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(".tmp.mp3")
    cmd = [
        ffmpeg,
        "-y",
        "-ss",
        f"{trim_start:.3f}",
        "-i",
        str(src),
        "-t",
        f"{keep:.3f}",
        "-c:a",
        "libmp3lame",
        "-q:a",
        "3",
        str(tmp),
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    tmp.replace(dest)


def write_manifest(catalog: list[dict], audio_dir: Path) -> None:
    entries = []
    for track in catalog:
        yt = track["youtubeId"]
        name = f"focus-{yt}.mp3"
        if (audio_dir / name).exists():
            entries.append({"title": track["title"], "src": f"/audio/{name}", "youtubeId": yt})
    entries.sort(key=lambda e: e["title"].lower())
    audio_dir.mkdir(parents=True, exist_ok=True)
    (audio_dir / "manifest.json").write_text(
        json.dumps(entries, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )


def main() -> None:
    catalog = load_catalog()
    ffmpeg = find_ffmpeg()
    ffprobe = find_ffprobe(ffmpeg)
    USER_MUSIC.mkdir(parents=True, exist_ok=True)
    WEB_AUDIO.mkdir(parents=True, exist_ok=True)
    DESKTOP_MUSIC.mkdir(parents=True, exist_ok=True)

    search = [USER_MUSIC, WEB_AUDIO, DESKTOP_MUSIC]
    done = 0
    for track in catalog:
        yt = track["youtubeId"]
        title = track["title"]
        src = find_source(yt, search)
        if not src:
            print(f"SKIP missing {yt} ({title})")
            continue
        dest = USER_MUSIC / f"focus-{yt}.mp3"
        print(
            f"TRIM {src.name}\n  → {dest.name}  "
            f"(-{track['trimStart']}s / -{track['trimEnd']}s)  {title}"
        )
        trim_one(
            ffmpeg,
            ffprobe,
            src,
            dest,
            float(track["trimStart"]),
            float(track["trimEnd"]),
        )
        for mirror in (WEB_AUDIO / dest.name, DESKTOP_MUSIC / dest.name):
            shutil.copy2(dest, mirror)
        done += 1

    # Remove old SEO-titled duplicates so the player shows 20 clean tracks, not 40.
    keep_names = {f"focus-{t['youtubeId']}.mp3".lower() for t in catalog}
    for folder in (USER_MUSIC, WEB_AUDIO, DESKTOP_MUSIC):
        if not folder.exists():
            continue
        for path in list(folder.glob("*.mp3")):
            if path.name.lower() in keep_names:
                continue
            yt = youtube_id_from_name(path.name)
            if yt and any(t["youtubeId"] == yt for t in catalog):
                print(f"DEL duplicate {folder.name}/{path.name}")
                path.unlink(missing_ok=True)

    write_manifest(catalog, WEB_AUDIO)
    print(f"Done: {done}/{len(catalog)} trimmed + synced")


if __name__ == "__main__":
    main()
