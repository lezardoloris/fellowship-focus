function TopBar({ title = "Overview" }) {
  return (
    <header className="ff-topbar" data-od-id="topbar">
      <h1 className="ff-h1" data-od-id="page-title">
        {title}
      </h1>
      <div className="ff-topbar-pills" data-od-id="status-pills">
        <span className="ff-pill is-success" data-od-id="pill-guild">
          <span className="dot" />
          Guild · Nord
        </span>
        <span className="ff-pill is-accent" data-od-id="pill-blocker">
          <span className="dot" />
          Blocker actif
        </span>
      </div>
    </header>
  );
}

Object.assign(window, { TopBar });
