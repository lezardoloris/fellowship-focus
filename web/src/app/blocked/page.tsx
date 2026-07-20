import Image from "next/image";

export default function BlockedPreviewPage() {
  return (
    <main className="min-h-screen bg-[#060806]">
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="overflow-hidden rounded-2xl border border-amber-500/20 bg-[#0c100c] shadow-2xl">
          <div className="relative h-56">
            <Image src="/assets/cannot-pass.jpg" alt="" fill className="object-cover brightness-75" />
          </div>
          <div className="p-8 text-center">
            <h1 className="font-display gold-text mb-4 text-4xl font-bold">You cannot pass.</h1>
            <p className="mb-6 text-stone-400">
              This site is blocked during your focus quest.
              <br />
              The Fellowship is counting on you.
            </p>
            <div className="mb-4 inline-block rounded-full border border-red-500/30 bg-red-950/30 px-6 py-2 text-xl font-bold text-red-300">
              −15 XP
            </div>
            <p className="mb-4 text-sm text-amber-500/80">twitter.com</p>
            <p className="text-xs text-stone-500">
              Weekly ladder: <strong className="text-stone-300">#3</strong> of 4 · 45 net XP
            </p>
            <p className="mt-4 text-xs text-stone-600">
              Your distraction costs the Fellowship <strong className="text-red-400/80">−3 XP</strong> on the shared
              journey.
            </p>
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-stone-600">Preview — shown in browser when blocking is active</p>
      </div>
    </main>
  );
}
