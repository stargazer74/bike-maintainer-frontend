import { ChangeDetectionStrategy, Component, inject, Signal, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe } from '@jsverse/transloco';
import { map, Observable } from 'rxjs';
import { VehiclesService } from '../../../api-client';

export interface DeleteVehicleDialogData {
  readonly vehicleId: number;
  readonly name: string;
  /** What goes with the vehicle, named in the dialog. */
  readonly taskCount: number;
  readonly logCount: number;
  /** The vehicle page's export ("Vorher exportieren"); the dialog stays open while it runs. */
  readonly exportVehicle: () => void;
  readonly exporting: Signal<boolean>;
  readonly exportErrorKey: Signal<string | null>;
}

/** Translation key of the message for a failed deletion. */
export function deleteVehicleErrorKey(error: unknown): string {
  if (error instanceof HttpErrorResponse && error.status === 404) {
    return 'vehicleDelete.errors.notFound';
  }
  return 'vehicleDelete.errors.unknown';
}

/**
 * Asks before deleting a vehicle with everything recorded for it (frontend#95) and offers to export it first.
 * Deletes it itself, so errors stay in the dialog; closes with `true` once the vehicle is gone.
 */
@Component({
  selector: 'app-delete-vehicle-dialog',
  imports: [MatDialogModule, MatIconModule, MatProgressSpinnerModule, TranslocoPipe],
  templateUrl: './delete-vehicle-dialog.html',
  styleUrl: './delete-vehicle-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeleteVehicleDialog {
  protected readonly data = inject<DeleteVehicleDialogData>(MAT_DIALOG_DATA);
  private readonly vehiclesService = inject(VehiclesService);
  private readonly dialogRef = inject(MatDialogRef<DeleteVehicleDialog, boolean>);

  protected readonly deleting = signal(false);
  protected readonly errorKey = signal<string | null>(null);

  protected cancel(): void {
    this.dialogRef.close(false);
  }

  protected onDelete(): void {
    this.deleting.set(true);
    this.errorKey.set(null);
    this.dialogRef.disableClose = true;
    this.vehiclesService.deleteVehicle(this.data.vehicleId).subscribe({
      next: () => this.dialogRef.close(true),
      error: (error: unknown) => {
        this.deleting.set(false);
        this.dialogRef.disableClose = false;
        this.errorKey.set(deleteVehicleErrorKey(error));
      },
    });
  }
}

/** Opens the {@link DeleteVehicleDialog}; emits `true` only if the vehicle was deleted. */
export function openDeleteVehicleDialog(
  dialog: MatDialog,
  data: DeleteVehicleDialogData,
): Observable<boolean> {
  return dialog
    .open<DeleteVehicleDialog, DeleteVehicleDialogData, boolean>(DeleteVehicleDialog, { data })
    .afterClosed()
    .pipe(map((deleted) => deleted === true));
}
