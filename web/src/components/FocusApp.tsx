"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BlockTab } from "@/components/BlockTab";
import { FocusTab } from "@/components/FocusTab";
import { FellowshipDashboard } from "@/components/FellowshipDashboard";

type Tab = "block" | "focus" | "guild";

const TABS: Array<{ id: Tab; label: string; hint: string }> = [
  { id: "block", label: "Block", hint: "Your shield" },
  { id: "focus", label: "Focus", hint: "Ladder, calendar & tracking — no guild needed" },
  { id: "guild", label: "Guild", hint: "Optional social layer" },
];

const LAST_CODE_KEY = "ff-app-code";

export function FocusApp() {
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>("focus");
  const [code, setCode] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [shared, setShared] = useState(false);

  // Resolve identity only when we have a real member (token). A leftover code
  // without a token must NOT force the Guild join screen.
  useEffect(() => {
    const urlCode = (params.get("code") || "").trim().toLowerCase();
    const urlToken = (params.get("token") || "").trim();
    const urlName = (params.get("name") || "").trim();
    const stored = (localStorage.getItem(LAST_CODE_KEY) || "").trim().toLowerCase();

    if (urlCode && urlToken) {
      localStorage.setItem(LAST_CODE_KEY, urlCode);
      localStorage.setItem(`ff-member-${urlCode}`, JSON.stringify({ token: urlToken, name: urlName }));
      setCode(urlCode);
      setToken(urlToken);
      setName(urlName || null);
      setReady(true);
      return;
    }

    const candidate = urlCode || stored;
    if (candidate) {
      const raw = localStorage.getItem(`ff-member-${candidate}`);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as { token: string; name: string };
          if (parsed.token) {
            setCode(candidate);
            setToken(parsed.token);
            setName(parsed.name || null);
            setReady(true);
            return;
          }
        } catch {
          /* ignore */
        }
      }
      // Stale invite code without membership — clear so Guild stays optional
      if (!urlToken) localStorage.removeItem(LAST_CODE_KEY);
    }
    setCode(null);
    setToken(null);
    setName(null);
    setReady(true);
  }, [params]);

  const onJoined = useCallback((c: string, t: string, n: string) => {
    const clean = c.trim().toLowerCase();
    localStorage.setItem(LAST_CODE_KEY, clean);
    localStorage.setItem(`ff-member-${clean}`, JSON.stringify({ token: t, name: n }));
    setCode(clean);
    setToken(t);
    setName(n);
  }, []);

  const leaveGuild = useCallback(() => {
    if (code) localStorage.removeItem(`ff-member-${code}`);
    localStorage.removeItem(LAST_CODE_KEY);
    setCode(null);
    setToken(null);
    setName(null);
  }, [code]);

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
                "Solo · ladder & tracking need no guild"
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
            <GuildGate onJoined={onJoined} onGoFocus={() => setTab("focus")} />
          ))}
      </div>
    </Shell>
  );
}

// ── Guild is optional social — never a gate to productivity ─
function GuildGate({
  onJoined,
  onGoFocus,
}: {
  onJoined: (code: string, token: string, name: string) => void;
  onGoFocus: () => void;
}) {
  const [step, setStep] = useState<"home" | "code" | "name">("home");
  const [code, setCode] = useState("");
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

  if (step === "home") {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <div className="glass-panel p-6">
          <h2 className="font-display text-xl font-semibold text-white">Guild is optional</h2>
          <p className="mt-2 text-sm text-white/65">
            Your ladder, focus calendar, OKRs and tracking live in the{" "}
            <button type="button" onClick={onGoFocus} className="text-white underline">
              Focus
            </button>{" "}
            tab — no invite code required. A guild is only if you want friends on the same quest.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" onClick={onGoFocus} className="btn-primary">
              Open Focus (ladder & calendar)
            </button>
            <button type="button" onClick={() => setStep("code")} className="btn-secondary">
              Join a guild anyway
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "code") {
    return (
      <div className="mx-auto max-w-md">
        <div className="glass-panel p-6">
          <h2 className="text-lg font-semibold text-white">Join a guild</h2>
          <p className="mt-1 mb-4 text-sm text-white/55">Paste a fellowship code — optional.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const clean = code.trim().toLowerCase();
              if (clean) {
                setCode(clean);
                setStep("name");
              }
            }}
            className="flex gap-2"
          >
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="fellowship-abc12345"
              className="input-premium flex-1 bg-white/5"
            />
            <button type="submit" className="btn-primary whitespace-nowrap">
              Continue
            </button>
          </form>
          <button type="button" onClick={() => setStep("home")} className="mt-4 text-xs text-white/55 underline">
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="glass-panel p-6">
        <h2 className="text-lg font-semibold text-white">Join {code}</h2>
        <p className="mt-1 mb-4 text-sm text-white/55">Pick your name to enter this fellowship.</p>
        <form onSubmit={join} className="flex gap-2">
          <input
            value={joinName}
            onChange={(e) => setJoinName(e.target.value)}
            placeholder="Your name"
            className="input-premium flex-1 bg-white/5"
          />
          <button type="submit" disabled={joining} className="btn-primary">
            {joining ? "…" : "Join"}
          </button>
        </form>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        <button type="button" onClick={() => setStep("code")} className="mt-4 text-xs text-white/55 underline">
          Use a different code
        </button>
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative isolate min-h-screen overflow-x-hidden text-white">
      {/* Decorative only — never captures clicks (Qt WebEngine can mishandle -z-index) */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
        <div
          className="focus-kenburns absolute inset-[-6%] bg-cover bg-center"
          style={{ backgroundImage: "url('/fellowship-hero.png')" }}
        />
        <div className="app-scrim absolute inset-0" />
      </div>
      <div className="relative z-10">{children}</div>
    </main>
  );
}
