import { inject } from '@angular/core';
import { CanMatchFn, Router, UrlTree } from '@angular/router';
import { AuthStore } from './auth-store';

export const LOGIN_PATH = '/anmelden';

/** URL of the login page that leads back to `returnUrl` after logging in. */
export function loginUrlTree(router: Router, returnUrl: string): UrlTree {
  return router.createUrlTree([LOGIN_PATH], { queryParams: { returnUrl } });
}

/** Only logged-in users may enter; everyone else is sent to the login page. */
export const authGuard: CanMatchFn = () => {
  if (inject(AuthStore).isLoggedIn()) {
    return true;
  }
  const router = inject(Router);
  const target = router.currentNavigation()?.extractedUrl;
  return loginUrlTree(router, target ? router.serializeUrl(target) : '/');
};

/** The login page is only for logged-out users. */
export const guestGuard: CanMatchFn = () =>
  inject(AuthStore).isLoggedIn() ? inject(Router).createUrlTree(['/dashboard']) : true;
