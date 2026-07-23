#!/usr/bin/env python3
"""Trim + sync only newly added Warhammer tracks (do not re-trim existing library)."""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
USER = Path.home() / ".fellowship-focus" / "music"
WEB = ROOT / "web" / "public" / "audio"
DESK = ROOT / "desktop" / "assets" / "music"
CATALOG = Path(__file__).with_name("focus_music_catalog.json")
NEW_IDS = {
    "Ykem_yAFh2A",
    "hmQWkH12CD4",
    "6Pxlq32dGtQ",
    "VWGr_89_xdU",
    "k_YK5V2WxIA",
    "MDy0IrSJrlM",
    "k5xDyG72wHE",
}
FFMPEG = r"C:\ffmpeg\ffmpeg-master-latest-win64-gpl\bin\ffmpeg.exe"
FFPROBE = r"C:\ffmpeg\ffmpeg-master-latest-win64-gpl\bin\ffprobe.exe"


def duration(path: Path) -> float:
    out = subprocess.check_output(
        [
            FFPROBE,
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


def main() -> None:
    cat = json.loads(CATALOG.read_text(encoding="utf-8"))
    WEB.mkdir(parents=True, exist_ok=True)
    DESK.mkdir(parents=True, exist_ok=True)

    for t in cat:
        yt = t["youtubeId"]
        if yt not in NEW_IDS:
            continue
        src = USER / f"focus-{yt}.mp3"
        if not src.exists() or src.stat().st_size < 1_000_000:
            print(f"SKIP missing {yt}")
            continue
        mark = USER / f"focus-{yt}.trimmed"
        if mark.exists():
            print(f"SKIP already trimmed {yt}")
            for m in (WEB / src.name, DESK / src.name):
                if not m.exists():
                    shutil.copy2(src, m)
            continue

        total = duration(src)
        keep = total - float(t["trimStart"]) - float(t["trimEnd"])
        print(f"TRIM {yt} {total:.0f}s -> {keep:.0f}s ({t['title']})", flush=True)
        tmp = USER / f"focus-{yt}.tmp.mp3"
        subprocess.run(
            [
                FFMPEG,
                "-y",
                "-ss",
                str(t["trimStart"]),
                "-i",
                str(src),
                "-t",
                f"{keep:.3f}",
                "-c:a",
                "libmp3lame",
                "-q:a",
                "3",
                str(tmp),
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        tmp.replace(src)
        mark.write_text("ok", encoding="utf-8")
        for m in (WEB / src.name, DESK / src.name):
            shutil.copy2(src, m)
            print(f"  synced {m}", flush=True)

    # Full manifest from catalog ∩ local files; ensure mirrors exist.
    entries = []
    for t in cat:
        name = f"focus-{t['youtubeId']}.mp3"
        src = USER / name
        if not src.exists():
            continue
        for m in (WEB / name, DESK / name):
            if not m.exists() or m.stat().st_size != src.stat().st_size:
                shutil.copy2(src, m)
        entries.append({"title": t["title"], "src": f"/audio/{name}", "youtubeId": t["youtubeId"]})
    # Preserve catalog order (preferred defaults first); do not A–Z sort.
    (WEB / "manifest.json").write_text(
        json.dumps(entries, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(f"manifest {len(entries)}", flush=True)


if __name__ == "__main__":
    main()
