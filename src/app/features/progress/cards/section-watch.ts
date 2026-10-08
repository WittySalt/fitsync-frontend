import { SECTIONS, SectionId, currentSection } from './page-head';

export interface WatchHandlers {
  onSection: (id: SectionId) => void;
  onAnswerOut: (out: boolean) => void;
}

type ObserverFactory = (callback: IntersectionObserverCallback, options: IntersectionObserverInit) => Pick<IntersectionObserver, 'observe' | 'disconnect'>;

/** The reading line, as a share of the window height from its top: a section whose top has passed it is being read. */
const READING_LINE = 0.35;

/**
 * Watches the page with IntersectionObservers: which of the three cards is being read, and whether
 * the answer block has scrolled out of the window. Nothing is written to the address bar.
 * Returns a function that stops watching.
 */
export function watchSections(
  root: Document,
  answer: Element | null,
  handlers: WatchHandlers,
  make: ObserverFactory = (callback, options) => new IntersectionObserver(callback, options)
): () => void {
  const sections = SECTIONS.map((section) => ({ id: section.id, element: root.getElementById(`progress-${section.id}`) })).filter(
    (item): item is { id: SectionId; element: HTMLElement } => item.element !== null
  );
  const view = root.defaultView;
  const line = (): number => (view?.innerHeight ?? 800) * READING_LINE;

  const sectionObserver = make(
    () => handlers.onSection(currentSection(sections.map((item) => ({ id: item.id, top: item.element.getBoundingClientRect().top })), line())),
    { threshold: [0, 0.25, 0.5, 0.75, 1] }
  );
  sections.forEach((item) => sectionObserver.observe(item.element));

  const answerObserver = make(
    (entries) => {
      const entry = entries[entries.length - 1];
      if (entry) {
        handlers.onAnswerOut(!entry.isIntersecting && entry.boundingClientRect.bottom < 0);
      }
    },
    { threshold: [0] }
  );
  if (answer) {
    answerObserver.observe(answer);
  }
  return () => {
    sectionObserver.disconnect();
    answerObserver.disconnect();
  };
}
