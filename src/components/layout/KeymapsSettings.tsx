import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { SectionLabel } from '@/components/ui/section-label';
import { openConfigFile } from '@/lib/config/open-config-file';
import { type BindingRow, buildBindingSections } from '@/lib/keymap/binding-rows';
import { useAppStore } from '@/stores/app-store';
import { useKeymapStore } from '@/stores/keymap-store';

/** `was Ctrl+wf` for a rebound command, `unbound (was …)` for one `keymaps.toml` cleared with
 *  `[]` — and nothing at all when the row still sits at its default. */
function overrideNote(row: BindingRow): string | undefined {
  if (row.replacedDefault === undefined) return undefined;
  return row.chords.length === 0 ? `unbound (was ${row.replacedDefault})` : `was ${row.replacedDefault}`;
}

function BindingRowView({ row }: { row: BindingRow }) {
  const note = overrideNote(row);

  return (
    <div className="flex items-start justify-between gap-4 py-[6px]">
      <div className="flex min-w-0 flex-col gap-[1px]">
        <span className="font-sans text-body text-text-primary">{row.label}</span>
        <span className="truncate font-mono text-meta text-text-muted">{row.id}</span>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-[3px]">
        {row.chords.length === 0 ? (
          <span className="font-mono text-meta text-text-muted">—</span>
        ) : (
          <div className="flex flex-wrap justify-end gap-1">
            {row.chords.map((chord) => (
              <Kbd key={chord}>{chord}</Kbd>
            ))}
          </div>
        )}
        {note && <span className="font-mono text-meta text-text-muted">{note}</span>}
      </div>
    </div>
  );
}

/**
 * The settings dialog's **Keymaps** category: a read-only rendering of `ResolvedKeymap` — every
 * command in the four dispatcher layers plus the two `editor.*` ones, with every chord each is
 * actually bound to right now.
 *
 * Read-only by decision: ADR 0003 leaves `keymaps.toml` the single writer and ADR 0005 makes the
 * seeded catalog the rebinding UX, so the one control here opens that file instead of capturing a
 * chord. It closes the dialog **first**, because `openConfigFile` → `focusEditor` claims DOM focus
 * (invariant 20) and an open dialog would fight it.
 */
export function KeymapsSettings() {
  const resolved = useKeymapStore((state) => state.resolved);
  const closeSettings = useAppStore((state) => state.closeSettings);
  const sections = useMemo(() => buildBindingSections(resolved), [resolved]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <SectionLabel>Keymaps</SectionLabel>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            closeSettings();
            void openConfigFile('keymaps.toml');
          }}
        >
          Edit keymaps.toml
        </Button>
      </div>

      {resolved.diagnostics.length > 0 && (
        <div className="flex flex-col gap-2 rounded-card border border-border-strong px-4 py-4">
          <SectionLabel>keymaps.toml fell back</SectionLabel>
          {resolved.diagnostics.map((diagnostic) => (
            <span key={diagnostic.message} className="font-sans text-ui text-text-primary">
              {diagnostic.message}
            </span>
          ))}
        </div>
      )}

      <div className="flex max-h-[400px] flex-col gap-5 overflow-y-auto pr-1">
        {sections.map((section) => (
          <section key={section.heading} className="flex flex-col gap-1">
            <SectionLabel className="pb-1">{section.heading}</SectionLabel>
            {section.rows.map((row) => (
              <BindingRowView key={row.id} row={row} />
            ))}
            {section.heading === 'Editor' && (
              <span className="pt-2 font-sans text-caption text-text-secondary">
                Editing keys come from vim, not from this catalog, so they aren't listed here. <span className="font-mono text-meta">:w</span> saves and isn't rebindable.
              </span>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
