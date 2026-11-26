import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  InjectionToken,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  ApplyTemplateResponse,
  VehicleResponse,
  VehicleTemplateResponse,
  VehicleTemplatesService,
  VehicleTemplateSummaryResponse,
} from '../../../api-client';
import { LanguageService } from '../../../i18n/language';
import { LocalDatePipe } from '../../../i18n/localized-pipes';
import { describeTaskInterval } from '../task-interval';
import {
  fillEmpty,
  initialRows,
  reportUrl,
  TemplateTaskRow,
  toApplyRequest,
} from './template-apply';

export interface TemplateDialogData {
  readonly vehicle: VehicleResponse;
  /** `templateKey`s of the tasks the vehicle already has. */
  readonly existingKeys: readonly string[];
}

/** Today as ISO date (YYYY-MM-DD); replaceable in tests. */
export const TODAY = new InjectionToken<() => string>('TODAY', {
  factory: () => () => new Date().toISOString().slice(0, 10),
});

type Step = 'search' | 'apply';

/**
 * Applies a maintenance plan template to a vehicle: first search (prefilled from the vehicle), then choose
 * the tasks and confirm the disclaimer. Closes with the {@link ApplyTemplateResponse}, or without a result.
 */
@Component({
  selector: 'app-template-dialog',
  imports: [MatDialogModule, MatProgressSpinnerModule, TranslocoPipe, LocalDatePipe],
  templateUrl: './template-dialog.html',
  styleUrl: './template-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TemplateDialog {
  private readonly data = inject<TemplateDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<TemplateDialog, ApplyTemplateResponse>);
  private readonly templates = inject(VehicleTemplatesService);
  private readonly today = inject(TODAY);
  private readonly language = inject(LanguageService);

  protected readonly vehicle = this.data.vehicle;
  protected readonly step = signal<Step>('search');
  protected readonly make = signal(this.vehicle.make ?? '');
  protected readonly model = signal(this.vehicle.model ?? '');
  protected readonly searching = signal(false);
  /** `null` until a search has been answered. */
  protected readonly results = signal<VehicleTemplateSummaryResponse[] | null>(null);
  protected readonly loading = signal(false);
  protected readonly template = signal<VehicleTemplateResponse | null>(null);
  protected readonly rows = signal<TemplateTaskRow[]>([]);
  protected readonly confirmed = signal(false);
  protected readonly applying = signal(false);
  protected readonly errorKey = signal<string | null>(null);

  protected readonly showLastDone = this.vehicle.currentMileage > 0;
  protected readonly canSearch = computed(() => this.make().trim().length >= 2);
  protected readonly selectedCount = computed(
    () => this.rows().filter((row) => row.selected && !row.existing).length,
  );
  protected readonly canApply = computed(
    () => this.confirmed() && !this.applying() && this.selectedCount() > 0,
  );
  protected readonly locale = this.language.locale;

  constructor() {
    if (this.canSearch()) {
      this.search();
    }
  }

  protected search(): void {
    if (!this.canSearch() || this.searching()) {
      return;
    }
    const model = this.model().trim();
    this.searching.set(true);
    this.errorKey.set(null);
    this.templates
      .searchVehicleTemplates(
        this.make().trim(),
        this.vehicle.type,
        model || undefined,
        this.vehicle.modelYear,
      )
      .subscribe({
        next: (hits) => {
          this.searching.set(false);
          this.results.set(hits);
          if (hits.length === 1) {
            this.pick(hits[0]);
          }
        },
        error: () => {
          this.searching.set(false);
          this.errorKey.set('templateDialog.errors.search');
        },
      });
  }

  protected pick(summary: VehicleTemplateSummaryResponse): void {
    this.loading.set(true);
    this.errorKey.set(null);
    this.templates.getVehicleTemplate(summary.id).subscribe({
      next: (template) => {
        this.loading.set(false);
        this.template.set(template);
        this.rows.set(
          initialRows(template, new Set(this.data.existingKeys), this.vehicle, this.today()),
        );
        this.confirmed.set(false);
        this.step.set('apply');
      },
      error: () => {
        this.loading.set(false);
        this.errorKey.set('templateDialog.errors.load');
      },
    });
  }

  protected backToSearch(): void {
    this.errorKey.set(null);
    this.step.set('search');
  }

  protected toggle(index: number): void {
    this.updateRow(index, (row) => ({ ...row, selected: !row.selected }));
  }

  protected setLastDoneKm(index: number, value: string): void {
    const km = value === '' ? null : Math.max(0, Math.trunc(Number(value)));
    this.updateRow(index, (row) => ({ ...row, lastDoneKm: km !== null && !isNaN(km) ? km : null }));
  }

  protected setLastDoneDate(index: number, value: string): void {
    this.updateRow(index, (row) => ({ ...row, lastDoneDate: value || null }));
  }

  protected fillEmptyFields(): void {
    this.rows.update((rows) => fillEmpty(rows, this.vehicle.currentMileage, this.today()));
  }

  protected interval(row: TemplateTaskRow) {
    return describeTaskInterval(row.task, this.locale());
  }

  protected reportUrl(taskKey?: string): string {
    return reportUrl(this.template()!.id, taskKey);
  }

  protected apply(): void {
    const template = this.template();
    if (!template || !this.canApply()) {
      return;
    }
    this.applying.set(true);
    this.errorKey.set(null);
    this.templates
      .applyVehicleTemplate(this.vehicle.id, toApplyRequest(template.id, this.rows()))
      .subscribe({
        next: (response) => this.dialogRef.close(response),
        error: (error: unknown) => {
          this.applying.set(false);
          this.errorKey.set(
            error instanceof HttpErrorResponse && error.status === 403
              ? 'readOnly.text'
              : 'templateDialog.errors.unknown',
          );
        },
      });
  }

  private updateRow(index: number, change: (row: TemplateTaskRow) => TemplateTaskRow): void {
    this.rows.update((rows) => rows.map((row, i) => (i === index ? change(row) : row)));
  }
}
