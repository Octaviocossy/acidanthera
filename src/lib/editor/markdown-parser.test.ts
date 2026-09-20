import { describe, expect, it } from 'vitest';
import { acidantheraMarkdown, fenceLanguage } from './markdown-parser';

describe('fenceLanguage', () => {
  it('resolves a known alias to a Language', () => {
    expect(fenceLanguage('js')).not.toBeNull();
    expect(fenceLanguage('rust')).not.toBeNull();
  });

  it('resolves every curated alias, not only the canonical name', () => {
    for (const alias of ['jsx', 'ts', 'tsx', 'py', 'sh', 'bash', 'zsh', 'yml', 'rs', 'golang', 'htm', 'patch']) {
      expect(fenceLanguage(alias)).not.toBeNull();
    }
  });

  it('returns null for a language outside the curated set', () => {
    expect(fenceLanguage('notalanguage')).toBeNull();
  });

  it('returns null for an empty info string', () => {
    expect(fenceLanguage('')).toBeNull();
  });

  it('is case-insensitive', () => {
    expect(fenceLanguage('JS')).toBe(fenceLanguage('js'));
    expect(fenceLanguage('Rust')).toBe(fenceLanguage('rust'));
  });

  it('is insensitive to surrounding whitespace', () => {
    expect(fenceLanguage('  js  ')).toBe(fenceLanguage('js'));
  });
});

describe('acidantheraMarkdown', () => {
  // The cross-module identity check — this same `LanguageSupport`'s parser is what the *markdown
  // walker* parses with — extends the existing invariant-36 test in `markdown-walker.test.tsx`
  // rather than being duplicated here.
  it('returns the same LanguageSupport on every call', () => {
    expect(acidantheraMarkdown()).toBe(acidantheraMarkdown());
  });
});
