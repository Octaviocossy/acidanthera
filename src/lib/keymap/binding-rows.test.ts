import { describe, expect, it } from 'vitest';
import { type BindingRow, type BindingSection, buildBindingSections } from './binding-rows';
import { resolveKeymap } from './resolve';

function rowFor(sections: BindingSection[], id: string): BindingRow | undefined {
  return sections.flatMap((section) => section.rows).find((row) => row.id === id);
}

describe('buildBindingSections', () => {
  it('emits the five sections in their documented order', () => {
    const sections = buildBindingSections(resolveKeymap(null));

    expect(sections.map((section) => section.heading)).toEqual(['Global', 'Sidebar', 'Chat history', 'Editor', 'Dialogs']);
  });

  it('marks no row as overridden when nothing overrides the defaults', () => {
    const sections = buildBindingSections(resolveKeymap(null));

    expect(sections.flatMap((section) => section.rows).filter((row) => row.replacedDefault !== undefined)).toEqual([]);
  });

  it('shows every chord a command is bound to', () => {
    const sections = buildBindingSections(resolveKeymap(null));

    expect(rowFor(sections, 'sidebar.open')?.chords).toEqual(['l', '⏎']);
  });

  it('carries the human label from the command registry', () => {
    const sections = buildBindingSections(resolveKeymap(null));

    expect(rowFor(sections, 'global.find-file')?.label).toBe('Find file');
  });

  it('reports the default a rebound command displaced', () => {
    const sections = buildBindingSections(resolveKeymap({ 'global.find-file': ['ctrl-p'] }));
    const row = rowFor(sections, 'global.find-file');

    expect(row?.chords).toEqual(['Ctrl+p']);
    expect(row?.replacedDefault).toBe('Ctrl+wf');
  });

  it('reports an unbound command as having no chords but a displaced default', () => {
    const sections = buildBindingSections(resolveKeymap({ 'global.toggle-chat': [] }));
    const row = rowFor(sections, 'global.toggle-chat');

    expect(row?.chords).toEqual([]);
    expect(row?.replacedDefault).toBe('Ctrl+wc');
  });

  it('excludes the editor commands that are declared but not rebindable', () => {
    const sections = buildBindingSections(resolveKeymap(null));

    expect(rowFor(sections, 'editor.next-tab')).toBeUndefined();
    expect(rowFor(sections, 'editor.previous-tab')).toBeUndefined();
    expect(rowFor(sections, 'editor.close-tab')).toBeUndefined();
    expect(rowFor(sections, 'editor.save')).toBeDefined();
  });
});
