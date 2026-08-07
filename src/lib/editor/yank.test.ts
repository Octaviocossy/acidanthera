import { EditorView } from '@codemirror/view';
import { getCM, Vim, vim } from '@replit/codemirror-vim';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveKeymap } from '@/lib/keymap/resolve';
import { clipboardService } from '@/services/clipboard.service';
import { useToastStore } from '@/stores/toast-store';
import { apply } from './yank';

vi.mock('@/services/clipboard.service', () => ({
  clipboardService: {
    writeText: vi.fn(),
  },
}));

const writeText = vi.mocked(clipboardService.writeText);

apply(resolveKeymap(null));

function createEditor(doc = 'alpha beta\ngamma\ndelta\n') {
  const parent = document.createElement('div');
  document.body.append(parent);
  const view = new EditorView({ doc, extensions: [vim()], parent });
  const cm = getCM(view);

  if (cm === null) throw new Error('Vim editor was not initialized');

  return { cm, view, parent };
}

function press(cm: NonNullable<ReturnType<typeof getCM>>, ...keys: string[]) {
  for (const key of keys) Vim.handleKey(cm, key, 'user');
}

describe('system yank', () => {
  let editor: ReturnType<typeof createEditor> | undefined;

  beforeEach(() => {
    writeText.mockReset();
    writeText.mockResolvedValue();
    useToastStore.setState({ toasts: [] });
    Vim.getRegisterController().unnamedRegister.clear();
    Vim.getRegisterController().getRegister('a').clear();
  });

  afterEach(() => {
    editor?.view.destroy();
    editor?.parent.remove();
    editor = undefined;
  });

  it('copies a normal-mode line yank to the Vim register and system clipboard', async () => {
    editor = createEditor();

    press(editor.cm, 'y', 'y');
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledWith('alpha beta\n');
    expect(Vim.getRegisterController().unnamedRegister.toString()).toBe('alpha beta\n');
    expect(useToastStore.getState().toasts).toHaveLength(1);
    expect(useToastStore.getState().toasts[0]).toMatchObject({ message: 'Yanked to clipboard', tone: 'info' });
  });

  it('copies a normal-mode motion yank without mutating the document', async () => {
    editor = createEditor();

    press(editor.cm, 'y', 'w');
    await Promise.resolve();

    expect(editor.view.state.doc.toString()).toBe('alpha beta\ngamma\ndelta\n');
    expect(Vim.getRegisterController().unnamedRegister.toString()).toBe('alpha ');
    expect(writeText).toHaveBeenCalledWith('alpha ');
  });

  it('preserves counted line yank behavior', async () => {
    editor = createEditor();

    press(editor.cm, '2', 'y', 'y');
    await Promise.resolve();

    expect(Vim.getRegisterController().unnamedRegister.toString()).toBe('alpha beta\ngamma\n');
    expect(writeText).toHaveBeenCalledWith('alpha beta\ngamma\n');
  });

  it('preserves named-register yanks', async () => {
    editor = createEditor();

    press(editor.cm, '"', 'a', 'y', 'y');
    await Promise.resolve();

    expect(Vim.getRegisterController().getRegister('a').toString()).toBe('alpha beta\n');
    expect(writeText).toHaveBeenCalledWith('alpha beta\n');
  });

  it('copies a Visual Line selection and returns to normal mode', async () => {
    editor = createEditor();

    press(editor.cm, 'V', 'y');
    await Promise.resolve();

    expect(editor.view.state.doc.toString()).toBe('alpha beta\ngamma\ndelta\n');
    expect(writeText).toHaveBeenCalledWith('alpha beta\n');
    expect(editor.cm.state.vim?.visualMode).toBe(false);
    expect(useToastStore.getState().toasts[0]).toMatchObject({ message: 'Yanked to clipboard', tone: 'info' });
  });

  it('keeps characterwise Visual yanks inside Vim registers only', () => {
    editor = createEditor();

    press(editor.cm, 'v', 'l', 'y');

    expect(Vim.getRegisterController().unnamedRegister.toString()).not.toBe('');
    expect(writeText).not.toHaveBeenCalled();
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('reports clipboard failures without losing the Vim register', async () => {
    writeText.mockRejectedValueOnce(new Error('clipboard unavailable'));
    editor = createEditor();

    press(editor.cm, 'y', 'y');
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledWith('alpha beta\n');
    expect(Vim.getRegisterController().unnamedRegister.toString()).toBe('alpha beta\n');
    expect(useToastStore.getState().toasts[0]).toMatchObject({
      message: 'Yank failed: clipboard unavailable',
      tone: 'error',
    });
  });
});

describe('system yank — apply()', () => {
  let editor: ReturnType<typeof createEditor> | undefined;

  beforeEach(() => {
    writeText.mockReset();
    writeText.mockResolvedValue();
    useToastStore.setState({ toasts: [] });
    Vim.getRegisterController().unnamedRegister.clear();
  });

  afterEach(() => {
    editor?.view.destroy();
    editor?.parent.remove();
    editor = undefined;
    // Restore the default binding so later tests (and other files reusing the shared Vim
    // singleton within this run) see 'y' mapped to systemYank again.
    apply(resolveKeymap(null));
  });

  it('is idempotent: reapplying the same resolved keymap does not rebind or duplicate the clipboard write', async () => {
    apply(resolveKeymap(null));
    apply(resolveKeymap(null));
    editor = createEditor();

    press(editor.cm, 'y', 'y');
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledTimes(1);
  });

  it('rebinds editor.system-yank to another chord, and y round-trips back to vim default yank', async () => {
    apply(resolveKeymap({ 'editor.system-yank': ['z'] }));
    editor = createEditor();

    press(editor.cm, 'y', 'y');
    await Promise.resolve();
    expect(writeText).not.toHaveBeenCalled();
    expect(Vim.getRegisterController().unnamedRegister.toString()).toBe('alpha beta\n');

    writeText.mockClear();
    Vim.getRegisterController().unnamedRegister.clear();

    press(editor.cm, 'z', 'z');
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith('alpha beta\n');
    expect(Vim.getRegisterController().unnamedRegister.toString()).toBe('alpha beta\n');

    // Vim.unmap round trip: reverting the override restores 'y' -> systemYank and drops 'z'.
    apply(resolveKeymap(null));
    writeText.mockClear();
    Vim.getRegisterController().unnamedRegister.clear();

    press(editor.cm, 'y', 'y');
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith('alpha beta\n');
  });
});
