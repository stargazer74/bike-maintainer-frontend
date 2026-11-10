import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DOCUMENT,
  inject,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { map } from 'rxjs';
import { WorksheetsService, WorksheetTemplate } from '../../../api-client';
import { LanguageService } from '../../../i18n/language';
import { saveFile } from '../../../shared/download';

export interface WorksheetDialogData {
  readonly vehicleId: number;
}

/** Translation key part per template, e.g. `worksheet.templates.valveClearance.name`. */
const TEMPLATE_KEYS: Record<WorksheetTemplate, string> = {
  [WorksheetTemplate.ValveClearance]: 'valveClearance',
  [WorksheetTemplate.Brakes]: 'brakes',
  [WorksheetTemplate.Chain]: 'chain',
  [WorksheetTemplate.Tires]: 'tires',
};

/**
 * Chooses a worksheet template (PDF from the backend) to fill in by hand in the workshop. Only the templates
 * that fit the vehicle type are offered; the valve clearance sheet also needs the engine layout.
 */
@Component({
  selector: 'app-worksheet-dialog',
  imports: [FormsModule, MatDialogModule, MatIconModule, MatProgressSpinnerModule, TranslocoPipe],
  templateUrl: './worksheet-dialog.html',
  styleUrl: './worksheet-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorksheetDialog {
  private readonly data = inject<WorksheetDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<WorksheetDialog>);
  private readonly worksheetsService = inject(WorksheetsService);
  private readonly transloco = inject(TranslocoService);
  private readonly document = inject(DOCUMENT);
  private readonly language = inject(LanguageService);

  protected readonly cylinderOptions = [1, 2, 3, 4, 5, 6, 7, 8];
  protected readonly valveOptions = [2, 3, 4];

  protected readonly templates = rxResource({
    params: () => this.data.vehicleId,
    stream: ({ params }) =>
      this.worksheetsService
        .listWorksheetTemplates(params)
        .pipe(
          map((templates) =>
            templates.map(({ template }) => ({ template, key: TEMPLATE_KEYS[template] })),
          ),
        ),
  });

  protected readonly selected = signal<WorksheetTemplate | null>(null);
  protected readonly cylinders = signal(2);
  protected readonly valvesPerCylinder = signal(4);
  protected readonly creating = signal(false);
  protected readonly errorKey = signal<string | null>(null);

  protected readonly needsEngineLayout = computed(
    () => this.selected() === WorksheetTemplate.ValveClearance,
  );

  protected select(template: WorksheetTemplate): void {
    this.selected.set(template);
    this.errorKey.set(null);
  }

  protected create(): void {
    const template = this.selected();
    if (!template) {
      return;
    }
    const valves = this.needsEngineLayout();
    this.creating.set(true);
    this.errorKey.set(null);
    this.worksheetsService
      .downloadWorksheet(
        this.data.vehicleId,
        template,
        valves ? this.cylinders() : undefined,
        valves ? this.valvesPerCylinder() : undefined,
        'response',
      )
      .subscribe({
        next: (response) => {
          const fallback = this.transloco.translate(
            'worksheet.fallbackFileName',
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
              ? 'worksheet.errors.invalid'
              : 'worksheet.errors.unknown',
          );
        },
      });
  }
}
