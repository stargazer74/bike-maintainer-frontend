import { HttpErrorResponse } from '@angular/common/http';

/** The ALTCHA solution was missing, invalid, expired or already used; the widget has to be solved again. */
export function isCaptchaInvalid(error: unknown): boolean {
  return (
    error instanceof HttpErrorResponse &&
    error.status === 400 &&
    error.error?.code === 'CAPTCHA_INVALID'
  );
}

/**
 * Translation key for a failed registration or resend request. The backend answers the same for known
 * and unknown addresses, so these errors never depend on the email entered.
 */
export function accountErrorKey(error: unknown): string {
  if (isCaptchaInvalid(error)) {
    return 'account.errors.captchaInvalid';
  }
  if (error instanceof HttpErrorResponse && error.status === 429) {
    return error.error?.code === 'MAIL_QUOTA_EXCEEDED'
      ? 'account.errors.mailQuotaExceeded'
      : 'account.errors.tooManyAttempts';
  }
  return 'account.errors.unknown';
}
