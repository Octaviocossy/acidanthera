import { describe, expect, it } from 'vitest';
import { MAX_TOOL_PATH_CHARS, toolCallPath, truncatePathStart } from './tool-path';

describe('toolCallPath', () => {
  it('returns a vault-relative file path', () => {
    expect(toolCallPath({ file_path: '/vault/notes/a.md' }, '/vault')).toBe('notes/a.md');
  });

  it('normalizes a trailing slash on the vault root', () => {
    expect(toolCallPath({ file_path: '/vault/notes/a.md' }, '/vault/')).toBe('notes/a.md');
  });

  it('collapses a home path outside the vault', () => {
    expect(toolCallPath({ file_path: '/Users/x/.config/app/settings.toml' }, '/vault')).toBe('~/.config/app/settings.toml');
  });

  it('keeps a non-home path unchanged when no vault is open', () => {
    expect(toolCallPath({ file_path: '/tmp/scratch.md' }, null)).toBe('/tmp/scratch.md');
  });

  it('passes a search pattern through unchanged', () => {
    expect(toolCallPath({ pattern: 'TODO\\(\\w+\\)' }, '/vault')).toBe('TODO\\(\\w+\\)');
  });

  it('prefers file_path over path', () => {
    expect(toolCallPath({ file_path: '/vault/file.md', path: '/vault/path.md' }, '/vault')).toBe('file.md');
  });

  it('prefers path over pattern', () => {
    expect(toolCallPath({ path: '/vault/path.md', pattern: 'TODO' }, '/vault')).toBe('path.md');
  });

  it('returns undefined without a path or pattern', () => {
    expect(toolCallPath({}, '/vault')).toBeUndefined();
  });
});

describe('truncatePathStart', () => {
  it('returns a path within the budget unchanged', () => {
    expect(truncatePathStart('notes/a.md')).toBe('notes/a.md');
  });

  it('elides leading segments while keeping the filename', () => {
    expect(truncatePathStart('notes/2026/08/Claude Models.md')).toBe('…/2026/08/Claude Models.md');
  });

  it('hard-cuts a filename that alone exceeds the budget', () => {
    const result = truncatePathStart('filename-that-is-longer-than-budget.md', 10);
    expect(result.startsWith('…')).toBe(true);
    expect(result.endsWith('.md')).toBe(true);
  });

  it('never exceeds the configured or supplied character budget', () => {
    expect(truncatePathStart('many/segments/that/need/to/be/elided/name.md').length).toBeLessThanOrEqual(MAX_TOOL_PATH_CHARS);
    expect(truncatePathStart('filename-that-is-longer-than-budget.md', 10)).toHaveLength(10);
  });
});
