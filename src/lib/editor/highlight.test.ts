import { tags } from '@lezer/highlight';
import { describe, expect, it } from 'vitest';
import { acidantheraHighlightStyle } from './highlight';
import { fenceContentTag } from './markdown-parser';

describe('acidantheraHighlightStyle', () => {
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
      fenceContentTag,
    ];

    for (const tag of highlightedTags) {
      expect(acidantheraHighlightStyle.style([tag])).toBeTruthy();
    }
  });

  it('resolves every syntax-palette tag the fence language registry can emit (invariant 59)', () => {
    const syntaxTags = [
      tags.keyword,
      tags.string,
      tags.special(tags.string),
      tags.number,
      tags.atom,
      tags.comment,
      tags.definition(tags.variableName),
      tags.typeName,
      tags.standard(tags.variableName),
      tags.meta,
    ];

    for (const tag of syntaxTags) {
      expect(acidantheraHighlightStyle.style([tag])).toBeTruthy();
    }
  });

  it('leaves punctuation, operators and plain identifiers off the syntax palette (spec decision 5)', () => {
    expect(acidantheraHighlightStyle.style([tags.operator])).toBeFalsy();
    expect(acidantheraHighlightStyle.style([tags.punctuation])).toBeFalsy();
    expect(acidantheraHighlightStyle.style([tags.variableName])).toBeFalsy();
  });

  it('gives the inline-code chip to tags.monospace alone, not to fenced content', () => {
    const chip = acidantheraHighlightStyle.style([tags.monospace]);
    const fenced = acidantheraHighlightStyle.style([fenceContentTag]);

    expect(chip).toBeTruthy();
    expect(fenced).toBeTruthy();
    expect(fenced).not.toBe(chip);
  });
});
