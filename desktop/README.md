# Fellowship Focus Desktop

Koncentro-style **system-wide website blocker** (mitmproxy certificate + system proxy) — **no Chrome extension**.

## How it works (same as Koncentro)

1. **mitmdump** intercepts HTTP/HTTPS traffic
2. **mitmproxy CA certificate** installed in Windows (the "contract" Koncentro asks for)
3. **uniproxy** sets Windows system proxy during focus sessions
4. Blocked sites show "You cannot pass." in **any browser**

## Setup

```bash
cd desktop
pip install -r requirements.txt
python main.py
```

### First run

1. Open **Certificate** tab
2. **Generate certificate** (if not already from Koncentro)
3. **Install certificate** → same as Koncentro setup
4. **Settings** tab → paste API URL, token, Fellowship code from web dashboard
5. **Begin Quest** → blocking active system-wide

## mitmdump source

Uses Koncentro's bundled `mitmdump.exe` if installed, otherwise `pip install mitmproxy`.

Your Koncentro certificate (`~/.mitmproxy/`) works here too — no need to reinstall.

## System tray

Closing the window minimizes to the **system tray** (bottom-right, near the clock).

- **Floating timer** stays always-on-top over other windows while a session runs
- **Left-click** tray icon → open / hide the app
- **Right-click** tray → Open, Hide, End focus session, Show floating timer, Quit
- **Right-click / double-click** the floating timer → open app or end session
- During an active focus session, closing the window keeps the shield + timer alive


## Sync

Sessions and blocked-site attempts sync to the Fellowship web API (same as before, but without Chrome).
