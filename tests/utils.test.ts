import { describe, it, expect } from 'vitest';
import {
  clamp,
  formatNumericValue,
  generateId,
  classNames,
  hexToRgb,
  rgbToHex,
  interpolateColor,
  getColorAtPosition,
  generateGradientCSS,
} from '../src/lib/utils';

describe('Utility Functions', () => {
  describe('clamp', () => {
    it('should clamp value to range', () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-5, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
    });
  });

  describe('formatNumericValue', () => {
    it('should format based on range', () => {
      expect(formatNumericValue(100, 1000)).toBe('100');
      expect(formatNumericValue(1.5, 10)).toBe('1.5');
      expect(formatNumericValue(0.15, 0.5)).toBe('0.15');
      expect(formatNumericValue(0.015, 0.05)).toBe('0.015');
    });
  });

  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^mlgl-/);
    });

    it('should use custom prefix', () => {
      const id = generateId('custom');
      expect(id).toMatch(/^custom-/);
    });
  });

  describe('classNames', () => {
    it('should join class names', () => {
      expect(classNames('a', 'b', 'c')).toBe('a b c');
    });

    it('should filter falsy values', () => {
      expect(classNames('a', null, undefined, false, 'b')).toBe('a b');
    });
  });

  describe('hexToRgb', () => {
    it('should convert hex to RGB', () => {
      expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
      expect(hexToRgb('#00ff00')).toEqual({ r: 0, g: 255, b: 0 });
      expect(hexToRgb('#0000ff')).toEqual({ r: 0, g: 0, b: 255 });
      expect(hexToRgb('#ffffff')).toEqual({ r: 255, g: 255, b: 255 });
    });

    it('should handle hex without #', () => {
      expect(hexToRgb('ff0000')).toEqual({ r: 255, g: 0, b: 0 });
    });

    it('should return null for invalid hex', () => {
      expect(hexToRgb('invalid')).toBeNull();
    });
  });

  describe('rgbToHex', () => {
    it('should convert RGB to hex', () => {
      expect(rgbToHex(255, 0, 0)).toBe('#ff0000');
      expect(rgbToHex(0, 255, 0)).toBe('#00ff00');
      expect(rgbToHex(0, 0, 255)).toBe('#0000ff');
      expect(rgbToHex(255, 255, 255)).toBe('#ffffff');
    });
  });

  describe('interpolateColor', () => {
    it('should interpolate between colors', () => {
      const result = interpolateColor('#000000', '#ffffff', 0.5);
      expect(result).toBe('#808080');
    });

    it('should return first color at factor 0', () => {
      const result = interpolateColor('#ff0000', '#0000ff', 0);
      expect(result).toBe('#ff0000');
    });

    it('should return second color at factor 1', () => {
      const result = interpolateColor('#ff0000', '#0000ff', 1);
      expect(result).toBe('#0000ff');
    });
  });

  describe('getColorAtPosition', () => {
    const stops = [
      { position: 0, color: '#000000' },
      { position: 0.5, color: '#808080' },
      { position: 1, color: '#ffffff' },
    ];

    it('should return color at exact stop positions', () => {
      expect(getColorAtPosition(stops, 0)).toBe('#000000');
      expect(getColorAtPosition(stops, 0.5)).toBe('#808080');
      expect(getColorAtPosition(stops, 1)).toBe('#ffffff');
    });

    it('should interpolate between stops', () => {
      const result = getColorAtPosition(stops, 0.25);
      expect(result).toBe('#404040');
    });

    it('should clamp to valid range', () => {
      expect(getColorAtPosition(stops, -0.5)).toBe('#000000');
      expect(getColorAtPosition(stops, 1.5)).toBe('#ffffff');
    });
  });

  describe('generateGradientCSS', () => {
    it('should generate CSS gradient', () => {
      const stops = [
        { position: 0, color: '#000000' },
        { position: 1, color: '#ffffff' },
      ];

      const result = generateGradientCSS(stops);
      expect(result).toBe('linear-gradient(to right, #000000 0%, #ffffff 100%)');
    });

    it('should use custom direction', () => {
      const stops = [
        { position: 0, color: '#000000' },
        { position: 1, color: '#ffffff' },
      ];

      const result = generateGradientCSS(stops, 'to top');
      expect(result).toBe('linear-gradient(to top, #000000 0%, #ffffff 100%)');
    });
  });
});
