import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Settings } from '@/services/settings.service';
import { useAppStore } from '@/stores/app-store';
import { useSettingsStore } from '@/stores/settings-store';
import {
  AGENT_DEFAULT_WIDTH,
  computeEffectiveWidths,
  RAIL_WIDTH,
  resolveAgentDrag,
  resolveSidebarDrag,
  SIDEBAR_DEFAULT_WIDTH,
  sidebarRenderedWidth,
  usePanelWidths,
} from './panel-widths';

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

const BASE_SETTINGS: Settings = { model: 'sonnet-5', editorFont: 'JetBrains Mono', theme: 'dark', vaultPath: '/vault', dailyNoteFolder: 'daily', contentZoom: 1 };

const initialAppState = useAppStore.getState();
const initialSettingsState = useSettingsStore.getState();

beforeEach(() => {
  useAppStore.setState(initialAppState, true);
  useSettingsStore.setState(initialSettingsState, true);
});

afterEach(() => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1024 });
});

describe('panel-widths', () => {
  it('mirrors the rail width token in rails.css', async () => {
    const css = (await readRailsCss()).replace(/\/\*[\s\S]*?\*\//g, '');
    const match = /--rail-sidebar-collapsed\s*:\s*(\d+)px\s*;/.exec(css);
    expect(Number(match?.[1])).toBe(RAIL_WIDTH);
  });

  it('starts the rendered width at the expanded default', () => {
    expect(sidebarRenderedWidth.get()).toBe(SIDEBAR_DEFAULT_WIDTH);
  });
});

describe('computeEffectiveWidths', () => {
  it('keeps both preferences when the window has room', () => {
    expect(computeEffectiveWidths({ windowWidth: 1600, sidebar: 300, agent: 500, sidebarExpanded: true, agentOpen: true })).toEqual({ sidebar: 300, agent: 500 });
  });

  it('fits exactly at the floor, counting both card gutters', () => {
    expect(computeEffectiveWidths({ windowWidth: 980, sidebar: 224, agent: 340, sidebarExpanded: true, agentOpen: true })).toEqual({ sidebar: 224, agent: 340 });
  });

  it('narrows the agent panel first', () => {
    expect(computeEffectiveWidths({ windowWidth: 940, sidebar: 224, agent: 340, sidebarExpanded: true, agentOpen: true })).toEqual({ sidebar: 224, agent: 300 });
  });

  it('narrows the sidebar only once the agent panel is at its minimum', () => {
    expect(computeEffectiveWidths({ windowWidth: 880, sidebar: 224, agent: 340, sidebarExpanded: true, agentOpen: true })).toEqual({ sidebar: 184, agent: 280 });
  });

  it('lets the viewer go below its floor once both panels are at their minimums', () => {
    expect(computeEffectiveWidths({ windowWidth: 700, sidebar: 224, agent: 340, sidebarExpanded: true, agentOpen: true })).toEqual({ sidebar: 180, agent: 280 });
  });

  it('counts the rail, not the panel width, while the sidebar is collapsed', () => {
    expect(computeEffectiveWidths({ windowWidth: 800, sidebar: 224, agent: 340, sidebarExpanded: false, agentOpen: true })).toEqual({ sidebar: 180, agent: 340 });
  });

  it('resolves a closed agent panel as if open, without narrowing the sidebar for it', () => {
    expect(computeEffectiveWidths({ windowWidth: 880, sidebar: 224, agent: 340, sidebarExpanded: true, agentOpen: false })).toEqual({ sidebar: 224, agent: 280 });
  });

  it('clamps requested widths into their ranges', () => {
    expect(computeEffectiveWidths({ windowWidth: 1600, sidebar: 1000, agent: 10, sidebarExpanded: true, agentOpen: true })).toEqual({ sidebar: 420, agent: 280 });
  });
});

describe('resolveSidebarDrag', () => {
  it('snaps below 110', () => {
    expect(resolveSidebarDrag(109.9)).toEqual({ expanded: false });
  });

  it('holds at the minimum from 110 up to 180', () => {
    expect(resolveSidebarDrag(110)).toEqual({ expanded: true, width: 180 });
    expect(resolveSidebarDrag(150)).toEqual({ expanded: true, width: 180 });
  });

  it('follows the candidate, rounded, inside the range', () => {
    expect(resolveSidebarDrag(300.4)).toEqual({ expanded: true, width: 300 });
  });

  it('stops at the maximum', () => {
    expect(resolveSidebarDrag(500)).toEqual({ expanded: true, width: 420 });
  });
});

describe('resolveAgentDrag', () => {
  it('stops at the minimum', () => {
    expect(resolveAgentDrag(100)).toBe(280);
  });

  it('follows the candidate, rounded', () => {
    expect(resolveAgentDrag(440.6)).toBe(441);
  });

  it('stops at the maximum', () => {
    expect(resolveAgentDrag(900)).toBe(640);
  });
});

describe('usePanelWidths', () => {
  it('returns the preferences when nothing constrains them', () => {
    useSettingsStore.setState({ settings: { ...BASE_SETTINGS, sidebarWidth: 300, agentWidth: 400 } });
    useAppStore.setState({ agentOpen: true });
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1600 });

    const { result } = renderHook(() => usePanelWidths());

    expect(result.current).toEqual({ sidebar: 300, agent: 400, dragging: null });
  });

  it('falls back to the defaults before the settings load', () => {
    const { result } = renderHook(() => usePanelWidths());
    expect(result.current).toEqual({ sidebar: SIDEBAR_DEFAULT_WIDTH, agent: AGENT_DEFAULT_WIDTH, dragging: null });
  });

  it('follows a live drag and names the dragged panel', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1600 });
    const { result } = renderHook(() => usePanelWidths());
    act(() => useAppStore.getState().setResizeDrag({ panel: 'sidebar', width: 350 }));
    expect(result.current).toEqual({ sidebar: 350, agent: AGENT_DEFAULT_WIDTH, dragging: 'sidebar' });
  });

  it('recomputes when the window narrows', () => {
    useAppStore.setState({ agentOpen: true });
    const { result } = renderHook(() => usePanelWidths());
    act(() => {
      Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 940 });
      window.dispatchEvent(new Event('resize'));
    });
    expect(result.current.agent).toBe(300);
  });

  it('returns the same object while nothing it reports changes', () => {
    const { result } = renderHook(() => usePanelWidths());
    const before = result.current;
    act(() => useAppStore.getState().setMode('command'));
    expect(result.current).toBe(before);
  });
});
