import { beforeAll, describe, expect, it } from 'vitest';
import { DURATION, EASE, EXIT_RATIO, enterTransition, exitTransition } from './tokens';

// Reading the stylesheet needs Node's `fs`, and two easier routes are closed. `import …?raw` is
// blanked by Vitest's `css: false` (every `.css` request, `?raw` included, resolves to ""), and a
// static `import 'node:fs'` fails `tsc`, which type-checks tests and has no `@types/node` (see
// `glyphs.test.ts`). A non-literal specifier types as `any` and still resolves to Node's module.
interface NodeFs {
  readFileSync(path: URL, encoding: 'utf8'): string;
}

async function readMotionCss(): Promise<string> {
  const specifier = 'node:fs';
  const fs = (await import(/* @vite-ignore */ specifier)) as NodeFs;
  // Keep `import.meta.url` in a variable: written inline as `new URL('…', import.meta.url)`, Vite and
  // Vitest rewrite it against the jsdom page's `http://localhost` origin, which `fs` cannot read.
  const here = import.meta.url;
  return fs.readFileSync(new URL('../../styles/tokens/motion.css', here), 'utf8');
}

/** Every `--dur*` / `--ease*` custom property the stylesheet declares, comments stripped. */
function declarations(css: string): Map<string, string> {
  const found = new Map<string, string>();
  const code = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const match of code.matchAll(/(--(?:dur|ease)[\w-]*)\s*:\s*([^;]+);/g)) found.set(match[1], match[2].trim());
  return found;
}

function millis(value: string | undefined): number {
  const match = /^(\d+(?:\.\d+)?)ms$/.exec(value ?? '');
  if (!match) throw new Error(`not a millisecond duration: ${value}`);
  return Number(match[1]);
}

function bezier(value: string | undefined): number[] {
  const match = /^cubic-bezier\(([^)]*)\)$/.exec(value ?? '');
  if (!match) throw new Error(`not a cubic-bezier curve: ${value}`);
  return match[1].split(',').map((part) => Number(part.trim()));
}

const DURATION_VARS = { '--dur-fast': 'fast', '--dur': 'base', '--dur-slow': 'slow' } as const;
const EASE_VARS = { '--ease': 'standard', '--ease-out': 'out', '--ease-in': 'in' } as const;

describe('motion tokens', () => {
  let css: Map<string, string>;
  beforeAll(async () => {
    css = declarations(await readMotionCss());
  });

  it('declares exactly the custom properties the TS mirror covers', () => {
    expect([...css.keys()].sort()).toEqual([...Object.keys(DURATION_VARS), ...Object.keys(EASE_VARS)].sort());
  });

  it.each(Object.entries(DURATION_VARS))('mirrors %s as DURATION.%s, in seconds', (cssVar, step) => {
    expect(DURATION[step as keyof typeof DURATION]).toBeCloseTo(millis(css.get(cssVar)) / 1000, 6);
  });

  it.each(Object.entries(EASE_VARS))('mirrors %s as EASE.%s', (cssVar, curve) => {
    expect([...EASE[curve as keyof typeof EASE]]).toEqual(bezier(css.get(cssVar)));
  });

  it('enters on the full step with the decelerating curve', () => {
    expect(enterTransition('slow')).toEqual({ duration: DURATION.slow, ease: EASE.out });
  });

  it('exits on EXIT_RATIO of the step with the accelerating curve', () => {
    const exit = exitTransition('base');
    expect(exit.duration).toBeCloseTo(DURATION.base * EXIT_RATIO, 6);
    expect(exit.ease).toEqual(EASE.in);
  });
});
