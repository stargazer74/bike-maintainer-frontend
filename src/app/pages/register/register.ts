import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService, Language } from '../../api-client';
import { accountErrorKey, isCaptchaInvalid } from '../../auth/account-errors';
import { LanguageService } from '../../i18n/language';
import { Altcha, AltchaControl } from '../../shared/altcha/altcha';

/** Limits of the API spec (`NewPassword`); 72 bytes is the BCrypt limit, checked by the backend as well. */
const MIN_PASSWORD_LENGTH = 10;
const MAX_PASSWORD_LENGTH = 72;
const MAX_PASSWORD_BYTES = 72;

/** Translation key of the first problem with the input, or `null` if it can be sent. */
function validationErrorKey(email: string, password: string, repeat: string): string | null {
  if (!email) {
    return 'register.errors.emailRequired';
  }
  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    return 'register.errors.passwordLength';
  }
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) {
    return 'register.errors.passwordTooLong';
  }
  if (password !== repeat) {
    return 'register.errors.passwordMismatch';
  }
  return null;
}

/**
 * Self-registration (portal mode). After sending, the page always asks to check the inbox – the backend
 * answers the same whether the address is new or already registered.
 */
@Component({
  selector: 'app-register',
  imports: [
    FormsModule,
    RouterLink,
    MatCardModule,
    MatProgressSpinnerModule,
    TranslocoPipe,
    Altcha,
  ],
  templateUrl: './register.html',
  styleUrl: './register.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Register {
  private readonly authService = inject(AuthService);
  private readonly language = inject(LanguageService);
  private readonly altcha = viewChild<AltchaControl>('altcha');

  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly passwordRepeat = signal('');
  /** Honeypot: invisible to people, filled in by bots; sent unchanged. */
  protected readonly website = signal('');
  protected readonly submitting = signal(false);
  protected readonly errorKey = signal<string | null>(null);
  /** Address the confirmation email went to; set once the registration was accepted. */
  protected readonly sentTo = signal<string | null>(null);

  protected onSubmit(): void {
    const email = this.email().trim();
    const password = this.password();
    const validationError = validationErrorKey(email, password, this.passwordRepeat());
    if (validationError) {
      this.errorKey.set(validationError);
      return;
    }
    const altcha = this.altcha()?.payload() ?? null;
    if (!altcha) {
      this.errorKey.set('register.errors.captchaRequired');
      return;
    }

    this.submitting.set(true);
    this.errorKey.set(null);
    this.authService
      .register({
        email,
        password,
        language: this.language.lang() as Language,
        altcha,
        website: this.website(),
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.sentTo.set(email);
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          this.errorKey.set(this.errorKeyFor(error));
          if (isCaptchaInvalid(error)) {
            this.altcha()?.reset();
          }
        },
      });
  }

  private errorKeyFor(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 400 && !isCaptchaInvalid(error)) {
      return 'register.errors.invalid';
    }
    return accountErrorKey(error);
  }
}
