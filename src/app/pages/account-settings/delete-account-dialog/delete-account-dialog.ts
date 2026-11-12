import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe } from '@jsverse/transloco';
import { map, Observable } from 'rxjs';
import { AuthStore } from '../../../auth/auth-store';

/** Translation key of the message for a failed deletion. */
export function deleteErrorKey(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 403 && error.error?.code === 'WRONG_PASSWORD') {
      return 'accountSettings.delete.errors.wrongPassword';
    }
    if (error.status === 409 && error.error?.code === 'LAST_ADMIN') {
      return 'accountSettings.delete.errors.lastAdmin';
    }
    if (error.status === 429) {
      return 'account.errors.tooManyAttempts';
    }
    if (error.status === 503) {
      // The running subscription could not be ended at the payment provider, so the account was kept.
      return 'accountSettings.delete.errors.providerUnavailable';
    }
  }
  return 'account.errors.unknown';
}

/**
 * Asks for the current password and deletes the account with all vehicles and maintenance entries. Errors stay
 * in the dialog; closes with `true` once the account is gone (the user is then logged out locally as well).
 */
@Component({
  selector: 'app-delete-account-dialog',
  imports: [FormsModule, MatDialogModule, MatIconModule, MatProgressSpinnerModule, TranslocoPipe],
  templateUrl: './delete-account-dialog.html',
  styleUrl: './delete-account-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeleteAccountDialog {
  private readonly authStore = inject(AuthStore);
  private readonly dialogRef = inject(MatDialogRef<DeleteAccountDialog, boolean>);

  protected readonly password = signal('');
  protected readonly submitting = signal(false);
  protected readonly errorKey = signal<string | null>(null);

  protected cancel(): void {
    this.dialogRef.close(false);
  }

  protected onSubmit(): void {
    const password = this.password();
    if (!password) {
      this.errorKey.set('accountSettings.delete.errors.passwordRequired');
      return;
    }

    this.submitting.set(true);
    this.errorKey.set(null);
    this.dialogRef.disableClose = true;
    this.authStore.deleteAccount(password).subscribe({
      next: () => this.dialogRef.close(true),
      error: (error: unknown) => {
        this.submitting.set(false);
        this.dialogRef.disableClose = false;
        this.errorKey.set(deleteErrorKey(error));
      },
    });
  }
}

/** Opens the {@link DeleteAccountDialog}; emits `true` only if the account was deleted. */
export function openDeleteAccountDialog(dialog: MatDialog): Observable<boolean> {
  return dialog
    .open<DeleteAccountDialog, void, boolean>(DeleteAccountDialog, { autoFocus: 'first-tabbable' })
    .afterClosed()
    .pipe(map((deleted) => deleted === true));
}
