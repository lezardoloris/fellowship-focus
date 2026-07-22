"""Full-bleed block page — the image carries the interruption, the quote lands it.

Served by the local mitmproxy, so everything is self-contained (base64 image,
no external requests). Mirrors the extension's block page design.
"""

import base64
import html as html_mod
import random
from pathlib import Path

_IMAGE_B64: str | None = None

# Same rule as the extension personas: real people get real, attributable
# quotes only; fictional characters and archetypes speak freely.
_PERSONAS = [
    ("Gandalf", "the Grey", [
        "You cannot pass. Not while there is work yet undone.",
        "All we have to decide is what to do with the time that is given us. Not this. Not now.",
        "Even the smallest person can change the course of the future. Begin with the next hour.",
    ]),
    ("Aragorn", "son of Arathorn", [
        "A day may come when you scroll. But it is not this day.",
        "Hold your ground. The task is still there when the noise passes.",
    ]),
    ("The Sergeant", "no excuses", [
        "You did not open that tab by accident. You opened it to avoid something. Go do that thing.",
        "Discipline is choosing what you want most over what you want now. Choose again.",
        "Nobody is coming to make you focus. That is the whole job.",
    ]),
    ("Marcus Aurelius", "Meditations", [
        "You have power over your mind — not outside events. Realize this, and you will find strength.",
        "Confine yourself to the present.",
        "The impediment to action advances action. What stands in the way becomes the way.",
    ]),
    ("Albert Einstein", "physicist", [
        "It's not that I'm so smart, it's just that I stay with problems longer.",
        "Life is like riding a bicycle. To keep your balance you must keep moving.",
    ]),
    ("Elon Musk", "engineer", [
        "Persistence is very important. You should not give up unless you are forced to give up.",
        "Work like hell. If other people are putting in 40-hour work weeks and you're putting in 100-hour work weeks, you will achieve in four months what it takes them a year.",
    ]),
]


def _get_block_image_b64() -> str:
    global _IMAGE_B64
    if _IMAGE_B64 is not None:
        return _IMAGE_B64
    candidates = [
        Path(__file__).resolve().parents[2] / "assets" / "cannot-pass.jpg",
        Path(__file__).resolve().parent / "cannot-pass.jpg",
    ]
    for path in candidates:
        if path.exists():
            _IMAGE_B64 = base64.b64encode(path.read_bytes()).decode("ascii")
            return _IMAGE_B64
    _IMAGE_B64 = ""
    return _IMAGE_B64


def build_block_html(
    site: str,
    penalty: int,
    member_name: str = "",
    weekly_net: int = 0,
    rank: int = 0,
    total_members: int = 0,
    fellowship_tax: int = 3,
    alternatives: list | None = None,
    reason: str = "domain",
    dashboard_url: str = "",
) -> str:
    name, title, lines = random.choice(_PERSONAS)
    quote = random.choice(lines)

    img_b64 = _get_block_image_b64()
    scene_css = (
        f"background-image:url('data:image/jpeg;base64,{img_b64}');"
        if img_b64
        else "background:radial-gradient(1200px 600px at 50% -10%,rgba(184,66,46,.25),transparent 60%),#0d0e10;"
    )

    site_safe = html_mod.escape(site)

    meta_bits = [f'<span class="site">{site_safe}</span>']
    if penalty:
        meta_bits.append(f"<span>−{int(penalty)} XP</span>")
    if reason.startswith("path:"):
        meta_bits.append("<span>feed blocked · rest of the site still works</span>")
    if rank > 0 and total_members > 0:
        meta_bits.append(f"<span>ladder #{int(rank)}/{int(total_members)}</span>")
    meta = '<span class="dot">·</span>'.join(meta_bits)

    dash = (
        f'<a class="link" href="{html_mod.escape(dashboard_url)}" rel="noopener">Dashboard</a>'
        if dashboard_url
        else ""
    )

    return f"""<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Blocked — Fellowship Focus</title>
<style>
*{{box-sizing:border-box;margin:0;padding:0}}
html,body{{height:100%}}
body{{background:#0d0e10;color:#f4f4f5;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;overflow:hidden}}
.stage{{position:relative;height:100vh;display:flex;flex-direction:column;justify-content:flex-end}}
.scene{{position:absolute;inset:0;background-size:cover;background-position:center;{scene_css}
  transform:scale(1.04);animation:drift 40s ease-in-out infinite alternate}}
@keyframes drift{{from{{transform:scale(1.04)}}to{{transform:scale(1.12) translate3d(0,-1.5%,0)}}}}
@media (prefers-reduced-motion:reduce){{.scene{{animation:none}}}}
.veil{{position:absolute;inset:0;background:linear-gradient(to top,
  rgba(8,9,10,.94) 0%,rgba(8,9,10,.55) 38%,rgba(8,9,10,.12) 70%,rgba(8,9,10,.3) 100%)}}
.content{{position:relative;padding:0 8vw 40px;max-width:1100px}}
blockquote{{font-size:clamp(22px,3.4vw,44px);font-weight:300;line-height:1.28;
  letter-spacing:-.01em;text-wrap:balance;text-shadow:0 2px 24px rgba(0,0,0,.6)}}
figcaption{{margin-top:18px;display:flex;align-items:baseline;gap:10px;
  font-size:13px;letter-spacing:.14em;text-transform:uppercase}}
.who{{font-weight:600}}
.role{{color:rgba(244,244,245,.62);letter-spacing:.1em}}
.btn{{margin-top:30px;font-size:14px;font-weight:600;padding:12px 26px;border-radius:999px;
  cursor:pointer;border:1px solid rgba(255,255,255,.28);background:rgba(255,255,255,.06);
  color:#f4f4f5;transition:background .18s ease,border-color .18s ease}}
.btn:hover{{background:#b8422e;border-color:#b8422e}}
.meta{{position:relative;display:flex;align-items:center;gap:10px;flex-wrap:wrap;
  padding:0 8vw 26px;font-size:12px;color:rgba(244,244,245,.62)}}
.site{{font-family:ui-monospace,monospace}}
.dot{{opacity:.5;margin:0 2px}}
.link{{color:rgba(244,244,245,.62);text-decoration:none;margin-left:auto}}
.link:hover{{color:#f4f4f5}}
</style></head><body>
<div class="stage">
  <div class="scene"></div>
  <div class="veil"></div>
  <main class="content">
    <figure>
      <blockquote>{html_mod.escape(quote)}</blockquote>
      <figcaption><span class="who">{html_mod.escape(name)}</span>
        <span class="role">{html_mod.escape(title)}</span></figcaption>
    </figure>
    <button class="btn" onclick="history.length>1?history.back():location.href='about:blank'">Back to focus</button>
  </main>
  <footer class="meta">{meta}{dash}</footer>
</div>
</body></html>"""
