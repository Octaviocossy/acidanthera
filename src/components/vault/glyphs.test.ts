import { describe, expect, it } from 'vitest';
import { ACIDANTHERA_MARK_DOT_RADIUS, ACIDANTHERA_MARK_PATH } from './glyphs';

// Every brand SVG, as text. Vite resolves a leading `/` against the project root, so no Node
// typings are needed (the repo has no `@types/node`, and `tsc` type-checks tests too).
const brandSvgs = import.meta.glob(['/assets/brand/**/*.svg', '/public/brand/**/*.svg'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

describe('brand SVGs', () => {
  it('are exactly the four masters and the favicon', () => {
    expect(Object.keys(brandSvgs).sort()).toEqual([
      '/assets/brand/acidanthera-app-icon.svg',
      '/assets/brand/acidanthera-lockup-dark.svg',
      '/assets/brand/acidanthera-lockup-light.svg',
      '/assets/brand/acidanthera-mark.svg',
      '/public/brand/favicon.svg',
    ]);
  });

  it.each(Object.entries(brandSvgs))('%s embeds the mark path verbatim', (_path, source) => {
    expect(source).toContain(`d="${ACIDANTHERA_MARK_PATH}"`);
  });

  it.each(Object.entries(brandSvgs))('%s draws the ember centre at the mark radius', (_path, source) => {
    expect(source).toContain(`r="${ACIDANTHERA_MARK_DOT_RADIUS}"`);
  });
});
