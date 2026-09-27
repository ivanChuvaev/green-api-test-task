import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeAll } from 'vitest'

beforeAll(() => {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
})

afterEach(() => {
  cleanup()
})

Element.prototype.scrollIntoView = function scrollIntoView() {}

const VIEWPORT = { width: 800, height: 600 }
const ROW_HEIGHT = 68

class ResizeObserverStub implements ResizeObserver {
  private callback: ResizeObserverCallback

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
  }

  observe(target: Element) {
    const box = target.hasAttribute('data-index') ? { ...VIEWPORT, height: ROW_HEIGHT } : VIEWPORT

    this.callback(
      [
        {
          target,
          contentRect: new DOMRect(0, 0, box.width, box.height),
          borderBoxSize: [{ inlineSize: box.width, blockSize: box.height }],
          contentBoxSize: [{ inlineSize: box.width, blockSize: box.height }],
          devicePixelContentBoxSize: [{ inlineSize: box.width, blockSize: box.height }],
        } as ResizeObserverEntry,
      ],
      this,
    )
  }

  unobserve() {}
  disconnect() {}
}

window.ResizeObserver = ResizeObserverStub

const emptyRect = () => new DOMRect()
Range.prototype.getClientRects = function getClientRects() {
  return [] as unknown as DOMRectList
}
Range.prototype.getBoundingClientRect = function getBoundingClientRect() {
  return emptyRect()
}

document.elementFromPoint = () => null
