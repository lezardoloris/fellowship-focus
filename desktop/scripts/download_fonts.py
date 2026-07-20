"""Download Cinzel + DM Sans into desktop/assets/fonts/. Run: python scripts/download_fonts.py"""

import urllib.request
from pathlib import Path

FONTS = {
    "Cinzel-Regular.ttf": "https://raw.githubusercontent.com/NDISCOVER/Cinzel/master/fonts/ttf/Cinzel-Regular.ttf",
    "Cinzel-Bold.ttf": "https://raw.githubusercontent.com/NDISCOVER/Cinzel/master/fonts/ttf/Cinzel-Bold.ttf",
    "DMSans-Variable.ttf": "https://raw.githubusercontent.com/google/fonts/main/ofl/dmsans/DMSans%5Bopsz%2Cwght%5D.ttf",
}


def main() -> None:
    out = Path(__file__).resolve().parents[1] / "assets" / "fonts"
    out.mkdir(parents=True, exist_ok=True)
    for name, url in FONTS.items():
        dest = out / name
        if dest.exists() and dest.stat().st_size > 1000:
            print(f"Skip {name} (exists)")
            continue
        print(f"Downloading {name}...")
        try:
            urllib.request.urlretrieve(url, dest)
            print(f"  OK ({dest.stat().st_size} bytes)")
        except Exception as e:
            print(f"  FAILED: {e}")


if __name__ == "__main__":
    main()
