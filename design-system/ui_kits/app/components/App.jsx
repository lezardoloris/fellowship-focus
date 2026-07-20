function App() {
  const [active, setActive] = React.useState("overview");
  const [notes, setNotes] = React.useState([
    { kind: "session", author: "Vous", body: "Session focus 45 min · Spec landing", meta: "il y a 12 min" },
    { kind: "block", author: "Blocker", body: "youtube.com bloqué pendant la session", meta: "il y a 18 min" },
    { kind: "session", author: "Alex", body: "Habit Deep work AM validé", meta: "il y a 1 h" },
  ]);
  const titles = {
    overview: "Overview",
    tasks: "Tasks",
    focus: "Focus",
    blocker: "Blocker",
    settings: "Settings",
  };

  return (
    <div className="ff-shell" data-od-id="app-shell">
      <Sidebar active={active} onNavigate={setActive} />
      <div className="ff-main">
        <TopBar title={titles[active] || "Overview"} />
        <div className="ff-content" data-od-id="main-content">
          {active === "overview" && (
            <>
              <KpiRow />
              <div className="ff-split">
                <div className="ff-split-main">
                  <OkrPanel />
                  <GuildPanel />
                  <ChatArea>
                    {notes.map((n, i) => (
                      <MessageBubble key={i} {...n} />
                    ))}
                  </ChatArea>
                  <InputBar
                    onSend={(text) =>
                      setNotes((prev) => [
                        { kind: "session", author: "Vous", body: text, meta: "à l'instant" },
                        ...prev,
                      ])
                    }
                  />
                </div>
                <FocusRing />
              </div>
            </>
          )}
          {active === "tasks" && (
            <section className="ff-card" data-od-id="tasks-panel">
              <h2 className="ff-h2">À faire</h2>
              <p className="ff-hint" style={{ margin: "6px 0 14px" }}>
                Double-clic pour lancer une session
              </p>
              <div className="ff-task" data-od-id="task-1">
                <span>Spec landing client</span>
                <span className="ff-hint">01:20 / 02:00</span>
              </div>
              <div className="ff-task" data-od-id="task-2">
                <span>Revue PR dashboard</span>
                <span className="ff-hint">00:40 / 01:00</span>
              </div>
              <button type="button" className="ff-btn ff-btn-primary" style={{ marginTop: 16 }} data-od-id="btn-focus-task">
                Démarrer le focus
              </button>
            </section>
          )}
          {active === "focus" && (
            <div style={{ display: "flex", justifyContent: "center", paddingTop: 24 }}>
              <FocusRing time="45:00" phase="Prêt" progress={0} />
            </div>
          )}
          {active === "blocker" && (
            <section className="ff-card" data-od-id="blocker-panel">
              <h2 className="ff-h2">Blocker</h2>
              <p className="ff-hint" style={{ margin: "6px 0 14px" }}>
                Sites bloqués pendant les sessions focus
              </p>
              <div className="ff-task">twitter.com · x.com · youtube.com · tiktok.com · reddit.com</div>
              <button type="button" className="ff-btn ff-btn-primary" style={{ marginTop: 16 }} data-od-id="btn-save-blocker">
                Enregistrer
              </button>
            </section>
          )}
          {active === "settings" && (
            <section className="ff-card" data-od-id="settings-panel">
              <h2 className="ff-h2">Réglages</h2>
              <p className="ff-hint" style={{ margin: "6px 0 14px" }}>
                Connexion guild et cibles hebdo
              </p>
              <label className="ff-label" style={{ display: "block", marginBottom: 6 }}>
                Nom d'affichage
              </label>
              <input className="ff-input" defaultValue="Vous" data-od-id="input-name" />
              <label className="ff-label" style={{ display: "block", margin: "14px 0 6px" }}>
                Objectif focus
              </label>
              <input className="ff-input" defaultValue="20 h / semaine" data-od-id="input-focus-target" />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { App });
