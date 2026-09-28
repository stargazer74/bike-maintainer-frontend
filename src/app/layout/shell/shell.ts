import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { VehiclesService } from '../../api-client';
import { AddVehicleDialog } from '../../shared/add-vehicle-dialog/add-vehicle-dialog';

interface NavItem {
  readonly label: string;
  readonly path: string;
  readonly icon: string;
}

const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: 'dashboard' },
  { label: 'Fahrzeuge', path: '/fahrzeuge', icon: 'two_wheeler' },
  { label: 'Wartungsplan', path: '/wartungsplan', icon: 'build' },
  { label: 'Historie', path: '/historie', icon: 'history' },
];

const VEHICLE_ROUTE_PATTERN = /^\/fahrzeuge\/(\d+)/;

@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatSelectModule,
    MatTabsModule,
    MatToolbarModule,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  protected readonly navItems = NAV_ITEMS;

  private readonly router = inject(Router);
  private readonly vehiclesService = inject(VehiclesService);
  private readonly dialog = inject(MatDialog);

  protected readonly vehicles = rxResource({
    stream: () => this.vehiclesService.listVehicles(),
  });

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  protected readonly selectedVehicleId = computed(() => {
    const match = VEHICLE_ROUTE_PATTERN.exec(this.currentUrl());
    return match ? Number(match[1]) : null;
  });

  protected onSelectVehicle(vehicleId: number): void {
    this.router.navigate(['/fahrzeuge', vehicleId]);
  }

  protected onAddVehicleClick(): void {
    this.dialog
      .open(AddVehicleDialog, { autoFocus: 'first-tabbable' })
      .afterClosed()
      .subscribe((createdVehicle) => {
        if (!createdVehicle) {
          return;
        }
        this.vehicles.reload();
        this.router.navigate(['/fahrzeuge', createdVehicle.id]);
      });
  }
}
