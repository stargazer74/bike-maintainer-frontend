import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withInterceptors, withXsrfConfiguration } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { provideApi } from './api-client';
import { authInterceptor } from './auth/auth-interceptor';
import { AuthStore } from './auth/auth-store';
import { AppConfigStore } from './config/app-config-store';
import { provideI18n } from './i18n/i18n.config';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(
      withInterceptors([authInterceptor]),
      // Spring Security's cookie/header names for the CSRF token.
      withXsrfConfiguration({ cookieName: 'XSRF-TOKEN', headerName: 'X-XSRF-TOKEN' }),
    ),
    // Find out the operating mode and who is logged in before the first navigation, so the guards can
    // decide between login page, profile selection and app.
    provideAppInitializer(() => {
      const authStore = inject(AuthStore);
      return inject(AppConfigStore)
        .load()
        .then(() => authStore.load());
    }),
    // German and English UI via Transloco; numbers/dates are formatted with the locale of the
    // active language through the localNumber/localDate pipes (see i18n/).
    provideI18n(),
    // Empty base path: requests go to the same origin (e.g. /api/v1/vehicles) and
    // are forwarded to the backend via proxy.conf.json in development.
    provideApi('')
  ]
};
