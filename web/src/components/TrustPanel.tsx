"use client";

type TrustMember = {
  member_id: string;
  name: string;
  proof_count_7d: number;
  screen_count_7d: number;
  webcam_count_7d: number;
  last_app: string | null;
  last_proof_at: string | null;
  trust_score: number;
};

export function TrustPanel({ members, myId }: { members: TrustMember[]; myId?: string }) {
  if (members.length === 0) {
    return (
      <div className="glass-card p-6">
        <h2 className="font-display mb-2 text-xl font-semibold">Guild Trust</h2>
        <p className="text-sm text-stone-500">Active proofs appear when members run focus with Guild Trust enabled.</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-6">
      <h2 className="font-display mb-1 text-xl font-semibold">Guild Trust</h2>
      <p className="mb-5 text-sm text-stone-500">
        Privacy-first accountability — signal mode shares app name only, not your screen.
      </p>
      <ul className="space-y-3">
        {members.map((m) => (
          <li
            key={m.member_id}
            className={`flex items-center justify-between rounded-xl border border-stone-800/80 bg-black/20 px-4 py-3 ${
              m.member_id === myId ? "ring-1 ring-amber-500/40" : ""
            }`}
          >
            <div>
              <p className="font-medium text-stone-200">
                {m.name}
                {m.member_id === myId ? <span className="ml-2 text-xs text-amber-500">you</span> : null}
              </p>
              <p className="text-xs text-stone-500">
                {m.proof_count_7d} proofs · {m.screen_count_7d} screens
                {m.webcam_count_7d > 0 ? ` · ${m.webcam_count_7d} presence` : ""}
                {m.last_app ? ` · last: ${m.last_app}` : ""}
              </p>
            </div>
            <div className="text-right">
              <p className="font-display text-lg font-bold text-amber-400">{m.trust_score}</p>
              <p className="text-xs text-stone-600">trust</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
