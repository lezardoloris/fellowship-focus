"""Premium 'You cannot pass' block page — PorNo-style positive redirects."""

import base64
import html as html_mod
from pathlib import Path

_LOGO_B64: str | None = None
_IMAGE_B64: str | None = None


def _get_image_b64(name: str) -> str:
    candidates = [
        Path(__file__).resolve().parents[2] / "assets" / name,
        Path(__file__).resolve().parent / name,
    ]
    for path in candidates:
        if path.exists():
            return base64.b64encode(path.read_bytes()).decode("ascii")
    return ""


def _get_block_image_b64() -> str:
    global _IMAGE_B64
    if _IMAGE_B64:
        return _IMAGE_B64
    _IMAGE_B64 = _get_image_b64("cannot-pass.jpg")
    return _IMAGE_B64


def _get_logo_b64() -> str:
    global _LOGO_B64
    if _LOGO_B64:
        return _LOGO_B64
    for name in ("shield-logo.png", "app-icon.png", "fellowship.ico"):
        data = _get_image_b64(name)
        if data:
            _LOGO_B64 = data
            return _LOGO_B64
    return ""


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
    img_b64 = _get_block_image_b64()
    logo_b64 = _get_logo_b64()
    logo_tag = (
        f'<img src="data:image/png;base64,{logo_b64}" alt="" class="logo" />'
        if logo_b64
        else '<div class="logo-fallback">🛡</div>'
    )
    img_tag = (
        f'<img src="data:image/jpeg;base64,{img_b64}" alt="" class="hero" />'
        if img_b64
        else '<div class="hero-placeholder"></div>'
    )
    rank_line = ""
    if rank > 0 and total_members > 0:
        rank_line = (
            f'<p class="rank">Weekly ladder: <strong>#{rank}</strong> of {total_members} · {weekly_net} net XP</p>'
        )

    reason_line = ""
    if reason.startswith("path:"):
        reason_line = (
            f'<p class="reason">Short-form blocked · path <code>{html_mod.escape(reason[5:])}</code> '
            f"(tutorials / DMs still allowed)</p>"
        )

    alt_html = ""
    if alternatives:
        links = []
        for alt in alternatives[:4]:
            if isinstance(alt, dict):
                label = html_mod.escape(str(alt.get("label", "Go")))
                url = html_mod.escape(str(alt.get("url", "#")))
            else:
                label = "Redirect"
                url = html_mod.escape(str(alt))
            links.append(f'<a class="alt" href="{url}" rel="noopener">{label} →</a>')
        alt_html = (
            '<div class="alts"><p class="alts-title">Go somewhere better</p>'
            + "".join(links)
            + "</div>"
        )

    site_safe = html_mod.escape(site)
    name_safe = html_mod.escape(member_name) if member_name else ""

    if dashboard_url:
        cta_html = (
            f'<a class="btn" href="{html_mod.escape(dashboard_url)}" rel="noopener">See your guild ladder →</a>'
            '<p class="back-hint"><a class="back" href="javascript:history.back()">← Go back</a></p>'
        )
    else:
        cta_html = '<a class="btn" href="javascript:history.back()">← Return to your quest</a>'

    return f"""<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>You cannot pass — Fellowship Focus</title>
<style>
*{{box-sizing:border-box;margin:0;padding:0}}
body{{
  min-height:100vh;background:#1a1c1e;color:#f4f4f5;
  font-family:system-ui,-apple-system,'Segoe UI',sans-serif;
  display:flex;align-items:center;justify-content:center;padding:1.5rem;
}}
.card{{
  max-width:720px;width:100%;
  background:#242628;
  border:1px solid #3a3d40;border-radius:10px;
  overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.4);
}}
.hero{{width:100%;height:220px;object-fit:cover;display:block;
  filter:brightness(0.85)}}
.hero-placeholder{{height:220px;background:#2e3134}}
.brand{{display:flex;align-items:center;justify-content:center;gap:.75rem;padding:1rem 1.5rem;
  border-bottom:1px solid #3a3d40;background:#2e3134}}
.logo{{width:36px;height:36px;border-radius:8px;object-fit:cover}}
.logo-fallback{{font-size:1.25rem}}
.brand-title{{font-size:.75rem;letter-spacing:.18em;text-transform:uppercase;color:#9ca3af}}
.brand-title strong{{color:#b8422e;font-weight:600}}
.content{{padding:2rem 2.5rem 2.5rem;text-align:center}}
h1{{
  font-size:2rem;font-weight:600;margin-bottom:0.75rem;
  color:#f4f4f5;
  letter-spacing:0.02em;
}}
.sub{{color:#9ca3af;font-size:1.05rem;line-height:1.7;max-width:480px;margin:0 auto 1.5rem}}
.penalty{{
  display:inline-block;padding:0.6rem 1.5rem;border-radius:999px;
  background:rgba(155,34,38,0.25);border:1px solid rgba(200,80,80,0.4);
  color:#e8a0a0;font-size:1.25rem;font-weight:bold;margin-bottom:0.75rem;
}}
.site{{color:#9ca3af;font-size:0.9rem;margin-bottom:0.5rem;word-break:break-all}}
.reason{{color:#9ca3af;font-size:0.8rem;margin-bottom:1rem}}
.reason code{{color:#b8422e}}
.rank{{color:#9ca3af;font-size:0.85rem;margin-top:1rem}}
.fellowship{{
  margin-top:1.25rem;padding-top:1.25rem;border-top:1px solid #3a3d40;
  font-size:0.8rem;color:#9ca3af;
}}
.fellowship strong{{color:#b8422e}}
.btn{{
  display:inline-block;margin-top:1.5rem;padding:0.75rem 2rem;
  background:#b8422e;color:#ffffff;
  text-decoration:none;border-radius:6px;font-weight:600;font-size:0.85rem;
}}
.alts{{margin-top:1.75rem;padding-top:1.25rem;border-top:1px solid #3a3d40}}
.alts-title{{font-size:0.75rem;letter-spacing:0.12em;text-transform:uppercase;color:#9ca3af;margin-bottom:0.75rem}}
.alt{{
  display:inline-block;margin:0.35rem;padding:0.55rem 1rem;
  border:1px solid #3a3d40;border-radius:999px;
  color:#f4f4f5;text-decoration:none;font-size:0.8rem;font-family:system-ui,sans-serif;
}}
.alt:hover{{background:#2e3134}}
.back-hint{{margin-top:0.75rem}}
.back{{color:#9ca3af;text-decoration:none;font-size:0.8rem}}
.back:hover{{color:#f4f4f5}}
</style></head><body>
<div class="card">
  <div class="brand">{logo_tag}<div class="brand-title"><strong>Fellowship Shield</strong> · focus blocker</div></div>
  {img_tag}
  <div class="content">
    <h1>You cannot pass.</h1>
    <p class="sub">This is blocked during your focus quest.<br/>The Fellowship is counting on you.</p>
    <div class="penalty">−{penalty} XP</div>
    <p class="site">{site_safe}</p>
    {reason_line}
    {rank_line}
    <p class="fellowship">
      {f"<strong>{name_safe}</strong>'s distraction costs the Fellowship <strong>−{fellowship_tax} XP</strong> on the shared journey." if name_safe else f"The Fellowship loses <strong>−{fellowship_tax} XP</strong> on the shared journey."}
    </p>
    {alt_html}
    {cta_html}
  </div>
</div>
</body></html>"""
