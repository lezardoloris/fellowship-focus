"""Download Cinzel + DM Sans into desktop/assets/fonts/. Run once: python scripts/download_fonts.py"""

import urllib.request
from pathlib import Path

FONTS = {
    "Cinzel-Regular.ttf": "https://github.com/nickshanks/Cinzel/raw/master/fonts/ttf/Cinzel-Regular.ttf",
    "Cinzel-Bold.ttf": "https://github.com/nickshanks/Cinzel/raw/master/fonts/ttf/Cinzel-Bold.ttf",
    "DMSans-Regular.ttf": "https://github.com/googlefonts/dm-fonts/raw/main/Sans%20(TTF%20Opsz%2CWght)/DMSans-Regular.ttf",
    "DMSans-Medium.ttf": "https://github.com/googlefonts/dm-fonts/raw/main/Sans%20(TTF%20Opsz%2CWght)/DMSans-Medium.ttf",
    "DMSans-Bold.ttf": "https://github.com/googlefonts/dm-fonts/raw/main/Sans%20(TTF%20Opsz%2CWght)/DMSans-Bold.ttf",
}

def main() -> None:
    out = Path(__file__).resolve().parents[1] / "assets" / "fonts"
    out.mkdir(parents=True, exist_ok=True)
    for name, url in FONTS.items():
        dest = out / name
        print(f"Downloading {name}...")
        try:
            urllib.request.urlretrieve(url, dest)
            print(f"  OK ({dest.stat().st_size} bytes)")
        except Exception as e:
            print(f"  FAILED: {e}")

if __name__ == "__main__":
    main()
