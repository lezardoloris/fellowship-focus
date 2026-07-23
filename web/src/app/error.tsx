"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-display text-2xl text-white">Something went wrong</h1>
      <p className="max-w-md text-sm text-white/65">
        The app hit an unexpected error. You can try again without losing your guild invite.
      </p>
      <button type="button" onClick={reset} className="btn-primary">
        Try again
      </button>
    </div>
  );
}
