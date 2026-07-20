function MessageBubble({ kind = "session", author = "Vous", body, meta }) {
  const cls =
    "ff-msg" +
    (kind === "block" ? " is-block" : "") +
    (kind === "session" ? " is-session" : "");
  return (
    <article className={cls} data-od-id={"msg-" + kind + "-" + (author || "x").toLowerCase()}>
      <div className="ff-msg-head">
        <strong>{author}</strong>
        {meta ? <span className="ff-hint">{meta}</span> : null}
      </div>
      <p className="ff-msg-body">{body}</p>
    </article>
  );
}

Object.assign(window, { MessageBubble });
