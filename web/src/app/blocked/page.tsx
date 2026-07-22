import Link from "next/link";
import { ImmersiveScene } from "@/components/ImmersiveScene";
import { BLOCKED_SCENE } from "@/lib/scenes";

export default function BlockedPreviewPage() {
  return (
    <main className="relative isolate min-h-screen overflow-hidden text-white">
      <ImmersiveScene scene={BLOCKED_SCENE} />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-4 py-12 text-center">
        <div className="glass-panel w-full p-8">
          <p className="font-display text-xs tracking-[0.25em] text-white/50">FELLOWSHIP FOCUS</p>
          <h1 className="mt-2 font-display text-3xl font-semibold">You cannot pass.</h1>
          <p className="mt-3 text-sm text-white/65">
            This site is blocked while your shield is up.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link href="/app" className="btn-primary">
              Open Focus
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
