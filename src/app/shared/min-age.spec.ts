import { HttpErrorResponse } from '@angular/common/http';
import { FormControl } from '@angular/forms';

import {
  birthDateErrorMessage,
  latestAllowedBirthDate,
  minimumAgeValidator,
  serverValidationMessage
} from './min-age';

describe('min-age', () => {
  // 9 October 2026, local time.
  const today = new Date(2026, 9, 9, 12, 0, 0);
  const validator = minimumAgeValidator(() => today);
  const check = (value: string) => validator(new FormControl(value));

  describe('latestAllowedBirthDate', () => {
    it('is today, 16 years ago', () => {
      expect(latestAllowedBirthDate(today)).toBe('2010-10-09');
    });

    it('clamps 29 February to 28 February in a year without it', () => {
      expect(latestAllowedBirthDate(new Date(2028, 1, 29))).toBe('2012-02-29');
      expect(latestAllowedBirthDate(new Date(2032, 1, 29))).toBe('2016-02-29');
      expect(latestAllowedBirthDate(new Date(2024, 1, 29))).toBe('2008-02-29');
      expect(latestAllowedBirthDate(new Date(2028, 1, 29), 17)).toBe('2011-02-28');
    });
  });

  describe('minimumAgeValidator', () => {
    it('leaves an empty value to the required check', () => {
      expect(check('')).toBeNull();
    });

    it('accepts someone who turns 16 today and anyone older', () => {
      expect(check('2010-10-09')).toBeNull();
      expect(check('1990-01-01')).toBeNull();
    });

    it('refuses someone who turns 16 tomorrow', () => {
      expect(check('2010-10-10')).toEqual({ underMinimumAge: true });
    });

    it('refuses a date after today', () => {
      expect(check('2026-10-10')).toEqual({ birthDateInFuture: true });
    });

    it('accepts nothing that is not a real calendar date', () => {
      expect(check('2001-02-30')).toEqual({ birthDateInvalid: true });
      expect(check('not a date')).toEqual({ birthDateInvalid: true });
    });
  });

  describe('birthDateErrorMessage', () => {
    it('says why the date is refused', () => {
      expect(birthDateErrorMessage({ underMinimumAge: true })).toBe('You need to be 16 or older to use FitSync.');
      expect(birthDateErrorMessage({ birthDateInFuture: true })).toBe('Birth date cannot be in the future.');
      expect(birthDateErrorMessage({ birthDateInvalid: true })).toBe('Enter a valid birth date.');
    });

    it('says nothing for other errors or none', () => {
      expect(birthDateErrorMessage(null)).toBeNull();
      expect(birthDateErrorMessage({ required: true })).toBeNull();
    });
  });

  describe('serverValidationMessage', () => {
    const badRequest = (error: unknown) => new HttpErrorResponse({ status: 400, error });

    it('prefers the detail written for the birth date', () => {
      expect(serverValidationMessage(badRequest({
        message: 'Validation failed',
        details: ['heightCm: must be positive', 'birthDate: You need to be 16 or older to use FitSync.']
      }))).toBe('You need to be 16 or older to use FitSync.');
    });

    it('uses a specific message when no detail names the field', () => {
      expect(serverValidationMessage(badRequest({ message: 'You need to be 16 or older to use FitSync.' })))
        .toBe('You need to be 16 or older to use FitSync.');
    });

    it('falls back to the first detail behind a generic message', () => {
      expect(serverValidationMessage(badRequest({ message: 'Validation failed', details: ['heightCm: must be positive'] })))
        .toBe('heightCm: must be positive');
    });

    it('returns null for other statuses, plain errors and unreadable bodies', () => {
      expect(serverValidationMessage(new HttpErrorResponse({ status: 500, error: { message: 'boom' } }))).toBeNull();
      expect(serverValidationMessage(new Error('offline'))).toBeNull();
      expect(serverValidationMessage(badRequest('Bad Request'))).toBeNull();
      expect(serverValidationMessage(badRequest({ message: 'Validation failed' }))).toBeNull();
    });
  });
});
