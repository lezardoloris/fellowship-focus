function KpiCard({ label, value, hint, pct, success }) {
  return (
    <article className="ff-card ff-kpi" data-od-id={"kpi-" + label.toLowerCase().replace(/\s+/g, "-")}>
      <div className="ff-label">{label}</div>
      <div className="ff-value">{value}</div>
      <div className="ff-hint">{hint}</div>
      <div className={"ff-progress" + (success ? " is-success" : "")}>
        <span style={{ width: pct + "%" }} />
      </div>
    </article>
  );
}

function KpiRow() {
  const items = [
    { label: "Focus today", value: "2h 14", hint: "minutes", pct: 62 },
    { label: "Weekly XP", value: "840", hint: "score ladder", pct: 48, success: true },
    { label: "Habits", value: "78%", hint: "taux mensuel", pct: 78, success: true },
    { label: "Streak", value: "12", hint: "jours", pct: 40 },
  ];
  return (
    <div className="ff-kpi-row" data-od-id="kpi-row">
      {items.map((k) => (
        <KpiCard key={k.label} {...k} />
      ))}
    </div>
  );
}

Object.assign(window, { KpiRow, KpiCard });
