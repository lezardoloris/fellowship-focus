"""Build multi-size Windows .ico from the Fellowship Focus app icon PNG."""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
SOURCES = ("app-icon.png", "shield-logo.png")
ICO_PATH = ASSETS / "fellowship.ico"
ICO_SIZES = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]


def find_source() -> Path | None:
    for name in SOURCES:
        path = ASSETS / name
        if path.exists():
            return path
    return None


def square_crop(im: Image.Image) -> Image.Image:
    w, h = im.size
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    return im.crop((left, top, left + side, top + side))


def build_icon(source: Path | None = None, out: Path = ICO_PATH) -> Path:
    src = source or find_source()
    if src is None:
        raise FileNotFoundError(f"No icon source found in {ASSETS} ({', '.join(SOURCES)})")

    im = Image.open(src).convert("RGBA")
    im = square_crop(im)
    out.parent.mkdir(parents=True, exist_ok=True)
    im.save(out, format="ICO", sizes=ICO_SIZES)
    print(f"Built {out} ({out.stat().st_size // 1024} KB) from {src.name}")
    return out


if __name__ == "__main__":
    try:
        build_icon(Path(sys.argv[1]) if len(sys.argv) > 1 else None)
    except FileNotFoundError as exc:
        print(exc, file=sys.stderr)
        sys.exit(1)
