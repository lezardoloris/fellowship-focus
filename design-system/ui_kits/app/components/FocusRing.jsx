function FocusRing({ time = "32:14", phase = "Focus", progress = 0.7 }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - progress);
  return (
    <section className="ff-card ff-focus-panel" data-od-id="focus-ring-panel">
      <h2 className="ff-h2">Session en cours</h2>
      <div className="ff-ring-wrap" data-od-id="focus-ring">
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle cx="60" cy="60" r={r} fill="none" stroke="#3a3d40" strokeWidth="4" />
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke="#b8422e"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%" }}
          />
        </svg>
        <div className="ff-ring-center">
          <div className="ff-label">{phase}</div>
          <div className="ff-ring-time">{time}</div>
        </div>
      </div>
      <div className="ff-focus-actions">
        <button type="button" className="ff-btn ff-btn-primary" data-od-id="btn-start">
          Reprendre
        </button>
        <button type="button" className="ff-btn ff-btn-ghost" data-od-id="btn-pause">
          Pause
        </button>
      </div>
    </section>
  );
}

Object.assign(window, { FocusRing });
