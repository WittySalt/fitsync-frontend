const STORAGE_KEY = 'fs-auto-closed-dismissed';
/** Only the newest dismissals are kept, so the stored list cannot grow without bound. */
const MAX_REMEMBERED = 20;

function readDismissedIds(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

/** Whether the person has dismissed the note about this automatically closed workout. */
export function isAutoClosedDismissed(sessionId: string): boolean {
  return readDismissedIds().includes(sessionId);
}

/** Remembers the dismissal by session id, in this browser only. A blocked store just forgets it. */
export function dismissAutoClosed(sessionId: string): void {
  try {
    const ids = readDismissedIds().filter((id) => id !== sessionId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids, sessionId].slice(-MAX_REMEMBERED)));
  } catch {
    // Without storage the note comes back on the next visit, which is harmless.
  }
}
