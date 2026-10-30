import { computed, inject, Injectable, signal } from '@angular/core';
import {
  catchError,
  finalize,
  firstValueFrom,
  from,
  map,
  Observable,
  of,
  switchMap,
  tap,
} from 'rxjs';
import {
  AuthService,
  Currency,
  Language,
  ProfilesService,
  UserResponse,
  UserRole,
} from '../api-client';
import { AppLanguage, isAppLanguage, LanguageService } from '../i18n/language';

/**
 * The logged-in user of this browser session; `null` while logged out. Once someone is logged in, the
 * UI follows the language stored in their account (also for PDFs and emails, which the backend writes
 * in that language).
 */
@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly authService = inject(AuthService);
  private readonly profilesService = inject(ProfilesService);
  private readonly language = inject(LanguageService);
  private readonly user = signal<UserResponse | null>(null);

  readonly currentUser = this.user.asReadonly();
  readonly isLoggedIn = computed(() => this.user() !== null);
  readonly isAdmin = computed(() => this.user()?.role === UserRole.Admin);

  /**
   * Asks the backend who is logged in (runs once at app start). Any error — 401 or the backend being
   * unreachable — counts as logged out, so the app still starts and shows the login page. The response
   * also carries the XSRF-TOKEN cookie needed for the login request.
   */
  load(): Promise<void> {
    return firstValueFrom(
      this.authService.getCurrentUser().pipe(
        map((user): UserResponse | null => user),
        catchError(() => of(null)),
        tap((user) => this.user.set(user)),
        // Before the first navigation, so the app does not flash in the browser's language.
        switchMap((user) => from(this.applyLanguage(user))),
        map(() => undefined),
      ),
    );
  }

  login(email: string, password: string): Observable<UserResponse> {
    return this.authService.login({ email, password }).pipe(tap((user) => this.setUser(user)));
  }

  /** Household mode: uses the app as this profile; the backend starts a session as on login. */
  selectProfile(profileId: number): Observable<UserResponse> {
    return this.profilesService.selectProfile(profileId).pipe(tap((user) => this.setUser(user)));
  }

  /** Logs out; the local user is cleared even if the session had already expired on the server. */
  logout(): Observable<void> {
    return this.authService.logout().pipe(
      map(() => undefined),
      catchError(() => of(undefined)),
      finalize(() => this.clear()),
    );
  }

  clear(): void {
    this.user.set(null);
  }

  /**
   * Switches the UI language right away and, when someone is logged in, saves it in the account. If
   * saving fails, the UI keeps the new language for this session; the account keeps the old one.
   */
  changeLanguage(lang: AppLanguage): void {
    void this.language.use(lang);
    if (!this.user()) {
      return;
    }
    this.authService
      .updateCurrentUser({ language: lang as Language })
      .pipe(catchError(() => of(null)))
      .subscribe((user) => {
        if (user) {
          this.user.set(user);
        }
      });
  }

  /**
   * Saves the currency for new maintenance entries in the account. The user only changes once the backend
   * has confirmed; if saving fails, the old currency stays (like with the language, the error is not shown).
   */
  changeCurrency(currency: Currency): void {
    if (!this.user()) {
      return;
    }
    this.authService
      .updateCurrentUser({ currency })
      .pipe(catchError(() => of(null)))
      .subscribe((user) => {
        if (user) {
          this.user.set(user);
        }
      });
  }

  private setUser(user: UserResponse): void {
    this.user.set(user);
    void this.applyLanguage(user);
  }

  private async applyLanguage(user: UserResponse | null): Promise<void> {
    if (user && isAppLanguage(user.language) && user.language !== this.language.lang()) {
      await this.language.use(user.language);
    }
  }
}
