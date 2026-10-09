import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe } from '@jsverse/transloco';
import { VehiclesService } from '../../api-client';
import { LocalNumberPipe } from '../../i18n/localized-pipes';
import { vehicleIcon, vehicleSubtitle } from '../../shared/vehicle-format';

@Component({
  selector: 'app-vehicles',
  imports: [RouterLink, LocalNumberPipe, MatCardModule, MatIconModule, MatProgressSpinnerModule, TranslocoPipe],
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
