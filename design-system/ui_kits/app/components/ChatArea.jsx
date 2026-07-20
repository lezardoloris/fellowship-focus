function ChatArea({ children }) {
  return (
    <section className="ff-card ff-chat-area" data-od-id="chat-area">
      <h2 className="ff-h2">Activité guild</h2>
      <p className="ff-hint" style={{ margin: "6px 0 14px" }}>
        Preuves et sessions · TrustPanel
      </p>
      <div className="ff-chat-scroll" data-od-id="chat-scroll">
        {children}
      </div>
    </section>
  );
}

Object.assign(window, { ChatArea });
