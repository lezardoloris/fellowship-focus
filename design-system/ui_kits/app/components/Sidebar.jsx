function Sidebar({ active = "overview", onNavigate }) {
  const items = [
    { id: "overview", label: "Overview" },
    { id: "tasks", label: "Tasks" },
    { id: "focus", label: "Focus" },
    { id: "blocker", label: "Blocker" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <aside className="ff-sidebar" data-od-id="sidebar">
      <div className="ff-brand" data-od-id="sidebar-brand">
        <div className="ff-display">Fellowship</div>
        <div className="ff-display">Focus</div>
      </div>
      <nav className="ff-nav" data-od-id="sidebar-nav">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={"ff-nav-item" + (active === item.id ? " is-active" : "")}
            data-od-id={"nav-" + item.id}
            onClick={() => onNavigate && onNavigate(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div className="ff-sidebar-foot ff-hint" data-od-id="sidebar-version">
        v1.3.0 · premium focus
      </div>
    </aside>
  );
}

Object.assign(window, { Sidebar });
