/**
 * Reports the width of an element now and whenever it changes, so a hand-drawn chart can be drawn
 * at the size it is shown at. Returns the function that stops watching.
 */
export function observeWidth(element: HTMLElement, onWidth: (width: number) => void): () => void {
  const measure = (): void => {
    if (element.clientWidth > 0) {
      onWidth(Math.round(element.clientWidth));
    }
  };
  measure();
  if (typeof ResizeObserver === 'undefined') {
    return () => undefined;
  }
  const observer = new ResizeObserver(measure);
  observer.observe(element);
  return () => observer.disconnect();
}
