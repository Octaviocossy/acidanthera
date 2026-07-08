import { useState } from 'react';

export interface ChatInputProps {
  disabled?: boolean;
  onSubmit: (text: string) => void;
}

/** The chat's `›`-prompt input row (doc/v0-spec.md §5.2, §5.6). */
export function ChatInput({ disabled = false, onSubmit }: ChatInputProps) {
  const [value, setValue] = useState('');

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    setValue('');
  }

  return (
    <div className="flex items-center gap-2 border-t border-border-hairline px-3 py-2">
      <span className="font-mono text-text-dim">{'›'}</span>
      <input
        value={value}
        disabled={disabled}
        onChange={(event) => setValue(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            submit();
          }
        }}
        placeholder={disabled ? 'Waiting for the agent…' : 'Ask the agent…'}
        className="flex-1 bg-transparent font-mono text-sm text-text outline-none placeholder:text-text-faint disabled:opacity-50"
        spellCheck={false}
        aria-label="Chat input"
      />
    </div>
  );
}
