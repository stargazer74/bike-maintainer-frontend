import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { VehiclesService } from '../../api-client';
import { vehicleIcon, vehicleSubtitle } from '../../shared/vehicle-format';

@Component({
  selector: 'app-vehicles',
  imports: [RouterLink, DecimalPipe, MatCardModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './vehicles.html',
  styleUrl: './vehicles.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Vehicles {
  private readonly vehiclesService = inject(VehiclesService);

  protected readonly vehicles = rxResource({
    stream: () => this.vehiclesService.listVehicles(),
  });

  protected readonly vehicleIcon = vehicleIcon;
  protected readonly vehicleSubtitle = vehicleSubtitle;
}
