import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService, Language } from '../../api-client';
import { accountErrorKey, isCaptchaInvalid } from '../../auth/account-errors';
import { newPasswordErrorKey } from '../../auth/new-password';
import { LanguageService } from '../../i18n/language';
import { Altcha, AltchaControl } from '../../shared/altcha/altcha';

/** Translation key of the first problem with the input, or `null` if it can be sent. */
function validationErrorKey(email: string, password: string, repeat: string): string | null {
  if (!email) {
    return 'register.errors.emailRequired';
  }
  return newPasswordErrorKey(password, repeat);
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
          // The backend checks (and uses up) the solution before anything else can fail.
          this.altcha()?.reset();
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
