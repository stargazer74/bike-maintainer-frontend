import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthStore } from '../../auth/auth-store';

/** Translation key of the message for a failed login. */
function loginErrorKey(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) {
    return 'login.errors.unknown';
  }
  switch (error.status) {
    case 401:
      return 'login.errors.invalidCredentials';
    case 403:
      if (error.error?.code === 'ACCOUNT_DISABLED') {
        return 'login.errors.accountDisabled';
      }
      if (error.error?.code === 'EMAIL_NOT_VERIFIED') {
        return 'login.errors.emailNotVerified';
      }
      return 'login.errors.unknown';
    case 429:
      return 'login.errors.tooManyAttempts';
    default:
      return 'login.errors.unknown';
  }
}

/** Only paths within this app are followed; `//host` or absolute URLs could lead to another site. */
function isSafeReturnUrl(url: string | undefined): url is string {
  return !!url && url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/\\');
}

@Component({
  selector: 'app-login',
  imports: [FormsModule, MatCardModule, MatProgressSpinnerModule, TranslocoPipe],
  templateUrl: './login.html',
  styleUrl: './login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  /** Page to return to after logging in (query parameter, set by the guard and the interceptor). */
  readonly returnUrl = input<string>();

  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly submitting = signal(false);
  /** Translation key of the current error message. */
  protected readonly errorKey = signal<string | null>(null);

  protected onSubmit(): void {
    const email = this.email().trim();
    const password = this.password();
    if (!email || !password) {
      this.errorKey.set('login.errors.required');
      return;
    }

    this.submitting.set(true);
    this.errorKey.set(null);
    this.authStore.login(email, password).subscribe({
      next: () => {
        const returnUrl = this.returnUrl();
        void this.router.navigateByUrl(isSafeReturnUrl(returnUrl) ? returnUrl : '/dashboard');
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        this.errorKey.set(loginErrorKey(error));
      },
    });
  }
}
