"""Premium 'You cannot pass' block page HTML."""

import base64
from pathlib import Path

_IMAGE_B64: str | None = None


def _get_image_b64() -> str:
    global _IMAGE_B64
    if _IMAGE_B64:
        return _IMAGE_B64
    candidates = [
        Path(__file__).resolve().parents[2] / "assets" / "cannot-pass.jpg",
        Path(__file__).resolve().parent / "cannot-pass.jpg",
    ]
    for path in candidates:
        if path.exists():
            _IMAGE_B64 = base64.b64encode(path.read_bytes()).decode("ascii")
            return _IMAGE_B64
    return ""


def build_block_html(
    site: str,
    penalty: int,
    member_name: str = "",
    weekly_net: int = 0,
    rank: int = 0,
    total_members: int = 0,
    fellowship_tax: int = 3,
) -> str:
    img_b64 = _get_image_b64()
    img_tag = (
        f'<img src="data:image/jpeg;base64,{img_b64}" alt="" class="hero" />'
        if img_b64
        else '<div class="hero-placeholder"></div>'
    )
    rank_line = ""
    if rank > 0 and total_members > 0:
        rank_line = f'<p class="rank">Weekly ladder: <strong>#{rank}</strong> of {total_members} · {weekly_net} net XP</p>'

    return f"""<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>You cannot pass — Fellowship Focus</title>
<style>
*{{box-sizing:border-box;margin:0;padding:0}}
body{{
  min-height:100vh;background:#060806;color:#f0ebe0;
  font-family:Georgia,'Times New Roman',serif;
  display:flex;align-items:center;justify-content:center;padding:1.5rem;
}}
.card{{
  max-width:720px;width:100%;
  background:linear-gradient(160deg,rgba(20,28,20,0.95),rgba(6,8,6,0.98));
  border:1px solid rgba(212,175,55,0.25);border-radius:20px;
  overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,0.6);
}}
.hero{{width:100%;height:220px;object-fit:cover;display:block;
  filter:brightness(0.7) saturate(1.1)}}
.hero-placeholder{{height:220px;background:linear-gradient(135deg,#1a2418,#3d1f1f)}}
.content{{padding:2rem 2.5rem 2.5rem;text-align:center}}
h1{{
  font-size:2.5rem;font-weight:700;margin-bottom:0.75rem;
  background:linear-gradient(135deg,#f0d878,#d4af37,#8a7020);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;
  letter-spacing:0.02em;
}}
.sub{{color:#a8a090;font-size:1.05rem;line-height:1.7;max-width:480px;margin:0 auto 1.5rem}}
.penalty{{
  display:inline-block;padding:0.6rem 1.5rem;border-radius:999px;
  background:rgba(155,34,38,0.25);border:1px solid rgba(200,80,80,0.4);
  color:#e8a0a0;font-size:1.25rem;font-weight:bold;margin-bottom:0.75rem;
}}
.site{{color:#d4af37;font-size:0.9rem;margin-bottom:1rem;word-break:break-all}}
.rank{{color:#888;font-size:0.85rem;margin-top:1rem}}
.fellowship{{
  margin-top:1.25rem;padding-top:1.25rem;border-top:1px solid rgba(255,255,255,0.06);
  font-size:0.8rem;color:#666;
}}
.fellowship strong{{color:#c45c26}}
.btn{{
  display:inline-block;margin-top:1.5rem;padding:0.75rem 2rem;
  background:linear-gradient(135deg,#d4af37,#8a7020);color:#0a0a08;
  text-decoration:none;border-radius:8px;font-weight:bold;font-size:0.85rem;
  letter-spacing:0.05em;text-transform:uppercase;
}}
</style></head><body>
<div class="card">
  {img_tag}
  <div class="content">
    <h1>You cannot pass.</h1>
    <p class="sub">This site is blocked during your focus quest.<br/>The Fellowship is counting on you.</p>
    <div class="penalty">−{penalty} XP</div>
    <p class="site">{site}</p>
    {rank_line}
    <p class="fellowship">
      {f"<strong>{member_name}</strong>'s distraction costs the Fellowship <strong>−{fellowship_tax} XP</strong> on the shared journey." if member_name else f"The Fellowship loses <strong>−{fellowship_tax} XP</strong> on the shared journey."}
    </p>
    <a class="btn" href="javascript:history.back()">← Return to your quest</a>
  </div>
</div>
</body></html>"""
