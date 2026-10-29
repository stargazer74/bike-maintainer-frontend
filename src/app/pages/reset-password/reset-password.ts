import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../api-client';
import { AuthStore } from '../../auth/auth-store';
import { newPasswordErrorKey } from '../../auth/new-password';

/**
 * Target of the link in the password reset email (`/passwort-zuruecksetzen?token=…`). Only 400 means the
 * token is unknown, expired or used; for any other error the form stays, as the link may still be valid.
 */
@Component({
  selector: 'app-reset-password',
  imports: [FormsModule, RouterLink, MatCardModule, MatProgressSpinnerModule, TranslocoPipe],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPassword {
  /** Token from the link (query parameter). */
  readonly token = input<string>();

  private readonly authService = inject(AuthService);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  protected readonly password = signal('');
  protected readonly passwordRepeat = signal('');
  protected readonly submitting = signal(false);
  protected readonly errorKey = signal<string | null>(null);
  private readonly rejected = signal(false);
  protected readonly invalid = computed(() => !this.token() || this.rejected());

  protected onSubmit(): void {
    const token = this.token();
    const password = this.password();
    const validationError = newPasswordErrorKey(password, this.passwordRepeat());
    if (!token || validationError) {
      this.errorKey.set(validationError);
      return;
    }

    this.submitting.set(true);
    this.errorKey.set(null);
    this.authService.confirmPasswordReset({ token, newPassword: password }).subscribe({
      next: () => {
        // The backend ended all sessions of the account, possibly including this browser's.
        this.authStore.clear();
        void this.router.navigate(['/anmelden'], { queryParams: { passwordReset: true } });
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        if (error instanceof HttpErrorResponse && error.status === 400) {
          this.rejected.set(true);
        } else {
          this.errorKey.set('account.errors.unknown');
        }
      },
    });
  }
}
