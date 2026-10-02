/**
 * Keeps the place in the table of nutrients while a nutrient's own page is open, so "All nutrients"
 * comes back where it was left. The page being left saves its scroll, and only the way back from a
 * nutrient's page arms the restore, so a later visit from elsewhere starts at the top as usual.
 */
const KEY = 'fitsync.nutrients.scroll';

interface Saved {
  period: string;
  y: number;
  armed: boolean;
}

function read(): Saved | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

function write(value: Saved | null): void {
  try {
    if (value) {
      sessionStorage.setItem(KEY, JSON.stringify(value));
    } else {
      sessionStorage.removeItem(KEY);
    }
  } catch {
    // Storage can be blocked; the table then simply opens at the top.
  }
}

export function saveScroll(period: string, y: number): void {
  write({ period, y, armed: false });
}

/** Called by the way back from a nutrient's page. */
export function armScrollRestore(): void {
  const saved = read();
  if (saved) {
    write({ ...saved, armed: true });
  }
}

/** The saved scroll for this period if the way back armed it; either way the entry is used up. */
export function takeScroll(period: string): number | null {
  const saved = read();
  write(null);
  return saved && saved.armed && saved.period === period && Number.isFinite(saved.y) ? saved.y : null;
}
