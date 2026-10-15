import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './auth/auth-guards';

export const routes: Routes = [
  {
    path: 'anmelden',
    canMatch: [guestGuard],
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
  },
  {
    // All app pages require a logged-in user; logged-out users are sent to the login page for any
    // URL other than /anmelden, unknown ones included.
    path: '',
    canMatch: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () => import('./pages/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'fahrzeuge',
        loadComponent: () => import('./pages/vehicles/vehicles').then((m) => m.Vehicles),
      },
      {
        path: 'fahrzeuge/:id',
        loadComponent: () =>
          import('./pages/vehicle-detail/vehicle-detail').then((m) => m.VehicleDetail),
      },
      {
        path: 'wartungsplan',
        loadComponent: () =>
          import('./pages/maintenance-tasks/maintenance-tasks').then((m) => m.MaintenanceTasks),
      },
      {
        path: 'historie',
        loadComponent: () =>
          import('./pages/maintenance-logs/maintenance-logs').then((m) => m.MaintenanceLogs),
      },
      { path: '**', redirectTo: 'dashboard' },
    ],
  },
];
