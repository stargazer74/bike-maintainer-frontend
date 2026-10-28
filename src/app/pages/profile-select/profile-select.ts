import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe } from '@jsverse/transloco';
import { ProfileResponse, ProfilesService } from '../../api-client';
import { AuthStore } from '../../auth/auth-store';
import { isSafeReturnUrl } from '../../auth/return-url';
import { confirmAction } from '../../shared/confirm-dialog/confirm-dialog';

/** Translation key of the message for a failed create/rename/delete. */
function profileErrorKey(error: unknown, conflictKey: string): string {
  return error instanceof HttpErrorResponse && error.status === 409
    ? conflictKey
    : 'profiles.errors.unknown';
}

/**
 * Household mode: instead of logging in, people pick their profile ("Wer bist du?"). Profiles can be
 * added, renamed and deleted here; they have no password.
 */
@Component({
  selector: 'app-profile-select',
  imports: [FormsModule, MatCardModule, MatIconModule, MatProgressSpinnerModule, TranslocoPipe],
  templateUrl: './profile-select.html',
  styleUrl: './profile-select.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileSelect {
  /** Page to return to after selecting a profile (query parameter, set by the guard and the interceptor). */
  readonly returnUrl = input<string>();

  private readonly profilesService = inject(ProfilesService);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);

  protected readonly profiles = rxResource({ stream: () => this.profilesService.listProfiles() });

  protected readonly newName = signal('');
  /** Profile currently being renamed, with the name typed so far. */
  protected readonly editing = signal<{ id: number; name: string } | null>(null);
  protected readonly busy = signal(false);
  /** Translation key of the current error message. */
  protected readonly errorKey = signal<string | null>(null);

  protected onSelect(profile: ProfileResponse): void {
    this.run(this.authStore.selectProfile(profile.id), 'profiles.errors.unknown', () => {
      const returnUrl = this.returnUrl();
      void this.router.navigateByUrl(isSafeReturnUrl(returnUrl) ? returnUrl : '/dashboard');
    });
  }

  protected onAdd(): void {
    const displayName = this.newName().trim();
    if (!displayName) {
      this.errorKey.set('profiles.errors.nameRequired');
      return;
    }
    this.run(
      this.profilesService.createProfile({ displayName }),
      'profiles.errors.nameTaken',
      () => {
        this.newName.set('');
        this.profiles.reload();
      },
    );
  }

  protected onStartRename(profile: ProfileResponse): void {
    this.errorKey.set(null);
    this.editing.set({ id: profile.id, name: profile.displayName });
  }

  protected onEditName(name: string): void {
    const editing = this.editing();
    if (editing) {
      this.editing.set({ ...editing, name });
    }
  }

  protected onCancelRename(): void {
    this.editing.set(null);
  }

  protected onRename(): void {
    const editing = this.editing();
    if (!editing) {
      return;
    }
    const displayName = editing.name.trim();
    if (!displayName) {
      this.errorKey.set('profiles.errors.nameRequired');
      return;
    }
    this.run(
      this.profilesService.updateProfile(editing.id, { displayName }),
      'profiles.errors.nameTaken',
      () => {
        this.editing.set(null);
        this.profiles.reload();
      },
    );
  }

  protected onDelete(profile: ProfileResponse): void {
    confirmAction(this.dialog, {
      title: 'profiles.deleteTitle',
      message: 'profiles.confirmDelete',
      params: { name: profile.displayName },
      confirm: 'common.delete',
    }).subscribe((confirmed) => {
      if (confirmed) {
        this.run(
          this.profilesService.deleteProfile(profile.id),
          'profiles.errors.hasVehicles',
          () => this.profiles.reload(),
        );
      }
    });
  }

  /** Runs one request at a time; a 409 is reported with `conflictKey`, other errors generically. */
  private run<T>(request: Observable<T>, conflictKey: string, onSuccess: () => void): void {
    this.busy.set(true);
    this.errorKey.set(null);
    request.subscribe({
      next: () => {
        this.busy.set(false);
        onSuccess();
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.errorKey.set(profileErrorKey(error, conflictKey));
      },
    });
  }
}
