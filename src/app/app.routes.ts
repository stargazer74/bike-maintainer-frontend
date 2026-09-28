import { Routes } from '@angular/router';

export const routes: Routes = [
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
];
