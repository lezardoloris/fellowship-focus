"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn, signOut } from "next-auth/react";
import { BlockTab } from "@/components/BlockTab";
import { FocusTab } from "@/components/FocusTab";
import { FellowshipDashboard } from "@/components/FellowshipDashboard";
import { GuildDirectory } from "@/components/GuildDirectory";
import { ImmersiveScene } from "@/components/ImmersiveScene";
import { SettingsPanel, useBackgroundPrefs } from "@/components/SettingsPanel";
import { PremiumLoader } from "@/components/PremiumLoader";
import { type SceneId } from "@/lib/scenes";

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
  const [tab, setTab] = useState<Tab>("block");
  const [code, setCode] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [shared, setShared] = useState(false);
  const [googleUser, setGoogleUser] = useState<GoogleUserInfo | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [bgPrefs, setBgPrefs] = useBackgroundPrefs();

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

    const tabParam = (params.get("tab") || "").trim().toLowerCase();
    if (tabParam === "block" || tabParam === "focus" || tabParam === "guild") {
      setTab(tabParam);
    }

    // Paint immediately from localStorage — auth hydrates in the background.
    setReady(true);

    (async () => {
      try {
        const res = await fetch("/api/auth/session-user");
        const json = await res.json();
        if (json.authenticated && json.user?.token) {
          const gu = json.user as GoogleUserInfo;
          setGoogleUser(gu);
          localStorage.setItem(GOOGLE_USER_KEY, JSON.stringify(gu));
          if (resolvedToken && resolvedToken !== gu.token) {
            fetch("/api/auth/session-user", {
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

  if (!ready) {
    return (
      <Shell scene={bgPrefs.scene}>
        <PremiumLoader full className="min-h-screen" size="lg" />
      </Shell>
    );
  }

  const joined = Boolean(code && token);

  return (
    <Shell scene={bgPrefs.scene}>
      <header className="sticky top-0 z-20">
        <div className="mx-auto flex max-w-6xl items-center justify-center gap-3 px-4 py-4 md:px-8">
          <nav className="flex items-center gap-1 rounded-full border border-white/20 bg-black/55 p-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                title={t.hint}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  tab === t.id
                    ? "bg-[#b8422e] text-white shadow-lg shadow-[#b8422e]/25"
                    : "text-white/80 hover:text-white"
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
              className="flex items-center gap-2 rounded-full border border-white/20 bg-black/55 px-3 py-1.5 text-xs text-white/85 hover:text-white"
              title={googleUser.email}
            >
              {googleUser.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={googleUser.avatarUrl} alt="" className="h-5 w-5 rounded-full" />
              ) : null}
              Out
            </button>
          ) : (
            <button
              type="button"
              onClick={connectGoogle}
              disabled={authBusy}
              className="rounded-full border border-white/20 bg-black/55 px-3 py-1.5 text-xs text-white/85 disabled:opacity-50"
            >
              {authBusy ? "…" : "Google"}
            </button>
          )}
          {joined && (
            <button
              onClick={share}
              className="rounded-full border border-white/20 bg-black/55 px-3 py-1.5 text-xs text-white/85"
              title={code || undefined}
            >
              {shared ? "✓" : "Share"}
            </button>
          )}
          {joined && (
            <button
              onClick={leaveGuild}
              className="rounded-full border border-white/15 bg-transparent px-2 py-1.5 text-[10px] text-white/70 underline hover:text-white/80"
              title="Leave guild"
            >
              {code}
            </button>
          )}
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white/85 hover:text-white"
            aria-label="Settings"
            title="Settings"
          >
            <SettingsIcon />
          </button>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-4 md:px-8 md:py-6">
        {tab === "block" && <BlockTab code={code} token={token} name={name} />}
        {tab === "focus" && <FocusTab />}
        {tab === "guild" &&
          (joined ? (
            <FellowshipDashboard
              code={code!}
              onCodeResolved={(canonical) => {
                setCode(canonical);
              }}
            />
          ) : (
            <GuildDirectory
              onJoined={onJoined}
              onGoFocus={() => setTab("focus")}
              defaultName={googleUser?.name || name}
            />
          ))}
      </div>

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        bgPrefs={bgPrefs}
        onBgPrefsChange={setBgPrefs}
        token={token}
        code={code}
        name={name}
      />
    </Shell>
  );
}

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M19.4 13a7.8 7.8 0 0 0 .1-2l2-1.2-2-3.4-2.3.6a7.4 7.4 0 0 0-1.7-1L15 3h-4l-.5 2.9a7.4 7.4 0 0 0-1.7 1L6.5 6.4l-2 3.4 2 1.2a7.8 7.8 0 0 0 0 2l-2 1.2 2 3.4 2.3-.6a7.4 7.4 0 0 0 1.7 1L11 21h4l.5-2.9a7.4 7.4 0 0 0 1.7-1l2.3.6 2-3.4-2-1.2Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Shell({ children, scene }: { children: React.ReactNode; scene: SceneId }) {
  return (
    <main className="relative isolate min-h-screen overflow-x-hidden bg-transparent text-white">
      <ImmersiveScene scene={scene} />
      <div className="relative z-10">{children}</div>
    </main>
  );
}
