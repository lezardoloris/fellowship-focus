import Image from "next/image";
import Link from "next/link";

export default function BlockedPreviewPage() {
  return (
    <main className="relative isolate min-h-screen overflow-hidden text-white">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div
          className="absolute inset-0 bg-cover bg-center opacity-40"
          style={{ backgroundImage: "url('/fellowship-hero.png')" }}
        />
        <div className="absolute inset-0 bg-[#0c0e10]/85" />
      </div>
      <div className="relative z-10 mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-4 py-12 text-center">
        <div className="glass-panel w-full p-8">
          <div className="relative mx-auto mb-6 h-28 w-full overflow-hidden rounded-lg">
            <Image
              src="/assets/cannot-pass.jpg"
              alt=""
              fill
              className="object-cover brightness-75"
            />
          </div>
          <p className="font-display text-xs tracking-[0.25em] text-white/45">FELLOWSHIP FOCUS</p>
          <h1 className="mt-2 font-display text-3xl font-semibold">You cannot pass.</h1>
          <p className="mt-3 text-sm text-white/60">
            This site is blocked while your shield is up. Start a focus quest instead.
          </p>
          <p className="mt-4 text-lg font-semibold text-[#fca5a5]">example.com</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link href="/app" className="btn-primary">
              Open Focus
            </Link>
            <Link href="/app" className="btn-secondary">
              Dashboard
            </Link>
          </div>
        </div>
        <p className="mt-6 text-xs text-white/40">Preview of the live extension block page</p>
      </div>
    </main>
  );
}
