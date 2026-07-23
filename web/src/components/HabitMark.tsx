"use client";

import type { ReactNode, SVGProps } from "react";
import {
  DEFAULT_HABIT_MARK,
  HABIT_MARKS,
  resolveHabitMarkId,
  type HabitMarkId,
} from "@/lib/habits";

type Props = {
  /** Mark id (`sword`) or legacy unicode emoji (`⚔️`). */
  mark: string;
  className?: string;
  title?: string;
};

/** Heritage line marks — replaces cheap system emoji in habit UI. */
export function HabitMark({ mark, className = "", title }: Props) {
  const id = resolveHabitMarkId(mark);
  const Icon = ICONS[id] || ICONS[DEFAULT_HABIT_MARK];
  const label = title || HABIT_MARKS[id]?.label || HABIT_MARKS[DEFAULT_HABIT_MARK].label;
  return (
    <span
      className={`inline-flex items-center justify-center text-[#e8a090] ${className}`}
      role="img"
      aria-label={label}
      title={label}
    >
      <Icon className="h-[1em] w-[1em]" />
    </span>
  );
}

type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps, children: ReactNode) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  );
}

const ICONS: Record<HabitMarkId, (p: IconProps) => ReactNode> = {
  sword: (p) =>
    base(
      p,
      <>
        <path d="M14.5 4.5 19.5 9.5" />
        <path d="M5 19 14.2 9.8" />
        <path d="M12.5 7.5 16.5 11.5" />
        <path d="M8 16l-3 3" />
        <path d="M10.5 13.5 8 16" />
        <path d="M6.5 14.5 9.5 17.5" />
      </>
    ),
  shield: (p) =>
    base(
      p,
      <>
        <path d="M12 3.5 19 6.5v5.2c0 4.3-2.9 7.4-7 8.8-4.1-1.4-7-4.5-7-8.8V6.5L12 3.5Z" />
        <path d="M12 8v8" />
        <path d="M9 12h6" />
      </>
    ),
  flame: (p) =>
    base(
      p,
      <path d="M12 20c3.2 0 5.5-2.2 5.5-5.2 0-2.6-1.5-4.2-3.2-5.7.2 1.6-.3 2.8-1.3 3.5 0-3.2-1.4-5.6-3.8-7.6 0 2.4-.7 4.2-2 5.5C6 12.2 5 13.8 5 15.5 5 18.2 7.4 20 12 20Z" />
    ),
  candle: (p) =>
    base(
      p,
      <>
        <path d="M10 21h4v-9h-4v9Z" />
        <path d="M9 12h6" />
        <path d="M12 12V8.5" />
        <path d="M12 8.5c.9-.4 1.4-1.2 1.2-2.1-.5.2-1 .7-1.2 1.3-.2-.6-.7-1.1-1.2-1.3-.2.9.3 1.7 1.2 2.1Z" />
      </>
    ),
  mountain: (p) =>
    base(
      p,
      <>
        <path d="m3.5 18.5 5.2-8.2 3.1 4.2 2.4-3.6 6.3 7.6" />
        <path d="m11.2 10.2 1.6-1.5 1.3 1.8" />
      </>
    ),
  tree: (p) =>
    base(
      p,
      <>
        <path d="M12 21v-6" />
        <path d="M12 15c-3.2 0-5-1.8-5-4.2C7 8.2 9.2 6.5 12 5c2.8 1.5 5 3.2 5 5.8 0 2.4-1.8 4.2-5 4.2Z" />
        <path d="M9.5 11.5h5" />
      </>
    ),
  sunrise: (p) =>
    base(
      p,
      <>
        <path d="M4 17h16" />
        <path d="M7 17a5 5 0 0 1 10 0" />
        <path d="M12 7v2" />
        <path d="m7.5 9.5 1.2 1.2" />
        <path d="m16.5 9.5-1.2 1.2" />
      </>
    ),
  moon: (p) =>
    base(
      p,
      <path d="M16.5 13.8A6.2 6.2 0 0 1 10 6.2 6.5 6.5 0 1 0 16.5 13.8Z" />
    ),
  torii: (p) =>
    base(
      p,
      <>
        <path d="M5 20V9" />
        <path d="M19 20V9" />
        <path d="M4 9h16" />
        <path d="M3.5 6.5 12 4.5l8.5 2" />
        <path d="M7 13h10" />
      </>
    ),
  lotus: (p) =>
    base(
      p,
      <>
        <path d="M12 19c-2.8-1.2-5-3.4-5-6.2 1.8.3 3.5 1.4 5 3.2 1.5-1.8 3.2-2.9 5-3.2 0 2.8-2.2 5-5 6.2Z" />
        <path d="M12 15.8c-1.4-2.2-1.6-4.6-.8-6.8.9 1.1 1.6 2.5 1.6 4.2 0-.9.2-1.8.7-2.6.6 1.9.3 3.9-.7 5.2Z" />
        <path d="M7.5 11.5c1.2-2 3-3.3 5-3.8" />
        <path d="M16.5 11.5c-1.2-2-3-3.3-5-3.8" />
      </>
    ),
  strength: (p) =>
    base(
      p,
      <>
        <path d="M7 10v4" />
        <path d="M17 10v4" />
        <path d="M5 11v2" />
        <path d="M19 11v2" />
        <path d="M7 12h10" />
        <path d="M9 9.5v5" />
        <path d="M15 9.5v5" />
      </>
    ),
  run: (p) =>
    base(
      p,
      <>
        <circle cx="14.5" cy="5.5" r="1.6" />
        <path d="m10 21 2.2-5.2L9 13l3-3 3.2 2.2 3.3-1" />
        <path d="m9 13-3 2.5" />
        <path d="m14.2 15.8 2.3 5" />
      </>
    ),
  book: (p) =>
    base(
      p,
      <>
        <path d="M5 5.5h5.5A2.5 2.5 0 0 1 13 8v11.5H7A2 2 0 0 1 5 17.5v-12Z" />
        <path d="M19 5.5h-5.5A2.5 2.5 0 0 0 11 8v11.5h6a2 2 0 0 0 2-2v-12Z" />
      </>
    ),
  quill: (p) =>
    base(
      p,
      <>
        <path d="M6 19.5 14.5 6.5c1.2-1.8 3.4-1.5 4.2-.4.8 1.1.4 3.2-1.2 4.5L8.5 19.5" />
        <path d="M9.5 16.5 14 12" />
        <path d="M5.5 20h4" />
      </>
    ),
  audio: (p) =>
    base(
      p,
      <>
        <path d="M4 13a4 4 0 0 1 4-4h1l5-3v12l-5-3H8a4 4 0 0 1-4-4Z" />
        <path d="M17.5 9.5a3.5 3.5 0 0 1 0 5" />
      </>
    ),
  code: (p) =>
    base(
      p,
      <>
        <path d="m8 8-4 4 4 4" />
        <path d="m16 8 4 4-4 4" />
        <path d="m13 7-2 10" />
      </>
    ),
  target: (p) =>
    base(
      p,
      <>
        <circle cx="12" cy="12" r="7.5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
      </>
    ),
  chart: (p) =>
    base(
      p,
      <>
        <path d="M4 19h16" />
        <path d="M7 16v-4" />
        <path d="M12 16V8" />
        <path d="M17 16v-7" />
      </>
    ),
  crate: (p) =>
    base(
      p,
      <>
        <path d="M4.5 8.5 12 4.5l7.5 4v9L12 21.5 4.5 17.5v-9Z" />
        <path d="M4.5 8.5 12 12.5l7.5-4" />
        <path d="M12 12.5V21.5" />
      </>
    ),
  mirror: (p) =>
    base(
      p,
      <>
        <rect x="7" y="3.5" width="10" height="14" rx="5" />
        <path d="M9 20.5h6" />
        <path d="M12 17.5v3" />
      </>
    ),
  gem: (p) =>
    base(
      p,
      <>
        <path d="M12 20.5 4.5 10.5 8 4.5h8l3.5 6L12 20.5Z" />
        <path d="M4.5 10.5h15" />
        <path d="M8 4.5 12 10.5 16 4.5" />
      </>
    ),
  crown: (p) =>
    base(
      p,
      <>
        <path d="M5 17.5h14l-1.2-8.5L14 12l-2-6.5L10 12 6.2 9 5 17.5Z" />
        <path d="M6 17.5h12" />
      </>
    ),
  ring: (p) =>
    base(
      p,
      <>
        <circle cx="12" cy="13.5" r="5.5" />
        <path d="M10 8.2 12 4.5l2 3.7" />
      </>
    ),
  spark: (p) =>
    base(
      p,
      <>
        <path d="M12 3.5v4" />
        <path d="M12 16.5v4" />
        <path d="M3.5 12h4" />
        <path d="M16.5 12h4" />
        <path d="m6.2 6.2 2.5 2.5" />
        <path d="m15.3 15.3 2.5 2.5" />
        <path d="m17.8 6.2-2.5 2.5" />
        <path d="m8.7 15.3-2.5 2.5" />
      </>
    ),
  ban: (p) =>
    base(
      p,
      <>
        <circle cx="12" cy="12" r="7.5" />
        <path d="m7.2 7.2 9.6 9.6" />
      </>
    ),
  smoke: (p) =>
    base(
      p,
      <>
        <path d="M7 19h10" />
        <path d="M9 19c0-3 1.5-4 1.5-6.5S9 9 9 7.5" />
        <path d="M12.5 19c0-2.5 1.5-3.5 1.5-6s-1.2-3.2-1.2-5" />
        <path d="M15.5 19c0-2 .8-3 1.2-4.5" />
      </>
    ),
};
