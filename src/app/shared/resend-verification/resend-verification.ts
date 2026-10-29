import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../api-client';
import { accountErrorKey, isCaptchaInvalid } from '../../auth/account-errors';
import { Altcha, AltchaControl } from '../altcha/altcha';

/**
 * Requests a new confirmation email. Shows the same notice afterwards for every address, as the backend
 * answers the same for unknown, confirmed and unconfirmed ones.
 */
@Component({
  selector: 'app-resend-verification',
  imports: [FormsModule, MatProgressSpinnerModule, TranslocoPipe, Altcha],
  templateUrl: './resend-verification.html',
  styleUrl: './resend-verification.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResendVerification {
  /** Address to start with, e.g. the one entered on the login page. */
  readonly email = input('');

  private readonly authService = inject(AuthService);
  private readonly altcha = viewChild<AltchaControl>('altcha');

  protected readonly address = signal('');
  protected readonly submitting = signal(false);
  protected readonly sent = signal(false);
  protected readonly errorKey = signal<string | null>(null);

  constructor() {
    effect(() => this.address.set(this.email()));
  }

  protected onSubmit(): void {
    const email = this.address().trim();
    const altcha = this.altcha()?.payload() ?? null;
    if (!email) {
      this.errorKey.set('register.errors.emailRequired');
      return;
    }
    if (!altcha) {
      this.errorKey.set('register.errors.captchaRequired');
      return;
    }

    this.submitting.set(true);
    this.errorKey.set(null);
    this.authService.resendVerificationEmail({ email, altcha }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.sent.set(true);
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        this.errorKey.set(accountErrorKey(error));
        if (isCaptchaInvalid(error)) {
          this.altcha()?.reset();
        }
      },
    });
  }
}
