import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  DOCUMENT,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { MaintenanceLogResponse, MaintenanceLogsService } from '../../../api-client';
import { LanguageService } from '../../../i18n/language';
import { LocalDatePipe, LocalNumberPipe } from '../../../i18n/localized-pipes';
import { saveFile } from '../../../shared/download';

/** Most IDs the backend accepts in one request (`maxItems` of `logId`). */
const MAX_LOG_IDS = 500;

export interface ReportDialogEntry {
  readonly log: MaintenanceLogResponse;
  readonly taskNames: readonly string[];
}

export interface ReportDialogData {
  readonly vehicleId: number;
  /** Entries as on the vehicle page, newest first. */
  readonly entries: readonly ReportDialogEntry[];
}

/**
 * Chooses the maintenance entries for the PDF report (from the backend). All entries are preselected;
 * the report itself lists them in chronological order.
 */
@Component({
  selector: 'app-report-dialog',
  imports: [
    LocalDatePipe,
    LocalNumberPipe,
    MatDialogModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslocoPipe,
  ],
  templateUrl: './report-dialog.html',
  styleUrl: './report-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportDialog {
  protected readonly data = inject<ReportDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ReportDialog>);
  private readonly logsService = inject(MaintenanceLogsService);
  private readonly transloco = inject(TranslocoService);
  private readonly document = inject(DOCUMENT);
  private readonly language = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly selected = signal<ReadonlySet<number>>(this.allIds());
  protected readonly creating = signal(false);
  protected readonly errorKey = signal<string | null>(null);

  protected toggle(logId: number): void {
    this.selected.update((current) => {
      const next = new Set(current);
      if (!next.delete(logId)) {
        next.add(logId);
      }
      return next;
    });
  }

  protected selectAll(): void {
    this.selected.set(this.allIds());
  }

  protected selectNone(): void {
    this.selected.set(new Set());
  }

  protected create(): void {
    const logIds = this.data.entries
      .map((entry) => entry.log.id)
      .filter((id) => this.selected().has(id));
    if (!logIds.length || this.creating()) {
      return;
    }
    // The IDs pin the report to the entries shown here. Only beyond the ID limit can everything selected
    // just ask for the full report, which also contains entries recorded elsewhere in the meantime.
    const selection =
      logIds.length > MAX_LOG_IDS && logIds.length === this.data.entries.length
        ? undefined
        : logIds;
    this.creating.set(true);
    this.errorKey.set(null);
    // Closing the dialog cancels the request, so nothing is downloaded after "Abbrechen".
    this.logsService
      .downloadMaintenanceReport(this.data.vehicleId, selection, 'response')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const fallback = this.transloco.translate(
            'report.fallbackFileName',
            {},
            this.language.lang(),
          );
          saveFile(response, fallback, this.document);
          this.dialogRef.close();
        },
        error: (error: unknown) => {
          this.creating.set(false);
          this.errorKey.set(
            error instanceof HttpErrorResponse && error.status === 400
              ? 'report.errors.invalid'
              : 'report.errors.unknown',
          );
        },
      });
  }

  private allIds(): ReadonlySet<number> {
    return new Set(this.data.entries.map((entry) => entry.log.id));
  }
}
