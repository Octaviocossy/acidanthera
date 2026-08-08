import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { listModels } from '@/lib/agent/model-catalog';
import { pickAndPersistVault } from '@/lib/vault/pick-vault';
import type { SettingsDiagnostic, ThemeName } from '@/services/settings.service';
import { useAppStore } from '@/stores/app-store';
import { useChatStore } from '@/stores/chat-store';
import { useSettingsStore } from '@/stores/settings-store';

const THEMES: ThemeName[] = ['dark', 'light'];

function SettingsRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="shrink-0 font-mono text-text-dim text-xs uppercase tracking-caps">{label}</span>
      {children}
    </div>
  );
}

/**
 * The settings dialog (#29): a modal overlay editing the four persisted settings (#25) —
 * model, theme, editor font, vault path — through `useSettingsStore`'s write-through
 * `updateSettings`. Monochrome, hand-built on `Button`/`Badge` like every overlay
 * (doc/v0-spec.md §5.6). Selecting a model also switches the chat model (and thus its
 * engine) immediately (the reactive wiring #25 deferred); theme/font values are applied by
 * the theme slice (#28). Opened from the StatusBar button or the `Ctrl-w` `s` chord; Escape
 * or a scrim click closes.
 */
export function SettingsDialog() {
  const open = useAppStore((state) => state.settingsOpen);
  const closeSettings = useAppStore((state) => state.closeSettings);
  const settings = useSettingsStore((state) => state.settings);
  const diagnostics = useSettingsStore((state) => state.diagnostics);
  const loadSettings = useSettingsStore((state) => state.loadSettings);
  const updateSettings = useSettingsStore((state) => state.updateSettings);
  const setModel = useChatStore((state) => state.setModel);

  const syntaxError = diagnostics.find((diagnostic): diagnostic is Extract<SettingsDiagnostic, { kind: 'syntax' }> => diagnostic.kind === 'syntax');

  const panelRef = useRef<HTMLDivElement>(null);
  const [fontDraft, setFontDraft] = useState('');

  // Settings are loaded at boot by `useSettingsBootstrap`; this covers the dialog racing it.
  useEffect(() => {
    if (open && settings === null) void loadSettings();
  }, [open, settings, loadSettings]);

  useEffect(() => {
    if (!open) return;
    setFontDraft(settings?.editorFont ?? '');
    panelRef.current?.focus();
  }, [open, settings?.editorFont]);

  // Window-level so Escape closes even when focus has wandered off the panel. Non-Escape
  // keys never bubble past the panel (see its onKeyDown), so this never double-handles.
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeSettings();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, closeSettings]);

  if (!open) return null;

  const commitFont = () => {
    if (settings === null) return;
    const next = fontDraft.trim();
    if (next === '' || next === settings.editorFont) {
      setFontDraft(settings.editorFont);
      return;
    }
    void updateSettings({ editorFont: next });
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: scrim click-to-close; Escape (window listener above) is the keyboard path and the panel is the real dialog.
    <div role="presentation" className="absolute inset-0 flex items-center justify-center bg-bg/70" onClick={closeSettings}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        tabIndex={-1}
        className="w-[420px] rounded-lg border border-border-hairline bg-surface outline-none"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          // Keep keystrokes inside the modal: without this, `:`/`Ctrl-w` typed while a
          // dialog control is focused would drive the app under the scrim. Escape is let
          // through to the window listener above.
          if (event.key !== 'Escape') event.stopPropagation();
        }}
      >
        <div className="flex items-center justify-between border-b border-border-hairline px-4 py-2">
          <span className="font-mono text-text-faint text-xs uppercase tracking-caps">Settings</span>
          <Button variant="ghost" size="sm" asKbd onClick={closeSettings} aria-label="Close settings">
            esc
          </Button>
        </div>

        {settings !== null && syntaxError && (
          <div className="flex flex-col gap-2 rounded-sm border border-border-active px-4 py-4">
            <span className="font-mono text-text-dim text-xs uppercase tracking-caps">settings.toml has a syntax error</span>
            <span className="font-sans text-sm text-text">
              {syntaxError.line !== null ? `Line ${syntaxError.line}: ` : ''}
              {syntaxError.message}
            </span>
            <span className="font-sans text-text-faint text-xs">Fix the file on disk, then reopen this dialog. Settings can't be changed until it parses.</span>
          </div>
        )}

        {settings !== null && !syntaxError && (
          <div className="flex flex-col gap-4 px-4 py-4">
            <SettingsRow label="Model">
              <div className="flex flex-wrap justify-end gap-1">
                {listModels().map((model) => (
                  <button
                    key={model.id}
                    type="button"
                    aria-pressed={model.id === settings.model}
                    onClick={() => {
                      void updateSettings({ model: model.id });
                      setModel(model.id);
                    }}
                  >
                    <Badge tone={model.id === settings.model ? 'plain' : 'muted'}>{model.label}</Badge>
                  </button>
                ))}
              </div>
            </SettingsRow>

            <SettingsRow label="Theme">
              <div className="flex gap-1">
                {THEMES.map((theme) => (
                  <button key={theme} type="button" aria-pressed={theme === settings.theme} onClick={() => void updateSettings({ theme })}>
                    <Badge tone={theme === settings.theme ? 'plain' : 'muted'}>{theme}</Badge>
                  </button>
                ))}
              </div>
            </SettingsRow>

            <SettingsRow label="Editor font">
              <input
                value={fontDraft}
                onChange={(event) => setFontDraft(event.currentTarget.value)}
                onBlur={commitFont}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    commitFont();
                  }
                }}
                className="w-48 rounded-sm border border-border-hairline bg-transparent px-2 py-1 font-sans text-sm text-text outline-none focus:border-border-active"
                spellCheck={false}
                aria-label="Editor font"
              />
            </SettingsRow>

            <SettingsRow label="Vault">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate font-sans text-sm text-text-dim" title={settings.vaultPath}>
                  {settings.vaultPath}
                </span>
                <Button variant="ghost" size="sm" className="shrink-0" onClick={() => void pickAndPersistVault()}>
                  Change…
                </Button>
              </div>
            </SettingsRow>
          </div>
        )}
      </div>
    </div>
  );
}
