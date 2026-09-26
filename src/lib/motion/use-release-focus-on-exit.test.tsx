import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AnimatePresence, motion } from 'motion/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { useExitPhase } from '@/lib/motion/use-exit-phase';
import { useReleaseFocusOnExit } from '@/lib/motion/use-release-focus-on-exit';

function Leaving() {
  const { exiting, exitPhaseProps } = useExitPhase();
  const ref = useRef<HTMLDivElement>(null);
  useReleaseFocusOnExit(ref, exiting);
  return (
    <motion.div ref={ref} initial={false} animate={{ opacity: 1 }} exit={{ opacity: 0 }} {...exitPhaseProps}>
      <input aria-label="Leaving input" />
    </motion.div>
  );
}

function Harness({ show }: { show: boolean }) {
  return (
    <>
      <AnimatePresence initial={false}>{show && <Leaving />}</AnimatePresence>
      <input aria-label="Outside input" />
    </>
  );
}

afterEach(cleanup);

describe('useReleaseFocusOnExit', () => {
  it('blurs a focused input in the same commit that begins its exit', async () => {
    const { rerender } = render(<Harness show />);
    await userEvent.setup().click(screen.getByRole('textbox', { name: 'Leaving input' }));
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Leaving input' }));

    rerender(<Harness show={false} />);

    expect(screen.getByRole('textbox', { name: 'Leaving input' })).toBeInTheDocument();
    expect(document.activeElement).not.toBe(screen.getByRole('textbox', { name: 'Leaving input' }));
  });

  it('leaves focus alone when it sits outside the leaving element', async () => {
    const { rerender } = render(<Harness show />);
    await userEvent.setup().click(screen.getByRole('textbox', { name: 'Outside input' }));
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Outside input' }));

    rerender(<Harness show={false} />);

    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Outside input' }));
  });
});
