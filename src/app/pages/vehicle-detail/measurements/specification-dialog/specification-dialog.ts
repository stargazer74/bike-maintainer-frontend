import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe } from '@jsverse/transloco';
import { tap } from 'rxjs';
import {
  MeasurementsService,
  ValveAdjustment,
  VehicleSpecifications,
  WorksheetTemplate,
} from '../../../../api-client';
import {
  DecimalField,
  fieldError,
  hasErrors,
  SPECIFICATION_GROUPS,
  SpecificationDraft,
  toDraft,
  toSpecification,
  wearLinksError,
} from './specification-form';

export interface SpecificationDialogData {
  readonly vehicleId: number;
  /** Templates that fit the vehicle type; only their target values are offered. */
  readonly templates: readonly WorksheetTemplate[];
}

/**
 * Target values of a vehicle from the workshop manual. They prefill the worksheets, check measured values and
 * feed the shim calculator. Closes with the saved values.
 */
@Component({
  selector: 'app-specification-dialog',
  imports: [FormsModule, MatDialogModule, MatIconModule, MatProgressSpinnerModule, TranslocoPipe],
  templateUrl: './specification-dialog.html',
  styleUrl: './specification-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpecificationDialog {
  private readonly data = inject<SpecificationDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<SpecificationDialog, VehicleSpecifications>);
  private readonly measurementsService = inject(MeasurementsService);

  protected readonly cylinderOptions = [1, 2, 3, 4, 5, 6, 7, 8];
  protected readonly valveOptions = [2, 3, 4];
  protected readonly adjustments = Object.values(ValveAdjustment);
  protected readonly fieldError = fieldError;

  protected readonly groups = SPECIFICATION_GROUPS.filter((group) =>
    this.data.templates.includes(group.template),
  );
  protected readonly hasValves = this.data.templates.includes(WorksheetTemplate.ValveClearance);
  protected readonly chainTemplate = WorksheetTemplate.Chain;

  protected readonly draft = signal<SpecificationDraft>(toDraft({}));
  protected readonly stored = rxResource({
    params: () => this.data.vehicleId,
    stream: ({ params }) =>
      this.measurementsService
        .getVehicleSpecifications(params)
        .pipe(tap((specification) => this.draft.set(toDraft(specification)))),
  });

  protected readonly showErrors = signal(false);
  protected readonly saving = signal(false);
  protected readonly errorKey = signal<string | null>(null);
  protected readonly wearLinksError = computed(() => wearLinksError(this.draft()));

  protected change(changes: Partial<SpecificationDraft>): void {
    this.draft.update((draft) => ({ ...draft, ...changes }));
  }

  protected changeField(field: DecimalField, value: unknown): void {
    this.change({ [field.key]: toNumber(value) });
  }

  protected changeNumber(
    key: 'cylinders' | 'valvesPerCylinder' | 'chainWearLinks',
    value: unknown,
  ): void {
    this.change({ [key]: toNumber(value) });
  }

  protected save(): void {
    if (this.saving()) {
      return;
    }
    if (hasErrors(this.draft(), this.groups)) {
      this.showErrors.set(true);
      this.errorKey.set('specification.errors.fix');
      return;
    }
    this.saving.set(true);
    this.errorKey.set(null);
    this.measurementsService
      .updateVehicleSpecifications(this.data.vehicleId, toSpecification(this.draft()))
      .subscribe({
        next: (saved) => this.dialogRef.close(saved),
        error: () => {
          this.saving.set(false);
          this.errorKey.set('specification.errors.save');
        },
      });
  }
}

/** Empty number inputs and selects give `null`, `''` or `undefined`; all mean "no value". */
function toNumber(value: unknown): number | null {
  if (typeof value === 'string' && value !== '') {
    value = Number(value);
  }
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
