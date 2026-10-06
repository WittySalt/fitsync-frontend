export type UserRole = 'USER' | 'ADMIN';

/**
 * Maps a role value to the two roles the UI distinguishes. A missing or non-string value stays null
 * so that "role unknown" is never mistaken for "member"; any other text is a member.
 */
export function normalizeRole(value: unknown): UserRole | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  return value.trim().toUpperCase() === 'ADMIN' ? 'ADMIN' : 'USER';
}

/**
 * Reads the role claim of an application token without verifying the signature. The result only
 * decides what the interface shows; the server checks the role again on every admin request.
 */
export function roleFromAccessToken(token: string | null): UserRole | null {
  const payload = token?.split('.')[1];
  if (!payload) {
    return null;
  }
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded: unknown = JSON.parse(atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')));
    return decoded && typeof decoded === 'object' ? normalizeRole((decoded as { role?: unknown }).role) : null;
  } catch {
    return null;
  }
}

/** Reads the subject claim of an application token without verifying it. It only names the person for local settings. */
export function subjectFromAccessToken(token: string | null): string | null {
  const payload = token?.split('.')[1];
  if (!payload) {
    return null;
  }
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded: unknown = JSON.parse(atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')));
    const subject = decoded && typeof decoded === 'object' ? (decoded as { sub?: unknown }).sub : null;
    return typeof subject === 'string' && subject.trim() ? subject : null;
  } catch {
    return null;
  }
}
