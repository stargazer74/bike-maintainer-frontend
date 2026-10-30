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
    path: 'passwort-vergessen',
    canMatch: [portalOnlyGuard, guestGuard],
    loadComponent: () =>
      import('./pages/forgot-password/forgot-password').then((m) => m.ForgotPassword),
  },
  {
    // Target of the link in the password reset email; works with or without a session.
    path: 'passwort-zuruecksetzen',
    canMatch: [portalOnlyGuard],
    loadComponent: () =>
      import('./pages/reset-password/reset-password').then((m) => m.ResetPassword),
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
        path: 'fahrzeuge/:id',
        loadComponent: () =>
          import('./pages/vehicle-detail/vehicle-detail').then((m) => m.VehicleDetail),
      },
      {
        // Household profiles have no password.
        path: 'konto',
        canMatch: [portalOnlyGuard],
        loadComponent: () =>
          import('./pages/account-settings/account-settings').then((m) => m.AccountSettings),
      },
      { path: '**', redirectTo: 'dashboard' },
    ],
  },
];
