import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '@/stores/app-store';

/**
 * The `:` command-line (doc/v0-spec.md §3.4). v0 slice #10 only builds the mode transition
 * and the input surface — no commands are defined yet, later slices (e.g. `:w` in #14) wire
 * dispatch. Enter/Escape both just return to normal mode.
 */
export function CommandBar() {
  const mode = useAppStore((state) => state.mode);
  const setMode = useAppStore((state) => state.setMode);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mode === 'command') {
      setValue('');
      inputRef.current?.focus();
    }
  }, [mode]);

  if (mode !== 'command') return null;

  return (
    <div className="absolute inset-x-0 bottom-0 flex h-7 items-center gap-1 border-t border-border-hairline bg-surface px-3">
      <span className="font-mono text-text-dim">:</span>
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => setValue(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === 'Escape') {
            event.preventDefault();
            setMode('normal');
          }
        }}
        className="flex-1 bg-transparent font-mono text-sm text-text outline-none"
        spellCheck={false}
        aria-label="Command line"
      />
    </div>
  );
}
