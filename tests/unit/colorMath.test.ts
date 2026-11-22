import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  hasOpaqueColor,
  parseColor,
  relativeLuminance,
  toHexColor,
} from '../../src/utils/colorMath.ts';

describe('parseColor', () => {
  it('parses shorthand and full hex colors', () => {
    expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColor('#0f08')).toEqual({ r: 0, g: 255, b: 0, a: 136 / 255 });
    expect(parseColor('#1e293b')).toEqual({ r: 30, g: 41, b: 59, a: 1 });
    expect(parseColor('#1e293b80')?.a).toBeCloseTo(128 / 255);
  });

  it('parses named, rgb, rgba, and hsl colors', () => {
    expect(parseColor('white')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColor('rebeccapurple')).toEqual({ r: 102, g: 51, b: 153, a: 1 });
    expect(parseColor('rgb(30, 41, 59)')).toEqual({ r: 30, g: 41, b: 59, a: 1 });
    expect(parseColor('rgb(30 41 59 / 50%)')).toEqual({ r: 30, g: 41, b: 59, a: 0.5 });
    expect(parseColor('hsl(0, 100%, 50%)')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
  });

  it('handles !important and rejects unresolved or invalid values', () => {
    expect(parseColor('  #ffffff !important ')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColor('var(--brand)')).toBeNull();
    expect(parseColor('')).toBeNull();
    expect(parseColor(undefined)).toBeNull();
    expect(parseColor('#12')).toBeNull();
    expect(parseColor('rgb(1, 2)')).toBeNull();
    expect(parseColor('not-a-color')).toBeNull();
  });

  it('clamps out-of-range alpha and channel values', () => {
    expect(parseColor('rgba(300, -20, 0, 2)')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    expect(parseColor('rgba(0, 0, 0, -1)')?.a).toBe(0);
  });
});

describe('relativeLuminance', () => {
  it('returns the WCAG anchors for black and white', () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0, a: 1 })).toBe(0);
    expect(relativeLuminance({ r: 255, g: 255, b: 255, a: 1 })).toBeCloseTo(1);
  });

  it('weights green more than red and blue', () => {
    const red = relativeLuminance({ r: 255, g: 0, b: 0, a: 1 });
    const green = relativeLuminance({ r: 0, g: 255, b: 0, a: 1 });
    const blue = relativeLuminance({ r: 0, g: 0, b: 255, a: 1 });
    expect(green).toBeGreaterThan(red);
    expect(red).toBeGreaterThan(blue);
  });
});

describe('contrastRatio', () => {
  it('returns 21:1 for black on white and 1:1 for identical colors', () => {
    expect(contrastRatio('#000', '#fff')).toBeCloseTo(21);
    expect(contrastRatio('#777', '#777')).toBeCloseTo(1);
  });

  it('composites translucent foreground and background colors', () => {
    const ratio = contrastRatio('rgba(0, 0, 0, 0.5)', '#fff');
    expect(ratio).not.toBeNull();
    expect(ratio!).toBeGreaterThan(3);
    expect(ratio!).toBeLessThan(5);
  });

  it('returns null when either color cannot be parsed', () => {
    expect(contrastRatio('var(--fg)', '#fff')).toBeNull();
    expect(contrastRatio('#000', 'nope')).toBeNull();
  });
});

describe('color helpers', () => {
  it('detects colors with a visible alpha channel', () => {
    expect(hasOpaqueColor('#000')).toBe(true);
    expect(hasOpaqueColor('rgba(0, 0, 0, 0)')).toBe(false);
    expect(hasOpaqueColor('var(--fg)')).toBe(false);
  });

  it('canonicalizes colors to uppercase hex', () => {
    expect(toHexColor('rgb(30, 41, 59)')).toBe('#1E293B');
    expect(toHexColor('white')).toBe('#FFFFFF');
    expect(toHexColor('rgba(0, 0, 0, 0.5)')).toBe('#00000080');
    expect(toHexColor('not-a-color')).toBeNull();
  });
});
