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
      <div className="glass-panel p-5 md:p-6">
        <h3 className="text-sm font-semibold text-white">Guild Trust</h3>
        <p className="mt-3 text-sm text-white/45">
          Proofs appear when members run focus with Guild Trust enabled.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-panel p-5 md:p-6">
      <h3 className="text-sm font-semibold text-white">Guild Trust</h3>
      <p className="mt-1 text-[11px] text-white/45">
        Signal mode · app name + activity · no keylogging
      </p>
      <ul className="mt-4 space-y-2">
        {members.map((m) => (
          <li
            key={m.member_id}
            className={`flex items-center justify-between rounded-lg px-3 py-2.5 ${
              m.member_id === myId
                ? "bg-[#b8422e]/12 ring-1 ring-[#b8422e]/30"
                : "bg-white/[0.04]"
            }`}
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-white/90">
                {m.name}
                {m.member_id === myId ? <span className="ml-2 text-xs accent-text">you</span> : null}
              </p>
              <p className="text-[11px] text-white/45">
                {m.proof_count_7d} proofs · {m.screen_count_7d} screens
                {m.webcam_count_7d > 0 ? ` · ${m.webcam_count_7d} presence` : ""}
                {m.last_app ? ` · ${m.last_app}` : ""}
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold tabular-nums accent-text">{m.trust_score}</p>
              <div className="mt-0.5 flex justify-end gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span
                    key={i}
                    className={`h-1 w-2 rounded-full ${
                      i < Math.min(5, Math.ceil(m.trust_score / 20))
                        ? "bg-[#b8422e]"
                        : "bg-white/15"
                    }`}
                  />
                ))}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
