import { newPasswordErrorKey } from './new-password';

describe('newPasswordErrorKey', () => {
  it('accepts 10 to 72 characters when both entries match', () => {
    expect(newPasswordErrorKey('a'.repeat(10), 'a'.repeat(10))).toBeNull();
    expect(newPasswordErrorKey('a'.repeat(72), 'a'.repeat(72))).toBeNull();
  });

  it('rejects fewer than 10 or more than 72 characters', () => {
    expect(newPasswordErrorKey('a'.repeat(9), 'a'.repeat(9))).toBe(
      'account.password.errors.length',
    );
    expect(newPasswordErrorKey('a'.repeat(73), 'a'.repeat(73))).toBe(
      'account.password.errors.length',
    );
  });

  it('rejects more than 72 bytes, as umlauts count twice', () => {
    const umlauts = 'ä'.repeat(40);
    expect(newPasswordErrorKey(umlauts, umlauts)).toBe('account.password.errors.tooLong');
  });

  it('rejects a different repetition', () => {
    expect(newPasswordErrorKey('correct-horse-battery', 'correct-horse-batterz')).toBe(
      'account.password.errors.mismatch',
    );
  });
});
