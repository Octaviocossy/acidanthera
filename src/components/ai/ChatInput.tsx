import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { type AgentModelId, listModels } from '@/lib/agent/model-catalog';
import { useChatStore } from '@/stores/chat-store';

export interface ChatInputProps {
  disabled?: boolean;
  /**
   * Invitation shown while the field is empty. The one thing that differs between this component's
   * two mounts (spec decision 26): the *agent panel*'s input is a running conversation, the *agent
   * dock* a cold start. Everything else — the well, the model pill, the send control and the submit
   * wiring — stays shared, which is what stops the two drifting apart.
   *
   * `disabled` still wins over it: a turn in flight is worth saying whatever the mount.
   */
  placeholder?: string;
  onSubmit: (text: string) => void;
}

const MODELS = listModels();

/** The chat input with a persistent model chooser for the next agent turn. */
export function ChatInput({ disabled = false, placeholder = 'Ask about your vault…', onSubmit }: ChatInputProps) {
  const [value, setValue] = useState('');
  const modelId = useChatStore((state) => state.modelId);
  const setModel = useChatStore((state) => state.setModel);
  const model = MODELS.find((candidate) => candidate.id === modelId);

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    setValue('');
  }

  return (
    <div className="border-t border-hairline p-3">
      <div className="rounded-card border border-border bg-elevated px-3 py-2.5 transition-colors duration-[var(--dur)] ease-acidanthera focus-within:border-border-strong">
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
          placeholder={disabled ? 'Waiting for the agent…' : placeholder}
          className="w-full bg-transparent font-sans text-input text-text-primary outline-none placeholder:text-text-muted disabled:opacity-50"
          spellCheck={false}
          aria-label="Chat input"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <label className="relative cursor-pointer">
            <Chip variant="model">{model?.label.toLowerCase() ?? modelId}</Chip>
            <select
              value={modelId}
              onChange={(event) => setModel(event.currentTarget.value as AgentModelId)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              aria-label="Select model"
            >
              {MODELS.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.label}
                </option>
              ))}
            </select>
          </label>
          {/* `⏎`, not `⌘⏎`: the handler above fires on bare `Enter` (spec decision 27). Chat submit
              is deliberately not an `AppCommandId` — in-input handlers are out of `APP_COMMANDS`'
              scope — so this hint cannot be keymap-derived, and the honest fix for a false literal
              is the right literal rather than a modifier nobody asked for in a single-line field. */}
          <Button variant="primary" size="sm" kbd="⏎" disabled={disabled || !value.trim()} onClick={submit}>
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
