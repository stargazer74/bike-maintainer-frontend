import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../api-client';
import { newPasswordErrorKey } from '../../auth/new-password';

/** Translation key of the message for a failed password change. */
function changeErrorKey(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    // The new password is checked here beforehand, so a 400 means the current one is wrong.
    if (error.status === 400) {
      return 'accountSettings.errors.wrongCurrent';
    }
    if (error.status === 429) {
      return 'account.errors.tooManyAttempts';
    }
  }
  return 'account.errors.unknown';
}

/** Account page (portal mode): change the password; the backend ends all other sessions. */
@Component({
  selector: 'app-account-settings',
  imports: [FormsModule, MatCardModule, MatProgressSpinnerModule, TranslocoPipe],
  templateUrl: './account-settings.html',
  styleUrl: './account-settings.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountSettings {
  private readonly authService = inject(AuthService);

  protected readonly currentPassword = signal('');
  protected readonly newPassword = signal('');
  protected readonly newPasswordRepeat = signal('');
  protected readonly submitting = signal(false);
  protected readonly errorKey = signal<string | null>(null);
  protected readonly changed = signal(false);

  protected onSubmit(): void {
    const currentPassword = this.currentPassword();
    const newPassword = this.newPassword();
    const validationError = currentPassword
      ? newPasswordErrorKey(newPassword, this.newPasswordRepeat())
      : 'accountSettings.errors.currentRequired';
    this.changed.set(false);
    if (validationError) {
      this.errorKey.set(validationError);
      return;
    }

    this.submitting.set(true);
    this.errorKey.set(null);
    this.authService.changePassword({ currentPassword, newPassword }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.changed.set(true);
        this.currentPassword.set('');
        this.newPassword.set('');
        this.newPasswordRepeat.set('');
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        this.errorKey.set(changeErrorKey(error));
      },
    });
  }
}
