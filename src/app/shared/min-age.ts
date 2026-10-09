import { HttpErrorResponse } from '@angular/common/http';
import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** FitSync holds health data, so it follows the GDPR Art. 8 default and accepts no one younger than 16. */
export const MIN_AGE_YEARS = 16;

export const UNDER_MIN_AGE_MESSAGE = 'You need to be 16 or older to use FitSync.';
export const FUTURE_BIRTH_DATE_MESSAGE = 'Birth date cannot be in the future.';
export const INVALID_BIRTH_DATE_MESSAGE = 'Enter a valid birth date.';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A calendar date as YYYY-MM-DD, read from the local clock the way a date input reads it. */
function toIsoDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Today as YYYY-MM-DD on the local calendar. */
export function todayIsoDate(today: Date = new Date()): string {
  return toIsoDate(today.getFullYear(), today.getMonth() + 1, today.getDate());
}

/**
 * The latest birth date of someone who is 16 today, as YYYY-MM-DD. Someone born on 29 February
 * turns 16 on 28 February in a year without that day, so the day is clamped to the month's end.
 */
export function latestAllowedBirthDate(today: Date = new Date(), minAge: number = MIN_AGE_YEARS): string {
  const year = today.getFullYear() - minAge;
  const month = today.getMonth() + 1;
  const lastDayOfMonth = new Date(year, month, 0).getDate();
  return toIsoDate(year, month, Math.min(today.getDate(), lastDayOfMonth));
}

function isRealDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) {
    return false;
  }
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/**
 * Checks a YYYY-MM-DD birth date: it must be a real date, not after today, and at least 16 years ago.
 * An empty value passes, so the control decides on its own whether the date is required.
 */
export function minimumAgeValidator(now: () => Date = () => new Date()): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = typeof control.value === 'string' ? control.value.trim() : '';
    if (!value) {
      return null;
    }
    if (!isRealDate(value)) {
      return { birthDateInvalid: true };
    }
    const today = now();
    // YYYY-MM-DD strings sort the same way the dates do.
    if (value > todayIsoDate(today)) {
      return { birthDateInFuture: true };
    }
    if (value > latestAllowedBirthDate(today)) {
      return { underMinimumAge: true };
    }
    return null;
  };
}

/** The line to show under the birth date field for the errors of the validator above, or null. */
export function birthDateErrorMessage(errors: ValidationErrors | null | undefined): string | null {
  if (!errors) {
    return null;
  }
  if (errors['birthDateInvalid']) {
    return INVALID_BIRTH_DATE_MESSAGE;
  }
  if (errors['birthDateInFuture']) {
    return FUTURE_BIRTH_DATE_MESSAGE;
  }
  if (errors['underMinimumAge']) {
    return UNDER_MIN_AGE_MESSAGE;
  }
  return null;
}

/**
 * The reason the server gave for refusing a request with 400. A validation answer lists its reasons in
 * `details` as "field: message"; the one for `field` is preferred, and `message` is used otherwise.
 * Returns null for anything that is not a 400 with a readable reason.
 */
export function serverValidationMessage(error: unknown, field = 'birthDate'): string | null {
  if (!(error instanceof HttpErrorResponse) || error.status !== 400) {
    return null;
  }
  const body = (error.error ?? null) as { message?: unknown; details?: unknown } | null;
  if (body && typeof body === 'object') {
    const details = Array.isArray(body.details) ? body.details : [];
    const prefix = `${field}:`;
    const fieldDetail = details.find(
      (detail): detail is string => typeof detail === 'string' && detail.startsWith(prefix)
    );
    if (fieldDetail && fieldDetail.slice(prefix.length).trim()) {
      return fieldDetail.slice(prefix.length).trim();
    }
    if (typeof body.message === 'string' && body.message.trim() && body.message.trim() !== 'Validation failed') {
      return body.message.trim();
    }
    const firstDetail = details.find((detail): detail is string => typeof detail === 'string' && detail.trim().length > 0);
    if (firstDetail) {
      return firstDetail.trim();
    }
  }
  return null;
}
