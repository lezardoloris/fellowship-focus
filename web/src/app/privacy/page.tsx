import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — Fellowship Focus",
};

/** Public privacy policy (required for the Chrome Web Store listing). Kept in
 *  sync with extension/store/PRIVACY.md. */
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-16 text-white">
      <Link href="/" className="mb-8 inline-block text-sm text-white/60 hover:text-white">
        ← Back
      </Link>
      <h1 className="mb-2 font-display text-3xl font-bold">Privacy Policy</h1>
      <p className="mb-8 text-sm text-white/50">Last updated: 22 July 2026</p>

      <div className="space-y-6 text-[15px] leading-relaxed text-white/80">
        <p>
          Fellowship Focus is a website blocker and focus timer. It is built to
          protect your attention, not to collect your data.
        </p>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-white">What it does NOT do</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>It does not sell, rent, or share your data with anyone.</li>
            <li>It does not run analytics or advertising trackers.</li>
            <li>It does not read the content of the pages you visit.</li>
            <li>It does not send your browsing history anywhere.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-white">
            What data is handled, and where it stays
          </h2>
          <p className="mb-2">
            <strong>Stored only on your device:</strong> your block list, allow
            list, schedules, preferences, and local focus/block counters. This
            never leaves your browser.
          </p>
          <p>
            <strong>Sent only to the Fellowship server you choose to connect
            (optional):</strong> if you connect a guild, the extension sends the
            minimum needed to power shared accountability — a block event (the
            domain and your member token) and focus session completions. If you
            never connect a guild, nothing is sent to any server.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-white">Permissions</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Redirect distracting sites to a block page (declarativeNetRequest).</li>
            <li>Block a site the instant navigation starts (webNavigation).</li>
            <li>Redirect tabs already open when the shield turns on (tabs).</li>
            <li>Clear a blocked site&apos;s cached service worker (browsingData).</li>
            <li>Save settings, run the timer, show notifications.</li>
            <li>Act on any site you add to your block list (host access).</li>
            <li>
              History is optional: only requested if you tap &quot;Scan
              history&quot;, analyzed locally, never uploaded. Decline and
              everything else still works.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-white">Your control</h2>
          <p>
            Everything is off until you turn the shield on. You can disconnect a
            guild at any time. Uninstalling removes all locally stored data.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-white">Contact</h2>
          <p>Questions: privacy@fellowshipfocus.app</p>
        </section>
      </div>
    </main>
  );
}
