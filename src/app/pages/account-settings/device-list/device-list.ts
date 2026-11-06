import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { TranslocoPipe } from '@jsverse/transloco';
import { catchError, filter, of, switchMap } from 'rxjs';
import { AuthService, DeviceResponse } from '../../../api-client';
import { LocalDatePipe } from '../../../i18n/localized-pipes';
import { confirmAction } from '../../../shared/confirm-dialog/confirm-dialog';

/**
 * Devices (apps) that stay logged in for the current account, with a way to log each of them out. The web app itself
 * never appears here, it uses no device token.
 */
@Component({
  selector: 'app-device-list',
  imports: [TranslocoPipe, LocalDatePipe],
  templateUrl: './device-list.html',
  styleUrl: './device-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeviceList {
  private readonly authService = inject(AuthService);
  private readonly dialog = inject(MatDialog);

  protected readonly devices = rxResource({ stream: () => this.authService.listDevices() });

  protected onRemove(device: DeviceResponse): void {
    confirmAction(this.dialog, {
      title: 'accountSettings.devices.removeTitle',
      message: 'accountSettings.devices.confirmRemove',
      params: { name: device.name },
      confirm: 'accountSettings.devices.remove',
    })
      .pipe(
        filter((confirmed) => confirmed),
        switchMap(() =>
          this.authService.deleteDevice(device.id).pipe(
            // Already removed (e.g. in another tab): the goal is reached.
            catchError((error: unknown) =>
              error instanceof HttpErrorResponse && error.status === 404 ? of(null) : of(error),
            ),
          ),
        ),
      )
      .subscribe(() => this.devices.reload());
  }
}
