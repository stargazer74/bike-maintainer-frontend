import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, finalize, firstValueFrom, map, Observable, of, tap } from 'rxjs';
import { AuthService, UserResponse, UserRole } from '../api-client';

/** The logged-in user of this browser session; `null` while logged out. */
@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly authService = inject(AuthService);
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
        map(() => undefined),
      ),
    );
  }

  login(email: string, password: string): Observable<UserResponse> {
    return this.authService.login({ email, password }).pipe(tap((user) => this.user.set(user)));
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
}
