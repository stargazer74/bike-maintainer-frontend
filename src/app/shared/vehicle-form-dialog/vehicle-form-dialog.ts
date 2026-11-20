import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe } from '@jsverse/transloco';
import { VehicleRequest, VehicleResponse, VehicleType, VehiclesService } from '../../api-client';

const CURRENT_YEAR = new Date().getFullYear();

export interface VehicleFormDialogData {
  readonly vehicle?: VehicleResponse;
  /** Read-only account: the data is only shown, deleting the vehicle stays possible (Epic backend#136). */
  readonly readOnly?: boolean;
}

/** Result of the edit dialog when the user wants to delete the vehicle; the caller then asks for confirmation. */
export const DELETE_VEHICLE = 'delete';

/** What the dialog closes with: the saved vehicle, {@link DELETE_VEHICLE}, or nothing when cancelled. */
export type VehicleFormDialogResult = VehicleResponse | typeof DELETE_VEHICLE;

@Component({
  selector: 'app-vehicle-form-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslocoPipe,
  ],
  templateUrl: './vehicle-form-dialog.html',
  styleUrl: './vehicle-form-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VehicleFormDialog {
  private readonly fb = inject(FormBuilder);
  private readonly vehiclesService = inject(VehiclesService);
  private readonly dialogRef = inject(MatDialogRef<VehicleFormDialog, VehicleFormDialogResult>);
  private readonly data = inject<VehicleFormDialogData | null>(MAT_DIALOG_DATA, { optional: true });

  protected readonly editingVehicle = this.data?.vehicle ?? null;
  /** Only an existing vehicle can be read-only. */
  protected readonly readOnly = this.editingVehicle !== null && this.data?.readOnly === true;

  protected readonly minYear = 1900;
  protected readonly maxYear = CURRENT_YEAR + 1;

  /** Labels are translation keys. */
  protected readonly vehicleTypes: readonly { value: VehicleType; label: string }[] = [
    { value: VehicleType.Motorcycle, label: 'vehicleType.MOTORCYCLE' },
    { value: VehicleType.Car, label: 'vehicleType.CAR' },
    { value: VehicleType.Bicycle, label: 'vehicleType.BICYCLE' },
    { value: VehicleType.EBike, label: 'vehicleType.E_BIKE' },
    { value: VehicleType.Quad, label: 'vehicleType.QUAD' },
    { value: VehicleType.Scooter, label: 'vehicleType.SCOOTER' },
  ];

  protected readonly saving = signal(false);
  /** Translation key of the error to show, so it follows a language switch. */
  protected readonly submitError = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    name: [this.editingVehicle?.name ?? '', [Validators.required, Validators.maxLength(255)]],
    type: this.fb.nonNullable.control<VehicleType>(
      this.editingVehicle?.type ?? VehicleType.Motorcycle,
      Validators.required,
    ),
    make: [this.editingVehicle?.make ?? '', Validators.maxLength(100)],
    model: [this.editingVehicle?.model ?? '', Validators.maxLength(100)],
    modelYear: this.fb.nonNullable.control(this.editingVehicle?.modelYear ?? CURRENT_YEAR, [
      Validators.required,
      Validators.min(this.minYear),
      Validators.max(this.maxYear),
    ]),
    firstRegistrationDate: this.fb.nonNullable.control(
      this.editingVehicle?.firstRegistrationDate ?? `${CURRENT_YEAR}-01-01`,
      Validators.required,
    ),
    currentMileage: this.fb.nonNullable.control(
      this.editingVehicle?.currentMileage ?? 0,
      Validators.min(0),
    ),
  });

  constructor() {
    if (this.readOnly) {
      this.form.disable();
    }
  }

  protected submit(): void {
    if (this.saving() || this.readOnly) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const request: VehicleRequest = {
      name: value.name,
      type: value.type,
      make: value.make || undefined,
      model: value.model || undefined,
      modelYear: value.modelYear,
      firstRegistrationDate: value.firstRegistrationDate,
      currentMileage: value.currentMileage,
    };

    const vehicle = this.editingVehicle;
    const request$ =
      vehicle?.id === undefined
        ? this.vehiclesService.createVehicle(request)
        : this.vehiclesService.updateVehicle(vehicle.id, request);

    this.saving.set(true);
    this.submitError.set(null);
    request$.subscribe({
      next: (result) => {
        this.saving.set(false);
        this.dialogRef.close(result);
      },
      error: () => {
        this.saving.set(false);
        this.submitError.set(vehicle ? 'vehicleForm.updateError' : 'vehicleForm.createError');
      },
    });
  }

  protected cancel(): void {
    this.dialogRef.close();
  }

  /** Hands the deletion to the vehicle page, which asks first and offers an export. */
  protected requestDelete(): void {
    this.dialogRef.close(DELETE_VEHICLE);
  }
}
