function GuildPanel() {
  const rows = [
    { rank: 1, name: "Alex", xp: 1240 },
    { rank: 2, name: "Sam", xp: 980 },
    { rank: 3, name: "Vous", xp: 840, you: true },
    { rank: 4, name: "Jordan", xp: 610 },
    { rank: 5, name: "Riley", xp: 420 },
  ];
  return (
    <section className="ff-card" data-od-id="guild-panel">
      <h2 className="ff-h2">Classement guild</h2>
      <p className="ff-hint" style={{ margin: "6px 0 14px" }}>
        Top 5 cette semaine
      </p>
      <ul className="ff-ladder" data-od-id="guild-ladder">
        {rows.map((r) => (
          <li key={r.rank} className={r.you ? "is-you" : ""} data-od-id={"ladder-" + r.rank}>
            <span className="rank">{r.rank}</span>
            <span className="name">{r.name}</span>
            <span className="xp">{r.xp} XP</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

Object.assign(window, { GuildPanel });
