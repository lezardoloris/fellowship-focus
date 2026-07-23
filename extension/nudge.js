/* Soft productivity nudge — discreet in-page toast during an active shield.
   Injected on http(s) pages (not Fellowship web). Shadow DOM so host CSS can't
   restyle it. Actions: Block site · Snooze 5m · Dismiss. */

(function () {
  const HOST = (location.hostname || "").replace(/^www\./, "").toLowerCase();
  if (!HOST || HOST.includes("fellowship-focus")) return;

  const ROOT_ID = "ff-focus-nudge-host";
  /** @type {{ domain: string, kind: string, category: string } | null} */
  let current = null;
  /** @type {HTMLElement | null} */
  let hostEl = null;

  function sendAction(action) {
    const payload = current;
    hide();
    if (!payload) return;
    try {
      chrome.runtime.sendMessage({
        type: "focusNudgeAction",
        action,
        domain: payload.domain,
        kind: payload.kind || "site",
        category: payload.category || "distract",
      });
    } catch {
      /* extension context invalidated */
    }
  }

  function hide() {
    current = null;
    if (hostEl) {
      hostEl.remove();
      hostEl = null;
    }
  }

  function show(msg) {
    const domain = String(msg.domain || "").trim();
    if (!domain) return;
    hide();
    current = {
      domain,
      kind: msg.kind || "site",
      category: msg.category || "distract",
    };

    hostEl = document.createElement("div");
    hostEl.id = ROOT_ID;
    hostEl.setAttribute("data-ff-nudge", "1");
    Object.assign(hostEl.style, {
      all: "initial",
      position: "fixed",
      right: "16px",
      bottom: "20px",
      zIndex: "2147483646",
      pointerEvents: "none",
    });
    const shadow = hostEl.attachShadow({ mode: "closed" });

    const blockLabel = current.kind === "search" ? "Close tab" : "Block site";
    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        .card {
          pointer-events: auto;
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 280px;
          max-width: 340px;
          padding: 10px 12px 10px 14px;
          background: #16181a;
          border: 1px solid #34383c;
          border-radius: 12px;
          box-shadow: 0 12px 40px rgba(0,0,0,0.45);
          font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
          color: #f4f4f5;
          animation: ff-in 180ms ease-out;
        }
        @keyframes ff-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .card { animation: none; }
        }
        .text { flex: 1; min-width: 0; }
        .title {
          font-size: 13px;
          font-weight: 600;
          letter-spacing: -0.01em;
          line-height: 1.3;
        }
        .sub {
          margin-top: 2px;
          font-size: 10px;
          color: rgba(244,244,245,0.55);
          line-height: 1.35;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
        button {
          border: none;
          cursor: pointer;
          font-family: inherit;
          border-radius: 8px;
        }
        .block {
          padding: 7px 10px;
          font-size: 11px;
          font-weight: 600;
          background: rgba(45,106,79,0.28);
          color: #4ade80;
        }
        .block:hover { background: rgba(45,106,79,0.42); }
        .snooze {
          padding: 7px 10px;
          font-size: 11px;
          font-weight: 600;
          background: rgba(244,244,245,0.06);
          color: rgba(244,244,245,0.72);
        }
        .snooze:hover { background: rgba(244,244,245,0.12); }
        .x {
          width: 28px;
          height: 28px;
          padding: 0;
          font-size: 14px;
          font-weight: 700;
          line-height: 1;
          background: rgba(155,34,38,0.16);
          color: #f87171;
        }
        .x:hover { background: rgba(155,34,38,0.32); }
      </style>
      <div class="card" role="status" aria-live="polite">
        <div class="text">
          <div class="title">Back to work?</div>
          <div class="sub">This won't help the quest. · ${escapeHtml(domain)}</div>
        </div>
        <div class="actions">
          <button type="button" class="block" data-act="block" title="${escapeAttr(blockLabel)}">${escapeHtml(blockLabel)}</button>
          <button type="button" class="snooze" data-act="snooze" title="Snooze 5 minutes">Snooze 5m</button>
          <button type="button" class="x" data-act="dismiss" title="Keep browsing" aria-label="Dismiss">✕</button>
        </div>
      </div>
    `;

    shadow.querySelectorAll("[data-act]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const act = btn.getAttribute("data-act");
        if (act === "block" || act === "snooze" || act === "dismiss") sendAction(act);
      });
    });

    (document.documentElement || document.body).appendChild(hostEl);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(s) {
    return escapeHtml(s).replace(/'/g, "&#39;");
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || typeof msg !== "object") return;
    if (msg.type === "FF_FOCUS_NUDGE") {
      show(msg);
      sendResponse({ ok: true });
      return true;
    }
    if (msg.type === "FF_FOCUS_NUDGE_HIDE") {
      hide();
      sendResponse({ ok: true });
      return true;
    }
  });
})();
