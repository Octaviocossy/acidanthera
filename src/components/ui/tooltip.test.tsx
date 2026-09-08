import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Tooltip } from './tooltip';

describe('Tooltip', () => {
  afterEach(cleanup);

  it('renders its content under the tooltip role at the given position', () => {
    render(<Tooltip content="notes/a very long note name.md" left={40} top={12} />);

    const panel = screen.getByRole('tooltip');
    expect(panel).toHaveTextContent('notes/a very long note name.md');
    expect(panel).toHaveStyle({ left: '40px', top: '12px' });
  });

  it('renders composed content, so a caller supplies its own key hint', () => {
    render(
      <Tooltip
        content={
          <>
            <span>Find file</span>
            <kbd>Ctrl+wf</kbd>
          </>
        }
        left={0}
        top={0}
      />
    );

    expect(screen.getByRole('tooltip')).toHaveTextContent('Find fileCtrl+wf');
  });

  it('lays out but hides the measure frame, leaving it unpositioned', () => {
    render(<Tooltip content="measuring" left={40} top={12} hidden />);

    const panel = screen.getByRole('tooltip', { hidden: true });
    expect(panel).toHaveStyle({ visibility: 'hidden' });
    expect(panel.style.left).toBe('');
    expect(panel.style.top).toBe('');
  });
});
