import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AGENT_DEFAULT_WIDTH, RAIL_WIDTH, SIDEBAR_DEFAULT_WIDTH, sidebarRenderedWidth, usePanelWidths } from './panel-widths';

// Reading the stylesheet needs Node's `fs`, and two easier routes are closed. `import …?raw` is
// blanked by Vitest's `css: false` (every `.css` request, `?raw` included, resolves to ""), and a
// static `import 'node:fs'` fails `tsc`, which type-checks tests and has no `@types/node` (see
// `src/lib/motion/tokens.test.ts`). A non-literal specifier types as `any` and still resolves to
// Node's module.
interface NodeFs {
  readFileSync(path: URL, encoding: 'utf8'): string;
}

async function readRailsCss(): Promise<string> {
  const specifier = 'node:fs';
  const fs = (await import(/* @vite-ignore */ specifier)) as NodeFs;
  // Keep `import.meta.url` in a variable: written inline as `new URL('…', import.meta.url)`, Vite
  // and Vitest rewrite it against the jsdom page's `http://localhost` origin, which `fs` cannot read.
  const here = import.meta.url;
  return fs.readFileSync(new URL('../../styles/tokens/rails.css', here), 'utf8');
}

describe('panel-widths', () => {
  it('mirrors the rail width token in rails.css', async () => {
    const css = (await readRailsCss()).replace(/\/\*[\s\S]*?\*\//g, '');
    const match = /--rail-sidebar-collapsed\s*:\s*(\d+)px\s*;/.exec(css);
    expect(Number(match?.[1])).toBe(RAIL_WIDTH);
  });

  it('reports the default widths and no drag', () => {
    const { result } = renderHook(() => usePanelWidths());
    expect(result.current).toEqual({ sidebar: SIDEBAR_DEFAULT_WIDTH, agent: AGENT_DEFAULT_WIDTH, dragging: null });
  });

  it('starts the rendered width at the expanded default', () => {
    expect(sidebarRenderedWidth.get()).toBe(SIDEBAR_DEFAULT_WIDTH);
  });
});
