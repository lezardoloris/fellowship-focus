"use client";

type TrustMember = {
  member_id: string;
  name: string;
  proof_count_7d: number;
  screen_count_7d: number;
  webcam_count_7d: number;
  activity_score_7d: number;
  last_app: string | null;
  last_proof_at: string | null;
  trust_score: number;
};

export function TrustPanel({ members, myId }: { members: TrustMember[]; myId?: string }) {
  if (members.length === 0) {
    return (
      <div className="glass-card p-6">
        <h2 className="mb-2 text-xl font-semibold">Guild Trust</h2>
        <p className="text-sm text-[#9ca3af]">Active proofs appear when members run focus with Guild Trust enabled.</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-6">
      <h2 className="mb-1 text-xl font-semibold">Guild Trust</h2>
      <p className="mb-5 text-sm text-[#9ca3af]">
        Privacy-first accountability — signal mode shares app name + mouse activity (no keylogging).
      </p>
      <ul className="space-y-3">
        {members.map((m) => (
          <li
            key={m.member_id}
            className={`flex items-center justify-between rounded-lg border border-[#3a3d40] bg-[#2e3134]/50 px-4 py-3 ${
              m.member_id === myId ? "ring-1 ring-[#b8422e]/40" : ""
            }`}
          >
            <div>
              <p className="font-medium text-[#f4f4f5]">
                {m.name}
                {m.member_id === myId ? <span className="ml-2 text-xs accent-text">you</span> : null}
              </p>
              <p className="text-xs text-[#9ca3af]">
                {m.proof_count_7d} proofs · {m.screen_count_7d} screens
                {m.webcam_count_7d > 0 ? ` · ${m.webcam_count_7d} presence` : ""}
                {m.activity_score_7d > 0 ? ` · mouse ${m.activity_score_7d.toLocaleString()}px` : ""}
                {m.last_app ? ` · last: ${m.last_app}` : ""}
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold accent-text">{m.trust_score}</p>
              <p className="text-xs text-[#9ca3af]">trust</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
