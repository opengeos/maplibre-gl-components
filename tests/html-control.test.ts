import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HtmlControl } from '../src/lib/core/HtmlControl';

describe('HtmlControl', () => {
  let control: HtmlControl;
  let mockMap: any;

  beforeEach(() => {
    control = new HtmlControl({
      html: '<div>Test content</div>',
    });

    mockMap = {
      addControl: vi.fn(),
      removeControl: vi.fn(),
      hasControl: vi.fn().mockReturnValue(true),
    };
  });

  describe('constructor', () => {
    it('should create control with default options', () => {
      const ctrl = new HtmlControl();
      const state = ctrl.getState();
      expect(state.visible).toBe(true);
      expect(state.html).toBe('');
    });

    it('should create control with custom HTML', () => {
      const state = control.getState();
      expect(state.html).toBe('<div>Test content</div>');
    });
  });

  describe('onAdd', () => {
    it('should create and return container element', () => {
      const container = control.onAdd(mockMap);
      expect(container).toBeInstanceOf(HTMLElement);
      expect(container.classList.contains('maplibregl-ctrl')).toBe(true);
      expect(container.classList.contains('maplibre-gl-html-control')).toBe(true);
    });

    it('should render HTML content', () => {
      const container = control.onAdd(mockMap);
      expect(container.innerHTML).toContain('Test content');
    });
  });

  describe('show/hide', () => {
    it('should show the control', () => {
      const ctrl = new HtmlControl({ visible: false });
      ctrl.onAdd(mockMap);

      expect(ctrl.getState().visible).toBe(false);
      ctrl.show();
      expect(ctrl.getState().visible).toBe(true);
    });

    it('should hide the control', () => {
      control.onAdd(mockMap);

      expect(control.getState().visible).toBe(true);
      control.hide();
      expect(control.getState().visible).toBe(false);
    });
  });

  describe('setHtml', () => {
    it('should update HTML content', () => {
      control.onAdd(mockMap);

      control.setHtml('<div>New content</div>');

      const state = control.getState();
      expect(state.html).toBe('<div>New content</div>');

      const element = control.getElement();
      expect(element?.innerHTML).toBe('<div>New content</div>');
    });
  });

  describe('setElement', () => {
    it('should set DOM element as content', () => {
      control.onAdd(mockMap);

      const el = document.createElement('span');
      el.textContent = 'Element content';
      control.setElement(el);

      const element = control.getElement();
      expect(element?.children[0]).toBe(el);
    });
  });

  describe('getElement', () => {
    it('should return content container', () => {
      control.onAdd(mockMap);

      const element = control.getElement();
      expect(element).toBeInstanceOf(HTMLElement);
      expect(element?.classList.contains('maplibre-gl-html-control-content')).toBe(true);
    });

    it('should return undefined before adding to map', () => {
      const element = control.getElement();
      expect(element).toBeUndefined();
    });
  });

  describe('events', () => {
    it('should register and trigger event handlers', () => {
      const handler = vi.fn();
      control.on('update', handler);
      control.onAdd(mockMap);

      control.setHtml('<div>Updated</div>');

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'update',
        })
      );
    });
  });
});
