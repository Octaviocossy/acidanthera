import { tags } from '@lezer/highlight';
import { describe, expect, it } from 'vitest';
import { orbitHighlightStyle } from './highlight';

describe('orbitHighlightStyle', () => {
  it('resolves every markdown treatment to a token-backed class', () => {
    const highlightedTags = [
      tags.heading1,
      tags.heading2,
      tags.heading3,
      tags.heading4,
      tags.heading5,
      tags.heading6,
      tags.strong,
      tags.emphasis,
      tags.strikethrough,
      tags.monospace,
      tags.literal,
      tags.link,
      tags.url,
      tags.quote,
      tags.list,
      tags.processingInstruction,
    ];

    for (const tag of highlightedTags) {
      expect(orbitHighlightStyle.style([tag])).toBeTruthy();
    }
  });
});
