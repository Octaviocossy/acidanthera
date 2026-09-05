import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { File, Icon } from './icon';

describe('Icon', () => {
  it('hides its SVG from assistive technology', () => {
    const { container } = render(<Icon icon={File} />);

    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('uses the acidanthera stroke width at the default size', () => {
    const { container } = render(<Icon icon={File} />);

    expect(container.querySelector('svg')).toHaveAttribute('stroke-width', '1.92');
  });

  it('adjusts the absolute stroke width for a smaller size', () => {
    const { container } = render(<Icon icon={File} size={12} />);

    expect(container.querySelector('svg')).toHaveAttribute('stroke-width', '2.4');
  });

  it('passes class names to the SVG', () => {
    const { container } = render(<Icon icon={File} className="opacity-65" />);

    expect(container.querySelector('svg')).toHaveClass('opacity-65');
  });
});
