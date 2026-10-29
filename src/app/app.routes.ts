import { Routes } from '@angular/router';
import { authGuard, guestGuard, householdOnlyGuard, portalOnlyGuard } from './auth/auth-guards';

export const routes: Routes = [
  {
    path: 'anmelden',
    canMatch: [portalOnlyGuard, guestGuard],
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
  },
  {
    path: 'registrieren',
    canMatch: [portalOnlyGuard, guestGuard],
    loadComponent: () => import('./pages/register/register').then((m) => m.Register),
  },
  {
    // Target of the link in the confirmation email; works with or without a session.
    path: 'email-bestaetigen',
    canMatch: [portalOnlyGuard],
    loadComponent: () => import('./pages/verify-email/verify-email').then((m) => m.VerifyEmail),
  },
  {
    // Household mode: pick a profile instead of logging in.
    path: 'person-waehlen',
    canMatch: [householdOnlyGuard, guestGuard],
    loadComponent: () =>
      import('./pages/profile-select/profile-select').then((m) => m.ProfileSelect),
  },
  {
    // All app pages require a session (logged in or profile selected); everyone else is sent to the
    // entry page of the operating mode for any other URL, unknown ones included.
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
