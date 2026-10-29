import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthStore } from './auth/auth-store';
import { AppConfigStore } from './config/app-config-store';

/**
 * Finds out the operating mode and who is logged in, then starts the first navigation, so the guards
 * decide between login page, profile selection and app with the real mode. Runs without blocking the
 * app start, so the shell can show that it is waiting for the server meanwhile.
 */
export function startApp(): Promise<void> {
  const config = inject(AppConfigStore);
  const authStore = inject(AuthStore);
  const router = inject(Router);
  return config
    .load()
    .then(() => authStore.load())
    .then(() => router.initialNavigation());
}
