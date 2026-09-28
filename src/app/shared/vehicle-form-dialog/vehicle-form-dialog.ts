import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { VehicleRequest, VehicleResponse, VehicleType, VehiclesService } from '../../api-client';

const CURRENT_YEAR = new Date().getFullYear();

@Component({
  selector: 'app-add-vehicle-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './add-vehicle-dialog.html',
  styleUrl: './add-vehicle-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddVehicleDialog {
  private readonly fb = inject(FormBuilder);
  private readonly vehiclesService = inject(VehiclesService);
  private readonly dialogRef = inject(MatDialogRef<AddVehicleDialog, VehicleResponse>);

  protected readonly minYear = 1900;
  protected readonly maxYear = CURRENT_YEAR + 1;

  protected readonly vehicleTypes: ReadonlyArray<{ value: VehicleType; label: string }> = [
    { value: VehicleType.Motorcycle, label: 'Motorrad' },
    { value: VehicleType.Car, label: 'Auto' },
  ];

  protected readonly saving = signal(false);
  protected readonly submitError = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    type: this.fb.nonNullable.control<VehicleType>(VehicleType.Motorcycle, Validators.required),
    make: ['', Validators.maxLength(100)],
    model: ['', Validators.maxLength(100)],
    modelYear: this.fb.control<number | null>(null, [
      Validators.min(this.minYear),
      Validators.max(this.maxYear),
    ]),
    currentMileage: this.fb.nonNullable.control(0, Validators.min(0)),
  });

  protected submit(): void {
    if (this.saving()) {
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
      modelYear: value.modelYear ?? undefined,
      currentMileage: value.currentMileage,
    };

    this.saving.set(true);
    this.submitError.set(null);
    this.vehiclesService.createVehicle(request).subscribe({
      next: (vehicle) => {
        this.saving.set(false);
        this.dialogRef.close(vehicle);
      },
      error: () => {
        this.saving.set(false);
        this.submitError.set('Fahrzeug konnte nicht angelegt werden. Bitte versuche es erneut.');
      },
    });
  }

  protected cancel(): void {
    this.dialogRef.close();
  }
}
