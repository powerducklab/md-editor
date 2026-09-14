// Global test setup.
//
// 1. Polyfill SVGAnimatedLength / SVGTransformList properties that jsdom
//    does not implement but markmap-view's d3-zoom and d3-interpolate
//    dependencies read at runtime (svg.width.baseVal, g.transform.baseVal).
//    Without this, markmap hydration throws unhandled "Cannot read properties
//    of undefined (reading 'baseVal')" errors during tests.
//
// 2. Clear d3/markmap timers after each test so the event loop exits cleanly.

import { afterEach, beforeAll, vi } from 'vitest';

function polyfillSvgAnimatedProperties(): void {
  if (typeof SVGSVGElement === 'undefined' || typeof SVGElement === 'undefined') {
    return;
  }

  const svgProto = SVGSVGElement.prototype as unknown as Record<string, unknown>;

  // SVGSVGElement.width / .height -> SVGAnimatedLength-like { baseVal, animVal }
  const makeLengthDescriptor = (attrName: string) => ({
    get(this: SVGElement) {
      const raw = this.getAttribute(attrName);
      const num = raw ? parseFloat(raw) : 0;
      const value = Number.isFinite(num) ? num : 0;
      const length = {
        value,
        valueAsString: raw || '0',
        valueInSpecifiedUnits: value,
        unitType: 1, // SVG_LENGTHTYPE_NUMBER
      };
      return { baseVal: length, animVal: length };
    },
    configurable: true,
  });

  const existingWidth = Object.getOwnPropertyDescriptor(svgProto, 'width');
  if (!existingWidth || !(existingWidth.get || existingWidth.value)) {
    Object.defineProperty(svgProto, 'width', makeLengthDescriptor('width'));
  }
  const existingHeight = Object.getOwnPropertyDescriptor(svgProto, 'height');
  if (!existingHeight || !(existingHeight.get || existingHeight.value)) {
    Object.defineProperty(svgProto, 'height', makeLengthDescriptor('height'));
  }

  // SVGSVGElement.viewBox -> SVGAnimatedRect-like { baseVal }
  const existingViewBox = Object.getOwnPropertyDescriptor(svgProto, 'viewBox');
  if (!existingViewBox || !(existingViewBox.get || existingViewBox.value)) {
    Object.defineProperty(svgProto, 'viewBox', {
      get(this: SVGElement) {
        const raw = this.getAttribute('viewBox');
        const parts = raw ? raw.split(/[\s,]+/).map(Number) : [0, 0, 0, 0];
        return {
          baseVal: {
            x: parts[0] ?? 0,
            y: parts[1] ?? 0,
            width: parts[2] ?? 0,
            height: parts[3] ?? 0,
          },
          animVal: {
            x: parts[0] ?? 0,
            y: parts[1] ?? 0,
            width: parts[2] ?? 0,
            height: parts[3] ?? 0,
          },
        };
      },
      configurable: true,
    });
  }

  // SVGElement.transform -> SVGTransformList-like { baseVal: { consolidate, numberOfItems, getItem } }
  const elementProto = SVGElement.prototype as unknown as Record<string, unknown>;
  const existingTransform = Object.getOwnPropertyDescriptor(elementProto, 'transform');
  if (!existingTransform || !(existingTransform.get || existingTransform.value)) {
    Object.defineProperty(elementProto, 'transform', {
      get(this: SVGElement) {
        const attr = this.getAttribute('transform') || '';
        const hasTransform = attr.length > 0;
        const identityMatrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
        const item = { type: 1, matrix: identityMatrix, angle: 0 };
        const list = {
          numberOfItems: hasTransform ? 1 : 0,
          getItem: () => item,
          consolidate: () => (hasTransform ? item : null),
        };
        return { baseVal: list, animVal: list };
      },
      configurable: true,
    });
  }
}

beforeAll(() => {
  polyfillSvgAnimatedProperties();
});

afterEach(() => {
  vi.clearAllTimers();
});
