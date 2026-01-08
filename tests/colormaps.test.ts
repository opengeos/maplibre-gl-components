import { describe, it, expect } from 'vitest';
import {
  getColormap,
  isValidColormap,
  getColormapNames,
  COLORMAPS,
  viridis,
  plasma,
  jet,
  terrain,
} from '../src/lib/colormaps';

describe('Colormaps', () => {
  describe('getColormap', () => {
    it('should return viridis colormap', () => {
      const colormap = getColormap('viridis');
      expect(colormap).toBe(viridis);
      expect(colormap.length).toBeGreaterThan(0);
    });

    it('should return plasma colormap', () => {
      const colormap = getColormap('plasma');
      expect(colormap).toBe(plasma);
    });

    it('should return jet colormap', () => {
      const colormap = getColormap('jet');
      expect(colormap).toBe(jet);
    });

    it('should return terrain colormap', () => {
      const colormap = getColormap('terrain');
      expect(colormap).toBe(terrain);
    });

    it('should return viridis for invalid colormap name', () => {
      // @ts-expect-error Testing invalid input
      const colormap = getColormap('invalid');
      expect(colormap).toBe(viridis);
    });
  });

  describe('isValidColormap', () => {
    it('should return true for valid colormap names', () => {
      expect(isValidColormap('viridis')).toBe(true);
      expect(isValidColormap('plasma')).toBe(true);
      expect(isValidColormap('jet')).toBe(true);
      expect(isValidColormap('terrain')).toBe(true);
      expect(isValidColormap('coolwarm')).toBe(true);
    });

    it('should return false for invalid colormap names', () => {
      expect(isValidColormap('invalid')).toBe(false);
      expect(isValidColormap('')).toBe(false);
      expect(isValidColormap('VIRIDIS')).toBe(false);
    });
  });

  describe('getColormapNames', () => {
    it('should return all colormap names', () => {
      const names = getColormapNames();
      expect(names).toContain('viridis');
      expect(names).toContain('plasma');
      expect(names).toContain('jet');
      expect(names).toContain('terrain');
      expect(names).toContain('coolwarm');
      expect(names.length).toBe(Object.keys(COLORMAPS).length);
    });
  });

  describe('COLORMAPS', () => {
    it('should have valid color stops for all colormaps', () => {
      for (const [name, stops] of Object.entries(COLORMAPS)) {
        expect(stops.length).toBeGreaterThan(0);

        // Check first and last positions
        expect(stops[0].position).toBe(0);
        expect(stops[stops.length - 1].position).toBe(1);

        // Check that all colors are valid hex colors
        for (const stop of stops) {
          expect(stop.color).toMatch(/^#[0-9a-fA-F]{6}$/);
          expect(stop.position).toBeGreaterThanOrEqual(0);
          expect(stop.position).toBeLessThanOrEqual(1);
        }
      }
    });
  });
});
