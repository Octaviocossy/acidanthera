import { describe, expect, it } from 'vitest';
import { enterTransition, exitTransition } from '@/lib/motion/tokens';
import { PANEL_CLOSE, PANEL_OPEN, PANEL_SECONDS, panelTransition } from './panel-motion';

describe('panelTransition', () => {
  it('opens on the enter transition of the slow step', () => {
    expect(panelTransition('open', false)).toEqual(enterTransition('slow'));
  });

  it('closes on the exit transition of the slow step', () => {
    expect(panelTransition('close', false)).toEqual(exitTransition('slow'));
  });

  it('is instant for either gesture when asked', () => {
    expect(panelTransition('open', true)).toEqual({ duration: 0 });
    expect(panelTransition('close', true)).toEqual({ duration: 0 });
  });
});

describe('PANEL_SECONDS', () => {
  it("matches the length of each gesture's transition", () => {
    expect(PANEL_SECONDS.open).toBe((PANEL_OPEN as { duration: number }).duration);
    expect(PANEL_SECONDS.close).toBe((PANEL_CLOSE as { duration: number }).duration);
  });
});
