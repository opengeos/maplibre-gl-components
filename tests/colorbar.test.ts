import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Colorbar } from '../src/lib/core/Colorbar';

describe('Colorbar', () => {
  let colorbar: Colorbar;
  let mockMap: any;

  beforeEach(() => {
    colorbar = new Colorbar({
      colormap: 'viridis',
      vmin: 0,
      vmax: 100,
      label: 'Test',
    });

    mockMap = {
      addControl: vi.fn(),
      removeControl: vi.fn(),
      hasControl: vi.fn().mockReturnValue(true),
      on: vi.fn(),
      off: vi.fn(),
      getZoom: vi.fn().mockReturnValue(10),
    };
  });

  describe('constructor', () => {
    it('should create colorbar with default options', () => {
      const cb = new Colorbar();
      const state = cb.getState();
      expect(state.visible).toBe(true);
      expect(state.vmin).toBe(0);
      expect(state.vmax).toBe(1);
      expect(state.colormap).toBe('viridis');
    });

    it('should create colorbar with custom options', () => {
      const state = colorbar.getState();
      expect(state.vmin).toBe(0);
      expect(state.vmax).toBe(100);
      expect(state.colormap).toBe('viridis');
    });
  });

  describe('onAdd', () => {
    it('should create and return container element', () => {
      const container = colorbar.onAdd(mockMap);
      expect(container).toBeInstanceOf(HTMLElement);
      expect(container.classList.contains('maplibregl-ctrl')).toBe(true);
      expect(container.classList.contains('maplibre-gl-colorbar')).toBe(true);
    });
  });

  describe('onRemove', () => {
    it('should remove container from DOM', () => {
      const container = colorbar.onAdd(mockMap);
      const parent = document.createElement('div');
      parent.appendChild(container);

      colorbar.onRemove();
      expect(parent.children.length).toBe(0);
    });
  });

  describe('show/hide', () => {
    it('should show the colorbar', () => {
      const cb = new Colorbar({ visible: false });
      cb.onAdd(mockMap);

      expect(cb.getState().visible).toBe(false);
      cb.show();
      expect(cb.getState().visible).toBe(true);
    });

    it('should hide the colorbar', () => {
      colorbar.onAdd(mockMap);

      expect(colorbar.getState().visible).toBe(true);
      colorbar.hide();
      expect(colorbar.getState().visible).toBe(false);
    });
  });

  describe('update', () => {
    it('should update colorbar options', () => {
      colorbar.onAdd(mockMap);

      colorbar.update({
        colormap: 'plasma',
        vmin: -10,
        vmax: 50,
      });

      const state = colorbar.getState();
      expect(state.colormap).toBe('plasma');
      expect(state.vmin).toBe(-10);
      expect(state.vmax).toBe(50);
    });
  });

  describe('events', () => {
    it('should register and trigger event handlers', () => {
      const handler = vi.fn();
      colorbar.on('update', handler);
      colorbar.onAdd(mockMap);

      colorbar.update({ vmin: 10 });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'update',
          state: expect.objectContaining({ vmin: 10 }),
        })
      );
    });

    it('should remove event handlers', () => {
      const handler = vi.fn();
      colorbar.on('update', handler);
      colorbar.off('update', handler);
      colorbar.onAdd(mockMap);

      colorbar.update({ vmin: 10 });

      expect(handler).not.toHaveBeenCalled();
    });
  });
});
