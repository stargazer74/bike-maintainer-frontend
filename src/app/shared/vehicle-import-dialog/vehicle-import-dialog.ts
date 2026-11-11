import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  ErrorResponse,
  VehicleExport,
  VehicleExportService,
  VehicleResponse,
} from '../../api-client';
import { LocalDatePipe } from '../../i18n/localized-pipes';
import { ImportPreview, MAX_IMPORT_BYTES, readImportFile } from './vehicle-import';

export interface VehicleImportDialogData {
  /** Names of the user's vehicles, to point out that the import creates a second one of the same name. */
  readonly existingNames: readonly string[];
}

/** How many problems of a rejected file are listed; the rest is summed up. */
const SHOWN_DETAILS = 5;

/**
 * Imports a vehicle from an export file (Epic #82): choose the file, check the preview, import. The import always
 * creates a new vehicle; nothing is merged into an existing one. Closes with the created vehicle.
 */
@Component({
  selector: 'app-vehicle-import-dialog',
  imports: [LocalDatePipe, MatDialogModule, MatIconModule, MatProgressSpinnerModule, TranslocoPipe],
  templateUrl: './vehicle-import-dialog.html',
  styleUrl: './vehicle-import-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VehicleImportDialog {
  private readonly data = inject<VehicleImportDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<VehicleImportDialog, VehicleResponse>);
  private readonly vehicleExportService = inject(VehicleExportService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly fileName = signal<string | null>(null);
  protected readonly preview = signal<ImportPreview | null>(null);
  protected readonly importing = signal(false);
  protected readonly errorKey = signal<string | null>(null);
  /** Problems the backend found in the file, as it reports them (location: problem). */
  protected readonly details = signal<readonly string[]>([]);
  protected readonly hiddenDetails = signal(0);

  private file: VehicleExport | null = null;

  protected async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const chosen = input.files?.[0];
    this.reset();
    if (!chosen) {
      return;
    }
    this.fileName.set(chosen.name);
    if (chosen.size > MAX_IMPORT_BYTES) {
      this.errorKey.set('vehicleImport.errors.tooLarge');
      return;
    }
    const result = readImportFile(await chosen.text(), this.data.existingNames);
    if ('errorKey' in result) {
      this.errorKey.set(result.errorKey);
      return;
    }
    this.file = result.file;
    this.preview.set(result.preview);
  }

  protected startImport(): void {
    if (!this.file || this.importing()) {
      return;
    }
    this.importing.set(true);
    this.errorKey.set(null);
    this.details.set([]);
    this.hiddenDetails.set(0);
    this.vehicleExportService
      .importVehicle(this.file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (vehicle) => this.dialogRef.close(vehicle),
        error: (error: unknown) => {
          this.importing.set(false);
          this.showError(error);
        },
      });
  }

  private showError(error: unknown): void {
    if (!(error instanceof HttpErrorResponse)) {
      this.errorKey.set('vehicleImport.errors.unknown');
      return;
    }
    const body = error.error as ErrorResponse | null;
    if (error.status === 413) {
      this.errorKey.set('vehicleImport.errors.tooLarge');
    } else if (error.status === 400 && body?.code === 'IMPORT_FORMAT_UNSUPPORTED') {
      this.errorKey.set('vehicleImport.errors.unsupportedVersion');
    } else if (error.status === 400 && body?.code === 'IMPORT_INVALID') {
      this.errorKey.set('vehicleImport.errors.invalid');
      const details = body.details ?? [];
      this.details.set(details.slice(0, SHOWN_DETAILS));
      this.hiddenDetails.set(Math.max(0, details.length - SHOWN_DETAILS));
    } else {
      this.errorKey.set('vehicleImport.errors.unknown');
    }
  }

  private reset(): void {
    this.file = null;
    this.fileName.set(null);
    this.preview.set(null);
    this.errorKey.set(null);
    this.details.set([]);
    this.hiddenDetails.set(0);
  }
}
