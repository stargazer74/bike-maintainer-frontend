import { HttpErrorResponse } from '@angular/common/http';
import { accountErrorKey, isCaptchaInvalid } from './account-errors';

function httpError(status: number, code?: string): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: code ? { status, code } : null });
}

describe('accountErrorKey', () => {
  it('asks to confirm again when the ALTCHA solution was rejected', () => {
    expect(accountErrorKey(httpError(400, 'CAPTCHA_INVALID'))).toBe(
      'account.errors.captchaInvalid',
    );
  });

  it('explains the daily email limit', () => {
    expect(accountErrorKey(httpError(429, 'MAIL_QUOTA_EXCEEDED'))).toBe(
      'account.errors.mailQuotaExceeded',
    );
  });

  it('reports too many attempts for a 429 without code', () => {
    expect(accountErrorKey(httpError(429))).toBe('account.errors.tooManyAttempts');
  });

  it('falls back to a generic message', () => {
    expect(accountErrorKey(httpError(400))).toBe('account.errors.unknown');
    expect(accountErrorKey(httpError(500))).toBe('account.errors.unknown');
    expect(accountErrorKey(new Error('offline'))).toBe('account.errors.unknown');
  });
});

describe('isCaptchaInvalid', () => {
  it('detects a rejected ALTCHA solution only', () => {
    expect(isCaptchaInvalid(httpError(400, 'CAPTCHA_INVALID'))).toBe(true);
    expect(isCaptchaInvalid(httpError(400))).toBe(false);
    expect(isCaptchaInvalid(new Error('x'))).toBe(false);
  });
});
