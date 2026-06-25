import { useState, type FormEvent } from 'react';

interface DocumentInputProps {
  onAdd: (text: string) => void | Promise<void>;
  disabled: boolean;
}

export function DocumentInput({ onAdd, disabled }: DocumentInputProps) {
  const [value, setValue] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = value.trim();
    if (!text || disabled) return;
    void onAdd(text);
    setValue('');
  };

  return (
    <form className="docinput" onSubmit={submit}>
      <textarea
        className="docinput__field"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Add a sentence to the index…"
        rows={2}
        disabled={disabled}
        aria-label="New document text"
      />
      <button type="submit" className="btn btn--accent" disabled={disabled || !value.trim()}>
        Embed &amp; add
      </button>
    </form>
  );
}
