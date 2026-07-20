function OkrRow({ label, current, target, unit }) {
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  return (
    <div className="ff-okr-row" data-od-id={"okr-" + label.toLowerCase().replace(/\s+/g, "-")}>
      <div className="ff-okr-head">
        <span>{label}</span>
        <span className="ff-hint">
          {current}
          {unit} / {target}
          {unit} ({pct}%)
        </span>
      </div>
      <div className="ff-progress">
        <span style={{ width: pct + "%" }} />
      </div>
    </div>
  );
}

function OkrPanel() {
  return (
    <section className="ff-card" data-od-id="okr-panel">
      <h2 className="ff-h2">OKR de la semaine</h2>
      <p className="ff-hint" style={{ margin: "6px 0 16px" }}>
        Boucle freelance — focus, habits, revenu
      </p>
      <OkrRow label="Heures focus" current={8.5} target={20} unit="h" />
      <OkrRow label="Complétion habits" current={62} target={80} unit="%" />
      <OkrRow label="Revenu freelance" current={1200} target={3000} unit="€" />
    </section>
  );
}

Object.assign(window, { OkrPanel, OkrRow });
