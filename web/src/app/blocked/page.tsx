export default function BlockedPreviewPage() {
  return (
    <main className="min-h-screen bg-[#1a1c1e]">
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="overflow-hidden rounded-xl border border-[#3a3d40] bg-[#242628]">
          <div className="p-8 text-center">
            <h1 className="mb-4 text-3xl font-semibold text-[#f4f4f5]">You cannot pass.</h1>
            <p className="mb-6 text-[#9ca3af]">
              This site is blocked during your focus session.
              <br />
              The Fellowship is counting on you.
            </p>
            <div className="mb-4 inline-block rounded-full border border-red-500/30 bg-red-950/30 px-6 py-2 text-xl font-bold text-red-300">
              −15 XP
            </div>
            <p className="mb-4 text-sm text-[#9ca3af]">twitter.com</p>
            <p className="text-xs text-[#9ca3af]">
              Weekly ladder: <strong className="text-[#f4f4f5]">#3</strong> of 4 · 45 net XP
            </p>
            <p className="mt-4 text-xs text-[#9ca3af]">
              Your distraction costs the Fellowship <strong className="text-red-400/80">−3 XP</strong> on the shared
              journey.
            </p>
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-[#9ca3af]">Preview — shown in browser when blocking is active</p>
      </div>
    </main>
  );
}
