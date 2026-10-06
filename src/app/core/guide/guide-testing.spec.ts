import { AUTH_STORAGE_KEYS } from '../auth/auth.config';

/** Stores a sign-in for the given subject, in the shape the guide reads. The parts are not a real credential. */
export function signInAs(subject: string): void {
  const body = btoa(JSON.stringify({ sub: subject }));
  localStorage.setItem(AUTH_STORAGE_KEYS.accessToken, ['header', body, 'signature'].join('.'));
}
