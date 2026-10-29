import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../api-client';
import { accountErrorKey } from '../../auth/account-errors';
import { Altcha, AltchaControl } from '../../shared/altcha/altcha';

/**
 * Requests a link to set a new password (portal mode). Shows the same notice afterwards for every address,
 * as the backend answers the same for known and unknown ones.
 */
@Component({
  selector: 'app-forgot-password',
  imports: [
    FormsModule,
    RouterLink,
    MatCardModule,
    MatProgressSpinnerModule,
    TranslocoPipe,
    Altcha,
  ],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForgotPassword {
  private readonly authService = inject(AuthService);
  private readonly altcha = viewChild<AltchaControl>('altcha');

  protected readonly email = signal('');
  protected readonly submitting = signal(false);
  protected readonly sent = signal(false);
  protected readonly errorKey = signal<string | null>(null);

  protected onSubmit(): void {
    const email = this.email().trim();
    if (!email) {
      this.errorKey.set('register.errors.emailRequired');
      return;
    }
    const altcha = this.altcha()?.payload() ?? null;
    if (!altcha) {
      this.errorKey.set('register.errors.captchaRequired');
      return;
    }

    this.submitting.set(true);
    this.errorKey.set(null);
    this.authService.requestPasswordReset({ email, altcha }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.sent.set(true);
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        this.errorKey.set(accountErrorKey(error));
        // The backend checks (and uses up) the solution before anything else can fail.
        this.altcha()?.reset();
      },
    });
  }
}
