"""Generate premium gradient placeholder assets (no API key needed)."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


def _gradient(size: tuple[int, int], top: tuple, bottom: tuple) -> Image.Image:
    w, h = size
    img = Image.new("RGB", size)
    draw = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(h - 1, 1)
        r = int(top[0] * (1 - t) + bottom[0] * t)
        g = int(top[1] * (1 - t) + bottom[1] * t)
        b = int(top[2] * (1 - t) + bottom[2] * t)
        draw.line([(0, y), (w, y)], fill=(r, g, b))
    return img


def _vignette(img: Image.Image) -> Image.Image:
    w, h = img.size
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    draw.ellipse([-w * 0.2, h * 0.1, w * 1.2, h * 1.4], fill=(6, 8, 6, 120))
    draw.rectangle([0, 0, w, h // 3], fill=(6, 8, 6, 80))
    return Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")


def hero_banner() -> Image.Image:
    img = _gradient((1920, 1080), (26, 42, 28), (8, 10, 8))
    draw = ImageDraw.Draw(img)
    for i in range(6):
        y = 420 + i * 18
        draw.line([(0, y), (1920, y + 40)], fill=(18, 32, 20), width=28)
    glow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    g = ImageDraw.Draw(glow)
    g.ellipse([1200, 120, 1780, 520], fill=(212, 175, 55, 35))
    img = Image.alpha_composite(img.convert("RGBA"), glow).convert("RGB")
    return _vignette(img.filter(ImageFilter.GaussianBlur(0.5)))


def journey_map() -> Image.Image:
    img = _gradient((1600, 900), (22, 18, 12), (12, 18, 12))
    draw = ImageDraw.Draw(img)
    points = [(80, 720), (320, 580), (520, 640), (780, 420), (980, 480), (1240, 280), (1480, 180)]
    draw.line(points, fill=(212, 175, 55), width=6)
    for x, y in points:
        draw.ellipse([x - 10, y - 10, x + 10, y + 10], fill=(240, 216, 120))
    return _vignette(img)


def focus_quest() -> Image.Image:
    img = _gradient((1200, 1200), (10, 14, 10), (20, 28, 18))
    draw = ImageDraw.Draw(img)
    cx, cy, r = 600, 560, 280
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(212, 175, 55), width=14)
    draw.ellipse([cx - r + 40, cy - r + 40, cx + r - 40, cy + r - 40], outline=(240, 216, 120, 180), width=4)
    glow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    g = ImageDraw.Draw(glow)
    g.ellipse([cx - 120, cy - 120, cx + 120, cy + 120], fill=(212, 175, 55, 45))
    img = Image.alpha_composite(img.convert("RGBA"), glow).convert("RGB")
    return _vignette(img)


def fellowship_icon() -> Image.Image:
    img = _gradient((512, 512), (18, 24, 16), (6, 8, 6))
    draw = ImageDraw.Draw(img)
    for i in range(9):
        x = 180 + i * 18
        draw.line([(x, 380), (x + 8, 280)], fill=(180, 150, 60), width=6)
    draw.polygon([(256, 120), (380, 360), (132, 360)], fill=(40, 55, 38))
    return img


def main() -> None:
    out = Path(__file__).resolve().parents[1] / "assets"
    out.mkdir(parents=True, exist_ok=True)
    assets = {
        "hero.jpg": hero_banner(),
        "journey-map.jpg": journey_map(),
        "focus-quest.jpg": focus_quest(),
    }
    if not (out / "app-icon.png").exists() and not (out / "shield-logo.png").exists():
        assets["fellowship.jpg"] = fellowship_icon()
    for name, img in assets.items():
        path = out / name
        if path.exists() and path.stat().st_size > 200_000:
            print(f"Skip {path.name} — keeping generated asset ({path.stat().st_size // 1024} KB)")
            continue
        if name == "fellowship.jpg" and (out / "app-icon.png").exists():
            print("Skip fellowship.jpg — app-icon.png is the brand icon")
            continue
        img.save(path, "JPEG", quality=92)
        print(f"Wrote {path} ({path.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
