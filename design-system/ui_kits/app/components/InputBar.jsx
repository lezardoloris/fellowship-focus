function InputBar({ placeholder = "Note de session…", onSend }) {
  const [value, setValue] = React.useState("");
  return (
    <form
      className="ff-input-bar"
      data-od-id="input-bar"
      onSubmit={(e) => {
        e.preventDefault();
        if (onSend && value.trim()) onSend(value.trim());
        setValue("");
      }}
    >
      <input
        className="ff-input"
        data-od-id="composer-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label="Composer"
      />
      <button type="submit" className="ff-btn ff-btn-primary" data-od-id="composer-send">
        Envoyer
      </button>
    </form>
  );
}

Object.assign(window, { InputBar });
