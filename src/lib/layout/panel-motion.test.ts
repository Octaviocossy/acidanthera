import { describe, expect, it } from 'vitest';
import { enterTransition, exitTransition } from '@/lib/motion/tokens';
import { panelTransition } from './panel-motion';

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
