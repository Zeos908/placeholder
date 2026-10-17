/**
 * jsdom has no IntersectionObserver. This stand-in records observed elements so tests can
 * say "this element scrolled into view" with intersect(el).
 */
type Callback = IntersectionObserverCallback;

const observers = new Set<MockIntersectionObserver>();

export class MockIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "0px";
  readonly thresholds = [0];
  readonly scrollMargin = "0px";
  elements = new Set<Element>();
  constructor(private cb: Callback) {
    observers.add(this);
  }
  observe(el: Element) {
    this.elements.add(el);
  }
  unobserve(el: Element) {
    this.elements.delete(el);
  }
  disconnect() {
    this.elements.clear();
    observers.delete(this);
  }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
  fire(el: Element, isIntersecting: boolean, ratio = isIntersecting ? 1 : 0) {
    const rect = { top: 100, bottom: 400, left: 0, right: 390, width: 390, height: 300, x: 0, y: 100 } as DOMRectReadOnly;
    this.cb(
      [
        {
          target: el,
          isIntersecting,
          intersectionRatio: ratio,
          boundingClientRect: rect,
          intersectionRect: rect,
          rootBounds: { top: 0, bottom: 844, left: 0, right: 390, width: 390, height: 844, x: 0, y: 0 } as DOMRectReadOnly,
          time: Date.now(),
        },
      ],
      this,
    );
  }
}

/** Reports `el` as on screen (or off) to every observer watching it. */
export function intersect(el: Element, isIntersecting = true) {
  for (const o of observers) if (o.elements.has(el)) o.fire(el, isIntersecting);
}

export function installIntersectionObserver() {
  globalThis.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;
}
