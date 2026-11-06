import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe } from '@jsverse/transloco';
import { filter, switchMap } from 'rxjs';
import { AdminService, UpdateUserRequest, UserResponse, UserRole } from '../../api-client';
import { AuthStore } from '../../auth/auth-store';
import { LocalDatePipe } from '../../i18n/localized-pipes';
import { ConfirmDialogData, confirmAction } from '../../shared/confirm-dialog/confirm-dialog';

/** Translation key of the message for a rejected change. */
function updateErrorKey(error: unknown): string {
  // 400: an admin deactivating themselves or the last active admin demoted or deactivated.
  return error instanceof HttpErrorResponse && error.status === 400
    ? 'adminUsers.errors.rule'
    : 'account.errors.unknown';
}

/**
 * User management for admins (portal mode): roles and active state. Admins see accounts here, never the data of
 * other users. A changed role or a deactivation ends the user's sessions (backend).
 */
@Component({
  selector: 'app-admin-users',
  imports: [MatCardModule, MatProgressSpinnerModule, TranslocoPipe, LocalDatePipe],
  templateUrl: './admin-users.html',
  styleUrl: './admin-users.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminUsers {
  private readonly adminService = inject(AdminService);
  private readonly dialog = inject(MatDialog);
  private readonly authStore = inject(AuthStore);

  protected readonly users = rxResource({ stream: () => this.adminService.listUsers() });
  protected readonly ownId = computed(() => this.authStore.currentUser()?.id);
  protected readonly errorKey = signal<string | null>(null);
  protected readonly UserRole = UserRole;

  protected onToggleRole(user: UserResponse): void {
    const makeAdmin = user.role !== UserRole.Admin;
    this.change(
      user,
      {
        title: makeAdmin ? 'adminUsers.makeAdminTitle' : 'adminUsers.makeUserTitle',
        message: makeAdmin ? 'adminUsers.confirmMakeAdmin' : 'adminUsers.confirmMakeUser',
        confirm: makeAdmin ? 'adminUsers.makeAdmin' : 'adminUsers.makeUser',
      },
      { role: makeAdmin ? UserRole.Admin : UserRole.User },
    );
  }

  protected onToggleActive(user: UserResponse): void {
    const deactivate = user.active;
    this.change(
      user,
      {
        title: deactivate ? 'adminUsers.deactivateTitle' : 'adminUsers.activateTitle',
        message: deactivate ? 'adminUsers.confirmDeactivate' : 'adminUsers.confirmActivate',
        confirm: deactivate ? 'adminUsers.deactivate' : 'adminUsers.activate',
      },
      { active: !deactivate },
    );
  }

  private change(
    user: UserResponse,
    texts: Omit<ConfirmDialogData, 'params'>,
    update: UpdateUserRequest,
  ): void {
    confirmAction(this.dialog, { ...texts, params: { email: user.email } })
      .pipe(
        filter((confirmed) => confirmed),
        switchMap(() => this.adminService.updateUser(user.id, update)),
      )
      .subscribe({
        next: () => {
          this.errorKey.set(null);
          this.users.reload();
        },
        error: (error: unknown) => this.errorKey.set(updateErrorKey(error)),
      });
  }
}
