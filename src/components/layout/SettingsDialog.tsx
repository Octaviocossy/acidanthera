import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { SectionLabel } from '@/components/ui/section-label';
import { Segmented } from '@/components/ui/segmented';
import { listModels } from '@/lib/agent/model-catalog';
import { displayPath } from '@/lib/vault/display-path';
import { pickAndPersistVault } from '@/lib/vault/pick-vault';
import type { SettingsDiagnostic, ThemeName } from '@/services/settings.service';
import { useAppStore } from '@/stores/app-store';
import { useChatStore } from '@/stores/chat-store';
import { useSettingsStore } from '@/stores/settings-store';

const THEMES: ThemeName[] = ['dark', 'light'];
const CATEGORIES = ['Appearance', 'Editor', 'Vault'] as const;
type SettingsCategory = (typeof CATEGORIES)[number];

function SettingsRow({ label, description, children }: { label: string; description?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4">
        <span className="shrink-0 font-sans text-body text-text-primary">{label}</span>
        {children}
      </div>
      {description && <span className="font-sans text-caption text-text-secondary">{description}</span>}
    </div>
  );
}

/**
 * The settings dialog (#29): a modal overlay editing the four persisted settings (#25) —
 * model, theme, editor font, vault path — through `useSettingsStore`'s write-through
 * `updateSettings`. Monochrome, hand-built on the design primitives. Selecting a model also
 * switches the chat model (and thus its engine) immediately; theme/font values are applied by
 * the theme slice. Opened from the titlebar control or the `Ctrl-w` `s` chord; Escape or a
 * scrim click closes.
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
  const [category, setCategory] = useState<SettingsCategory>('Appearance');

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
    <div role="presentation" className="absolute inset-0 flex items-center justify-center bg-[var(--scrim)]" onClick={closeSettings}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        tabIndex={-1}
        className="w-[760px] overflow-hidden rounded-modal border border-border-strong bg-surface shadow-[var(--shadow-overlay-dark)] outline-none"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          // Keep keystrokes inside the modal: without this, `:`/`Ctrl-w` typed while a
          // dialog control is focused would drive the app under the scrim. Escape is let
          // through to the window listener above.
          if (event.key !== 'Escape') event.stopPropagation();
        }}
      >
        <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
          <SectionLabel>Settings</SectionLabel>
          <Button variant="ghost" size="sm" asKbd onClick={closeSettings} aria-label="Close settings">
            esc
          </Button>
        </div>

        <div className="flex min-h-[360px]">
          <nav aria-label="Settings categories" className="w-44 shrink-0 border-r border-hairline p-3">
            {CATEGORIES.map((item) => (
              <button
                key={item}
                type="button"
                aria-current={item === category ? 'page' : undefined}
                className={`flex w-full rounded-item px-[10px] py-2 text-left font-sans text-body ${item === category ? 'bg-elevated text-text-primary' : 'text-text-secondary'}`}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </nav>

          <div className="min-w-0 flex-1 p-5">
            {settings !== null && syntaxError && (
              <div className="flex flex-col gap-2 rounded-card border border-border-strong px-4 py-4">
                <SectionLabel>settings.toml has a syntax error</SectionLabel>
                <span className="font-sans text-ui text-text-primary">
                  {syntaxError.line !== null && <span className="font-mono text-meta">Line {syntaxError.line}: </span>}
                  {syntaxError.message}
                </span>
                <span className="font-sans text-caption text-text-secondary">Fix the file on disk, then reopen this dialog. Settings can't be changed until it parses.</span>
              </div>
            )}

            {settings !== null && !syntaxError && category === 'Appearance' && (
              <div className="flex flex-col gap-6">
                <SettingsRow label="Theme">
                  <Segmented options={THEMES} value={settings.theme} onChange={(theme) => void updateSettings({ theme: theme as ThemeName })} />
                </SettingsRow>
                <SettingsRow label="Model" description="Selects the model used for new agent turns.">
                  <div className="flex flex-wrap justify-end gap-2">
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
                        <Chip variant={model.id === settings.model ? 'model' : 'plain'}>{model.label}</Chip>
                      </button>
                    ))}
                  </div>
                </SettingsRow>
              </div>
            )}

            {settings !== null && !syntaxError && category === 'Editor' && (
              <SettingsRow label="Editor font" description="Applied to the editor canvas.">
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
                  className="w-56 rounded-card border border-border bg-[var(--surface-input)] px-3 py-2 font-sans text-input text-text-primary outline-none focus:border-border-strong"
                  spellCheck={false}
                  aria-label="Editor font"
                />
              </SettingsRow>
            )}

            {settings !== null && !syntaxError && category === 'Vault' && (
              <SettingsRow label="Vault" description="The root folder opened when Orbit starts.">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="truncate font-mono text-meta text-text-muted" title={settings.vaultPath}>
                    {displayPath(settings.vaultPath)}
                  </span>
                  <Button variant="secondary" size="sm" className="shrink-0" onClick={() => void pickAndPersistVault()}>
                    Change…
                  </Button>
                </div>
              </SettingsRow>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
