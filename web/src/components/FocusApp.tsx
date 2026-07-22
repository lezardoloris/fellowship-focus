"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BlockTab } from "@/components/BlockTab";
import { FocusTab } from "@/components/FocusTab";
import { FellowshipDashboard } from "@/components/FellowshipDashboard";

type Tab = "block" | "focus" | "guild";

const TABS: Array<{ id: Tab; label: string; hint: string }> = [
  { id: "block", label: "Block", hint: "Your shield" },
  { id: "focus", label: "Focus", hint: "Calendar, OKR & your ladder" },
  { id: "guild", label: "Guild", hint: "Goals & accountability" },
];

const LAST_CODE_KEY = "ff-app-code";

export function FocusApp() {
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>("block");
  const [code, setCode] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [shared, setShared] = useState(false);

  // Resolve identity: desktop passes ?code=&token=&name=; otherwise last used.
  useEffect(() => {
    const urlCode = (params.get("code") || "").trim().toLowerCase();
    const urlToken = (params.get("token") || "").trim();
    const urlName = (params.get("name") || "").trim();
    const stored = (localStorage.getItem(LAST_CODE_KEY) || "").trim().toLowerCase();
    const resolved = urlCode || stored || null;
    if (resolved) {
      setCode(resolved);
      localStorage.setItem(LAST_CODE_KEY, resolved);
      if (urlToken) {
        localStorage.setItem(
          `ff-member-${resolved}`,
          JSON.stringify({ token: urlToken, name: urlName })
        );
      }
    }
    setReady(true);
  }, [params]);

  // Load member identity for the active code (solo mode if none).
  useEffect(() => {
    if (!code) {
      setToken(null);
      setName(null);
      return;
    }
    const raw = localStorage.getItem(`ff-member-${code}`);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { token: string; name: string };
        setToken(parsed.token);
        setName(parsed.name);
        return;
      } catch {
        /* ignore */
      }
    }
    setToken(null);
    setName(null);
  }, [code]);

  const onJoined = useCallback((c: string, t: string, n: string) => {
    const clean = c.trim().toLowerCase();
    localStorage.setItem(LAST_CODE_KEY, clean);
    localStorage.setItem(`ff-member-${clean}`, JSON.stringify({ token: t, name: n }));
    setCode(clean);
    setToken(t);
    setName(n);
  }, []);

  const leaveGuild = useCallback(() => {
    localStorage.removeItem(LAST_CODE_KEY);
    setCode(null);
    setToken(null);
    setName(null);
  }, []);

  function share() {
    if (!code) return;
    navigator.clipboard.writeText(`${window.location.origin}/app?code=${code}`);
    setShared(true);
    setTimeout(() => setShared(false), 2000);
  }

  if (!ready) return null;

  const joined = Boolean(code && token);

  return (
    <Shell>
      <header className="header-glass sticky top-0 z-20">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3 md:px-8">
          <div className="mr-auto">
            <p className="font-display text-sm font-bold tracking-[0.2em] text-white">
              FELLOWSHIP FOCUS
            </p>
            <p className="text-xs text-white/55">
              {joined ? (
                <>
                  {name ? `${name} · ` : ""}
                  <button onClick={leaveGuild} className="underline hover:text-white" title="Leave guild">
                    {code}
                  </button>
                </>
              ) : (
                "Solo mode · no guild"
              )}
            </p>
          </div>
          <nav className="flex items-center gap-1 rounded-full border border-white/10 bg-black/20 p-1 backdrop-blur-md">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                title={t.hint}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  tab === t.id
                    ? "bg-[#b8422e] text-white shadow-lg shadow-[#b8422e]/25"
                    : "text-white/65 hover:text-white"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
          {joined && (
            <button onClick={share} className="btn-secondary border-white/15 bg-black/20 text-white">
              {shared ? "✓ Copied" : "Share"}
            </button>
          )}
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
        {tab === "block" && <BlockTab code={code} token={token} name={name} />}
        {tab === "focus" && <FocusTab />}
        {tab === "guild" &&
          (joined ? (
            <FellowshipDashboard code={code!} />
          ) : (
            <GuildGate initialCode={code} onJoined={onJoined} />
          ))}
      </div>
    </Shell>
  );
}

// ── Guild tab, when no guild is active ──────────────────────
function GuildGate({
  initialCode,
  onJoined,
}: {
  initialCode: string | null;
  onJoined: (code: string, token: string, name: string) => void;
}) {
  const [code, setCode] = useState<string | null>(initialCode);
  const [codeInput, setCodeInput] = useState("");
  const [joinName, setJoinName] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (!code || !joinName.trim()) return;
    setJoining(true);
    setError("");
    try {
      const res = await fetch(`/api/fellowship/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: joinName.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to join");
      onJoined(code, json.member.token, json.member.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join");
    } finally {
      setJoining(false);
    }
  }

  if (!code) {
    return (
      <div className="mx-auto max-w-md">
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold">Join a guild</h2>
          <p className="mt-1 mb-4 text-sm text-[#9ca3af]">
            Guilds add shared goals and accountability. Everything else works without one —
            you&apos;re already free to block sites and focus.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const clean = codeInput.trim().toLowerCase();
              if (clean) setCode(clean);
            }}
            className="flex gap-2"
          >
            <input
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder="fellowship-abc12345"
              className="input-premium flex-1"
            />
            <button type="submit" className="btn-primary whitespace-nowrap">
              Continue
            </button>
          </form>
          <p className="mt-4 text-xs text-[#9ca3af]">
            No guild yet? Create one in the desktop app, then paste its code here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold">Join {code}</h2>
        <p className="mt-1 mb-4 text-sm text-[#9ca3af]">Pick your name to enter this fellowship.</p>
        <form onSubmit={join} className="flex gap-2">
          <input
            value={joinName}
            onChange={(e) => setJoinName(e.target.value)}
            placeholder="Your name"
            className="input-premium flex-1"
          />
          <button type="submit" disabled={joining} className="btn-primary">
            {joining ? "…" : "Join"}
          </button>
        </form>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        <button onClick={() => setCode(null)} className="mt-4 text-xs text-[#9ca3af] underline">
          Use a different code
        </button>
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative min-h-screen overflow-hidden text-white">
      {/* Full-bleed cinematic scene — the product, not a black box */}
      <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden>
        <div
          className="focus-kenburns absolute inset-[-6%] bg-cover bg-center"
          style={{ backgroundImage: "url('/fellowship-hero.png')" }}
        />
        <div className="app-scrim absolute inset-0" />
      </div>
      {children}
    </main>
  );
}
