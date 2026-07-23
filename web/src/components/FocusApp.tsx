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
import { BlockerModePill, BlockerModeProvider } from "@/components/BlockerMode";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useToast } from "@/components/Toasts";
import { type SceneId } from "@/lib/scenes";
import type { BackgroundQuality } from "@/lib/backgroundPrefs";

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
  fellowshipCode?: string | null;
  memberName?: string | null;
};

function readStoredMember(code: string): { token: string; name: string } | null {
  const raw = localStorage.getItem(`ff-member-${code}`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { token?: string; name?: string };
    if (!parsed.token) return null;
    return { token: parsed.token, name: parsed.name || "" };
  } catch {
    return null;
  }
}

function persistMembership(code: string, token: string, name: string) {
  const clean = code.trim().toLowerCase();
  localStorage.setItem(LAST_CODE_KEY, clean);
  localStorage.setItem(`ff-member-${clean}`, JSON.stringify({ token, name }));
}

export function FocusApp() {
  const params = useSearchParams();
  const toast = useToast();
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
      persistMembership(urlCode, urlToken, urlName);
      resolvedCode = urlCode;
      resolvedToken = urlToken;
      resolvedName = urlName || null;
    } else {
      const candidate = urlCode || stored;
      if (candidate) {
        const member = readStoredMember(candidate);
        if (member) {
          resolvedCode = candidate;
          resolvedToken = member.token;
          resolvedName = member.name || null;
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
            // Google may already be linked to a guild member — restore code+token
            // so the Guild tab shows the dashboard instead of Join again.
            const linkedCode = (gu.fellowshipCode || "").trim().toLowerCase();
            if (linkedCode && gu.token) {
              const linkedName = gu.memberName || gu.name || "";
              persistMembership(linkedCode, gu.token, linkedName);
              setCode(linkedCode);
              setToken(gu.token);
              setName(linkedName || null);
            } else {
              setToken(gu.token);
              setName(gu.name);
            }
          }
        } else {
          const cached = localStorage.getItem(GOOGLE_USER_KEY);
          if (cached && !resolvedToken) {
            try {
              const gu = JSON.parse(cached) as GoogleUserInfo;
              const linkedCode = (gu.fellowshipCode || "").trim().toLowerCase();
              if (linkedCode && gu.token) {
                const member = readStoredMember(linkedCode);
                const linkedName = member?.name || gu.memberName || gu.name || "";
                const linkedToken = member?.token || gu.token;
                persistMembership(linkedCode, linkedToken, linkedName);
                setGoogleUser(gu);
                setCode(linkedCode);
                setToken(linkedToken);
                setName(linkedName || null);
              } else if (gu.token) {
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
      persistMembership(clean, t, n);
      setCode(clean);
      setToken(t);
      setName(n);
      if (googleUser) {
        fetch("/api/auth/session-user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: t }),
        })
          .then((res) => res.json())
          .then((json) => {
            if (json?.user?.token) {
              const gu = { ...googleUser, ...json.user } as GoogleUserInfo;
              setGoogleUser(gu);
              localStorage.setItem(GOOGLE_USER_KEY, JSON.stringify(gu));
            }
          })
          .catch(() => {});
      }
    },
    [googleUser]
  );

  const leaveGuild = useCallback(() => {
    if (!code) return;
    if (!window.confirm(`Leave guild “${code}”? You can rejoin anytime.`)) return;
    localStorage.removeItem(`ff-member-${code}`);
    localStorage.removeItem(LAST_CODE_KEY);
    setCode(null);
    if (googleUser?.token) {
      setToken(googleUser.token);
      setName(googleUser.name);
    } else {
      setToken(null);
      setName(null);
    }
    toast.info("Left guild");
  }, [code, googleUser, toast]);

  async function connectGoogle() {
    setAuthBusy(true);
    try {
      const res = await fetch("/api/auth/providers-status");
      const status = (await res.json()) as { google?: boolean };
      if (!status.google) {
        toast.error(
          "Google sign-in not configured",
          "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on the server (see docs/GOOGLE-OAUTH-SETUP.md)."
        );
        return;
      }
      await signIn("google", { callbackUrl: "/app" });
    } catch {
      toast.error("Sign-in failed");
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

  async function share() {
    if (!code) return;
    const url = `${window.location.origin}/app?code=${code}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.ok("Invite link copied");
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch {
      window.prompt("Copy invite link:", url);
      toast.info("Copy the invite link");
    }
  }

  if (!ready) {
    return (
      <Shell scene={bgPrefs.scene} quality={bgPrefs.quality}>
        <PremiumLoader full className="min-h-screen" size="lg" />
      </Shell>
    );
  }

  const joined = Boolean(code && token);

  return (
    <BlockerModeProvider>
    <Shell scene={bgPrefs.scene} quality={bgPrefs.quality}>
      <header className="header-glass sticky top-0 z-20">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-2 px-3 py-2.5 sm:gap-2.5 md:gap-3 md:px-8 md:py-3">
          <span className="font-display hidden text-sm font-semibold tracking-wide text-white/90 lg:inline">
            Fellowship Focus
          </span>
          <nav
            className="flex min-h-11 items-center gap-1 rounded-full border border-white/20 bg-black/55 p-1"
            aria-label="Main"
          >
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-current={tab === t.id ? "page" : undefined}
                onClick={() => setTab(t.id)}
                title={t.hint}
                className={`min-h-9 rounded-full px-3.5 py-1.5 text-sm font-medium transition sm:px-4 ${
                  tab === t.id
                    ? "bg-[#b8422e] text-white shadow-lg shadow-[#b8422e]/25"
                    : "text-white/80 hover:text-white"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
          <BlockerModePill />
          <div className="flex min-h-11 flex-wrap items-center justify-center gap-1.5 sm:gap-2">
          {googleUser ? (
            <button
              type="button"
              onClick={disconnectGoogle}
              disabled={authBusy}
              className="flex min-h-9 items-center gap-2 rounded-full border border-white/20 bg-black/55 px-3 py-1.5 text-xs text-white/85 hover:text-white"
              title={googleUser.email}
            >
              {googleUser.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={googleUser.avatarUrl} alt="" className="h-5 w-5 rounded-full" />
              ) : null}
              <span className="hidden sm:inline">Sign out</span>
              <span className="sm:hidden">Out</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={connectGoogle}
              disabled={authBusy}
              className="min-h-9 rounded-full border border-white/20 bg-black/55 px-3 py-1.5 text-xs text-white/85 disabled:opacity-50"
            >
              {authBusy ? "…" : "Sign in"}
            </button>
          )}
          {joined && (
            <button
              type="button"
              onClick={share}
              className="min-h-9 rounded-full border border-white/20 bg-black/55 px-3 py-1.5 text-xs text-white/85"
              title={code || undefined}
            >
              {shared ? "Copied" : "Share"}
            </button>
          )}
          {joined && (
            <button
              type="button"
              onClick={leaveGuild}
              className="min-h-9 rounded-full border border-white/15 bg-transparent px-2.5 py-1.5 text-[11px] text-white/70 hover:text-white/90"
              title={`Leave ${code}`}
            >
              Leave
            </button>
          )}
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white/85 hover:text-white"
            aria-label="Settings"
            title="Settings"
          >
            <SettingsIcon />
          </button>
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-4 md:px-8 md:py-6">
        {/* Keep Block mounted when switching tabs so timer/shield state survives. */}
        <div className={tab === "block" ? undefined : "hidden"} aria-hidden={tab !== "block"}>
          <ErrorBoundary fallbackTitle="Block panel crashed">
            <BlockTab code={code} token={token} name={name} />
          </ErrorBoundary>
        </div>
        {tab === "focus" && (
          <ErrorBoundary fallbackTitle="Focus panel crashed">
            <FocusTab token={token} fellowshipCode={code} />
          </ErrorBoundary>
        )}
        {tab === "guild" &&
          (joined ? (
            <ErrorBoundary fallbackTitle="Guild panel crashed">
              <FellowshipDashboard
                code={code!}
                onCodeResolved={(canonical) => {
                  setCode(canonical);
                }}
              />
            </ErrorBoundary>
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
    </BlockerModeProvider>
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

function Shell({
  children,
  scene,
  quality,
}: {
  children: React.ReactNode;
  scene: SceneId;
  quality: BackgroundQuality;
}) {
  return (
    <main className="relative isolate min-h-screen overflow-x-hidden bg-transparent text-white">
      <ImmersiveScene scene={scene} quality={quality} />
      <div className="relative z-10">{children}</div>
    </main>
  );
}
