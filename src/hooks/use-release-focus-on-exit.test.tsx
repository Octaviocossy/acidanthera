import { cleanup, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { useReleaseFocusOnExit } from './use-release-focus-on-exit';

function Harness({ exiting }: { exiting: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useReleaseFocusOnExit(ref, exiting);
  return (
    <>
      <div ref={ref}>
        <input aria-label="inside" />
      </div>
      <input aria-label="outside" />
    </>
  );
}

describe('useReleaseFocusOnExit', () => {
  afterEach(cleanup);

  it('blurs a focused descendant when the exit phase begins', () => {
    const { rerender } = render(<Harness exiting={false} />);
    screen.getByRole('textbox', { name: 'inside' }).focus();
    rerender(<Harness exiting={true} />);
    expect(document.activeElement).toBe(document.body);
  });

  it('leaves focus that is already elsewhere alone', () => {
    const { rerender } = render(<Harness exiting={false} />);
    const outside = screen.getByRole('textbox', { name: 'outside' });
    outside.focus();
    rerender(<Harness exiting={true} />);
    expect(outside).toHaveFocus();
  });

  it('keeps focus while the element is present', () => {
    const { rerender } = render(<Harness exiting={false} />);
    const inside = screen.getByRole('textbox', { name: 'inside' });
    inside.focus();
    rerender(<Harness exiting={false} />);
    expect(inside).toHaveFocus();
  });
});
