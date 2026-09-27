import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { AnimatePresence, motion } from 'motion/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useExitPhase } from './use-exit-phase';
import { overlayPresence, risingPanelVariants } from './variants';

function Probe() {
  const { exiting, exitPhaseProps } = useExitPhase();
  return (
    <motion.div data-testid="probe" data-exiting={exiting} variants={risingPanelVariants} {...overlayPresence} {...exitPhaseProps}>
      inside
    </motion.div>
  );
}

function Host({ open }: { open: boolean }) {
  return <AnimatePresence>{open && <Probe />}</AnimatePresence>;
}

describe('useExitPhase', () => {
  afterEach(cleanup);

  it('leaves an entering element interactive from its first frame', () => {
    render(<Host open={true} />);
    const probe = screen.getByTestId('probe');
    expect(probe).toHaveAttribute('data-exiting', 'false');
    expect(probe).not.toHaveAttribute('inert');
    expect(probe.style.pointerEvents).toBe('');
  });

  it('makes a leaving element inert in the same act as the close', () => {
    const { rerender } = render(<Host open={true} />);
    act(() => rerender(<Host open={false} />));
    const probe = screen.getByTestId('probe');
    expect(probe).toHaveAttribute('data-exiting', 'true');
    expect(probe).toHaveAttribute('inert');
    expect(probe.style.pointerEvents).toBe('none');
  });

  it('unmounts the element once its exit phase ends', async () => {
    const { rerender } = render(<Host open={true} />);
    act(() => rerender(<Host open={false} />));
    await waitFor(() => expect(screen.queryByTestId('probe')).toBeNull());
  });

  it('never reports an exit phase outside AnimatePresence', () => {
    render(<Probe />);
    expect(screen.getByTestId('probe')).toHaveAttribute('data-exiting', 'false');
  });
});
