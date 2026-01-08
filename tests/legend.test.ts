import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Legend } from '../src/lib/core/Legend';

describe('Legend', () => {
  let legend: Legend;
  let mockMap: any;

  beforeEach(() => {
    legend = new Legend({
      title: 'Test Legend',
      items: [
        { label: 'Item 1', color: '#ff0000' },
        { label: 'Item 2', color: '#00ff00' },
      ],
    });

    mockMap = {
      addControl: vi.fn(),
      removeControl: vi.fn(),
      hasControl: vi.fn().mockReturnValue(true),
    };
  });

  describe('constructor', () => {
    it('should create legend with default options', () => {
      const lg = new Legend();
      const state = lg.getState();
      expect(state.visible).toBe(true);
      expect(state.collapsed).toBe(false);
      expect(state.items).toEqual([]);
    });

    it('should create legend with custom options', () => {
      const state = legend.getState();
      expect(state.items.length).toBe(2);
      expect(state.items[0].label).toBe('Item 1');
    });
  });

  describe('onAdd', () => {
    it('should create and return container element', () => {
      const container = legend.onAdd(mockMap);
      expect(container).toBeInstanceOf(HTMLElement);
      expect(container.classList.contains('maplibregl-ctrl')).toBe(true);
      expect(container.classList.contains('maplibre-gl-legend')).toBe(true);
    });
  });

  describe('show/hide', () => {
    it('should show the legend', () => {
      const lg = new Legend({ visible: false });
      lg.onAdd(mockMap);

      expect(lg.getState().visible).toBe(false);
      lg.show();
      expect(lg.getState().visible).toBe(true);
    });

    it('should hide the legend', () => {
      legend.onAdd(mockMap);

      expect(legend.getState().visible).toBe(true);
      legend.hide();
      expect(legend.getState().visible).toBe(false);
    });
  });

  describe('collapse/expand', () => {
    it('should collapse the legend', () => {
      legend.onAdd(mockMap);

      expect(legend.getState().collapsed).toBe(false);
      legend.collapse();
      expect(legend.getState().collapsed).toBe(true);
    });

    it('should expand the legend', () => {
      const lg = new Legend({ collapsed: true });
      lg.onAdd(mockMap);

      expect(lg.getState().collapsed).toBe(true);
      lg.expand();
      expect(lg.getState().collapsed).toBe(false);
    });

    it('should toggle the legend', () => {
      legend.onAdd(mockMap);

      expect(legend.getState().collapsed).toBe(false);
      legend.toggle();
      expect(legend.getState().collapsed).toBe(true);
      legend.toggle();
      expect(legend.getState().collapsed).toBe(false);
    });
  });

  describe('setItems', () => {
    it('should replace all items', () => {
      legend.onAdd(mockMap);

      legend.setItems([
        { label: 'New Item', color: '#0000ff' },
      ]);

      const state = legend.getState();
      expect(state.items.length).toBe(1);
      expect(state.items[0].label).toBe('New Item');
    });
  });

  describe('addItem', () => {
    it('should add a new item', () => {
      legend.onAdd(mockMap);

      legend.addItem({ label: 'Item 3', color: '#0000ff' });

      const state = legend.getState();
      expect(state.items.length).toBe(3);
      expect(state.items[2].label).toBe('Item 3');
    });
  });

  describe('removeItem', () => {
    it('should remove an item by label', () => {
      legend.onAdd(mockMap);

      legend.removeItem('Item 1');

      const state = legend.getState();
      expect(state.items.length).toBe(1);
      expect(state.items[0].label).toBe('Item 2');
    });
  });

  describe('events', () => {
    it('should register and trigger event handlers', () => {
      const handler = vi.fn();
      legend.on('collapse', handler);
      legend.onAdd(mockMap);

      legend.collapse();

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'collapse',
          state: expect.objectContaining({ collapsed: true }),
        })
      );
    });
  });
});
