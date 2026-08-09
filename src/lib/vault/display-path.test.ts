import { describe, expect, it } from 'vitest';
import { displayPath } from './display-path';

describe('displayPath', () => {
  it('collapses a macOS home path', () => {
    expect(displayPath('/Users/x/Documents/brain')).toBe('~/Documents/brain');
  });

  it('collapses a Linux home path', () => {
    expect(displayPath('/home/x/notes')).toBe('~/notes');
  });

  it('leaves a path outside a home directory unchanged', () => {
    expect(displayPath('/opt/data')).toBe('/opt/data');
  });

  it('collapses a home directory itself', () => {
    expect(displayPath('/Users/x')).toBe('~');
  });
});
