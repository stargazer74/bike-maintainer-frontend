import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { TranslocoPipe } from '@jsverse/transloco';
import { VehiclesService } from '../../api-client';
import { LOGIN_PATH, PROFILE_SELECT_PATH } from '../../auth/auth-guards';
import { AuthStore } from '../../auth/auth-store';
import { AppConfigStore } from '../../config/app-config-store';
import { APP_LANGUAGES, AppLanguage, LanguageService } from '../../i18n/language';
import { VehicleFormDialog } from '../../shared/vehicle-form-dialog/vehicle-form-dialog';

interface NavItem {
  /** Translation key. */
  readonly label: string;
  readonly path: string;
  readonly icon: string;
}

const NAV_ITEMS: readonly NavItem[] = [
  { label: 'nav.dashboard', path: '/dashboard', icon: 'dashboard' },
  { label: 'nav.vehicles', path: '/fahrzeuge', icon: 'two_wheeler' },
  { label: 'nav.maintenancePlan', path: '/wartungsplan', icon: 'build' },
  { label: 'nav.history', path: '/historie', icon: 'history' },
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
    MatMenuModule,
    MatSelectModule,
    MatTabsModule,
    MatToolbarModule,
    TranslocoPipe,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  protected readonly navItems = NAV_ITEMS;
  protected readonly languages = APP_LANGUAGES;
  protected readonly language = inject(LanguageService);
  protected readonly authStore = inject(AuthStore);
  protected readonly config = inject(AppConfigStore);

  /** Profiles (household) have a display name; accounts (portal) are shown by their email. */
  protected readonly userName = computed(() => {
    const user = this.authStore.currentUser();
    return user?.displayName ?? user?.email ?? '';
  });

  private readonly router = inject(Router);
  private readonly vehiclesService = inject(VehiclesService);
  private readonly dialog = inject(MatDialog);

  /** Loaded per logged-in user; idle (and empty) while logged out, reloaded when the user changes. */
  protected readonly vehicles = rxResource({
    params: () => this.authStore.currentUser()?.id,
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

  protected onSelectLanguage(lang: AppLanguage): void {
    void this.language.use(lang);
  }

  /** Ends the session; in household mode this means switching to another profile. */
  protected onLogout(): void {
    const entryPath = this.config.isHousehold() ? PROFILE_SELECT_PATH : LOGIN_PATH;
    this.authStore.logout().subscribe(() => void this.router.navigateByUrl(entryPath));
  }

  protected onAddVehicleClick(): void {
    this.dialog
      .open(VehicleFormDialog, { autoFocus: 'first-tabbable' })
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
