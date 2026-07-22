"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn, signOut } from "next-auth/react";
import { BlockTab } from "@/components/BlockTab";
import { FocusTab } from "@/components/FocusTab";
import { FellowshipDashboard } from "@/components/FellowshipDashboard";
import { GuildDirectory } from "@/components/GuildDirectory";

type Tab = "block" | "focus" | "guild";

const TABS: Array<{ id: Tab; label: string; hint: string }> = [
  { id: "block", label: "Block", hint: "Your shield" },
  { id: "focus", label: "Focus", hint: "Ladder, calendar & tracking — no guild needed" },
  { id: "guild", label: "Guild", hint: "Optional social layer" },
];

const LAST_CODE_KEY = "ff-app-code";
const GOOGLE_USER_KEY = "ff-google-user";

type GoogleUserInfo = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  token: string;
};

export function FocusApp() {
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>("focus");
  const [code, setCode] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [shared, setShared] = useState(false);
  const [googleUser, setGoogleUser] = useState<GoogleUserInfo | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  // Resolve guild membership, then optional Google solo identity.
  useEffect(() => {
    const urlCode = (params.get("code") || "").trim().toLowerCase();
    const urlToken = (params.get("token") || "").trim();
    const urlName = (params.get("name") || "").trim();
    const stored = (localStorage.getItem(LAST_CODE_KEY) || "").trim().toLowerCase();

    let resolvedToken: string | null = null;
    let resolvedCode: string | null = null;
    let resolvedName: string | null = null;

    if (urlCode && urlToken) {
      localStorage.setItem(LAST_CODE_KEY, urlCode);
      localStorage.setItem(`ff-member-${urlCode}`, JSON.stringify({ token: urlToken, name: urlName }));
      resolvedCode = urlCode;
      resolvedToken = urlToken;
      resolvedName = urlName || null;
    } else {
      const candidate = urlCode || stored;
      if (candidate) {
        const raw = localStorage.getItem(`ff-member-${candidate}`);
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as { token: string; name: string };
            if (parsed.token) {
              resolvedCode = candidate;
              resolvedToken = parsed.token;
              resolvedName = parsed.name || null;
            }
          } catch {
            /* ignore */
          }
        }
        if (!resolvedToken && !urlToken) localStorage.removeItem(LAST_CODE_KEY);
      }
    }

    setCode(resolvedCode);
    setToken(resolvedToken);
    setName(resolvedName);

    (async () => {
      try {
        const res = await fetch("/api/auth/session-user");
        const json = await res.json();
        if (json.authenticated && json.user?.token) {
          const gu = json.user as GoogleUserInfo;
          setGoogleUser(gu);
          localStorage.setItem(GOOGLE_USER_KEY, JSON.stringify(gu));
          if (resolvedToken && resolvedToken !== gu.token) {
            await fetch("/api/auth/session-user", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token: resolvedToken }),
            }).catch(() => {});
          } else if (!resolvedToken) {
            setToken(gu.token);
            setName(gu.name);
          }
        } else {
          const cached = localStorage.getItem(GOOGLE_USER_KEY);
          if (cached && !resolvedToken) {
            try {
              const gu = JSON.parse(cached) as GoogleUserInfo;
              if (gu.token) {
                setGoogleUser(gu);
                setToken(gu.token);
                setName(gu.name);
              }
            } catch {
              /* ignore */
            }
          }
        }
      } catch {
        /* auth optional until env configured */
      } finally {
        setReady(true);
      }
    })();
  }, [params]);

  const onJoined = useCallback(
    (c: string, t: string, n: string) => {
      const clean = c.trim().toLowerCase();
      localStorage.setItem(LAST_CODE_KEY, clean);
      localStorage.setItem(`ff-member-${clean}`, JSON.stringify({ token: t, name: n }));
      setCode(clean);
      setToken(t);
      setName(n);
      if (googleUser) {
        fetch("/api/auth/session-user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: t }),
        }).catch(() => {});
      }
    },
    [googleUser]
  );

  const leaveGuild = useCallback(() => {
    if (code) localStorage.removeItem(`ff-member-${code}`);
    localStorage.removeItem(LAST_CODE_KEY);
    setCode(null);
    if (googleUser?.token) {
      setToken(googleUser.token);
      setName(googleUser.name);
    } else {
      setToken(null);
      setName(null);
    }
  }, [code, googleUser]);

  async function connectGoogle() {
    setAuthBusy(true);
    try {
      await signIn("google", { callbackUrl: "/app" });
    } finally {
      setAuthBusy(false);
    }
  }

  async function disconnectGoogle() {
    setAuthBusy(true);
    try {
      localStorage.removeItem(GOOGLE_USER_KEY);
      setGoogleUser(null);
      if (!code) {
        setToken(null);
        setName(null);
      }
      await signOut({ callbackUrl: "/app" });
    } finally {
      setAuthBusy(false);
    }
  }

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
              ) : googleUser ? (
                <>{googleUser.name || googleUser.email} · signed in</>
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
          {googleUser ? (
            <button
              type="button"
              onClick={disconnectGoogle}
              disabled={authBusy}
              className="flex items-center gap-2 rounded-full border border-white/15 bg-black/20 px-3 py-1.5 text-xs text-white/80 hover:text-white"
              title={googleUser.email}
            >
              {googleUser.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={googleUser.avatarUrl} alt="" className="h-5 w-5 rounded-full" />
              ) : null}
              Sign out
            </button>
          ) : (
            <button
              type="button"
              onClick={connectGoogle}
              disabled={authBusy}
              className="btn-secondary border-white/15 bg-black/20 text-white disabled:opacity-50"
            >
              {authBusy ? "…" : "Google"}
            </button>
          )}
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
            <GuildDirectory
              onJoined={onJoined}
              onGoFocus={() => setTab("focus")}
              defaultName={googleUser?.name || name}
            />
          ))}
      </div>
    </Shell>
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
