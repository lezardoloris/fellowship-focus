"use client";

import { useEffect } from "react";

export function LevelUpModal({
  open,
  rank,
  title,
  onClose,
}: {
  open: boolean;
  rank: number;
  title: string;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(onClose, 3200);
    return () => clearTimeout(t);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-labelledby="ff-levelup-title"
      onClick={onClose}
    >
      <div
        className="guild-levelup glass-panel relative max-w-sm overflow-hidden px-8 py-10 text-center shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="guild-levelup-glow pointer-events-none absolute inset-0" aria-hidden />
        <p className="relative text-[10px] font-semibold uppercase tracking-[0.35em] text-white/50">Level up</p>
        <p id="ff-levelup-title" className="font-display relative mt-3 text-4xl font-bold text-white">
          Rank {rank}
        </p>
        <p className="relative mt-2 text-sm accent-text">{title}</p>
        <button type="button" onClick={onClose} className="btn-primary relative mt-8 w-full">
          Continue
        </button>
      </div>
    </div>
  );
}
