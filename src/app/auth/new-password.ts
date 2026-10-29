/** Limits of the API spec (`NewPassword`); 72 bytes is the BCrypt limit, checked by the backend as well. */
const MIN_PASSWORD_LENGTH = 10;
const MAX_PASSWORD_LENGTH = 72;
const MAX_PASSWORD_BYTES = 72;

/**
 * Translation key of the first problem with a new password and its repetition, or `null` if it can be
 * sent. Shared by registration, password reset and password change.
 */
export function newPasswordErrorKey(password: string, repeat: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    return 'account.password.errors.length';
  }
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) {
    return 'account.password.errors.tooLong';
  }
  if (password !== repeat) {
    return 'account.password.errors.mismatch';
  }
  return null;
}
