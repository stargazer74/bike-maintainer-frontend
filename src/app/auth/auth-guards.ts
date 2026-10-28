import { inject } from '@angular/core';
import { CanMatchFn, Router, UrlTree } from '@angular/router';
import { AppConfigStore } from '../config/app-config-store';
import { AuthStore } from './auth-store';

export const LOGIN_PATH = '/anmelden';
export const PROFILE_SELECT_PATH = '/person-waehlen';

/**
 * Where users without a session start: the login page in portal mode, the profile selection in household
 * mode. Leads back to `returnUrl` afterwards.
 */
export function entryUrlTree(router: Router, config: AppConfigStore, returnUrl: string): UrlTree {
  const path = config.isHousehold() ? PROFILE_SELECT_PATH : LOGIN_PATH;
  return router.createUrlTree([path], { queryParams: { returnUrl } });
}

/** Only users with a session (logged in or profile selected) may enter; everyone else goes to the entry page. */
export const authGuard: CanMatchFn = () => {
  if (inject(AuthStore).isLoggedIn()) {
    return true;
  }
  const router = inject(Router);
  const target = router.currentNavigation()?.extractedUrl;
  return entryUrlTree(router, inject(AppConfigStore), target ? router.serializeUrl(target) : '/');
};

/** The entry pages (login, profile selection) are only for users without a session. */
export const guestGuard: CanMatchFn = () =>
  inject(AuthStore).isLoggedIn() ? inject(Router).createUrlTree(['/dashboard']) : true;

/** Routes that exist only in portal mode, e.g. the login page. */
export const portalOnlyGuard: CanMatchFn = () => !inject(AppConfigStore).isHousehold();

/** Routes that exist only in household mode, e.g. the profile selection. */
export const householdOnlyGuard: CanMatchFn = () => inject(AppConfigStore).isHousehold();
