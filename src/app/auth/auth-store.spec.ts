import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { Language, UserResponse, UserRole } from '../api-client';
import { AuthStore } from './auth-store';

const ME_URL = 'http://localhost/api/v1/auth/me';
const LOGIN_URL = 'http://localhost/api/v1/auth/login';
const LOGOUT_URL = 'http://localhost/api/v1/auth/logout';

const USER: UserResponse = {
  id: 1,
  email: 'admin@example.com',
  role: UserRole.User,
  language: Language.De,
  active: true,
  emailVerified: true,
  createdAt: '2026-10-09T12:00:00Z',
};

describe('AuthStore', () => {
  let store: AuthStore;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClientTesting()] });
    store = TestBed.inject(AuthStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('starts logged out', () => {
    expect(store.currentUser()).toBeNull();
    expect(store.isLoggedIn()).toBe(false);
    expect(store.isAdmin()).toBe(false);
  });

  it('load() stores the current user', async () => {
    const loaded = store.load();
    httpMock.expectOne(ME_URL).flush(USER);
    await loaded;

    expect(store.currentUser()).toEqual(USER);
    expect(store.isLoggedIn()).toBe(true);
  });

  it('load() treats 401 as logged out', async () => {
    const loaded = store.load();
    httpMock.expectOne(ME_URL).flush(null, { status: 401, statusText: 'Unauthorized' });
    await loaded;

    expect(store.isLoggedIn()).toBe(false);
  });

  it('load() does not fail the app start on other errors', async () => {
    const loaded = store.load();
    httpMock.expectOne(ME_URL).flush(null, { status: 503, statusText: 'Unavailable' });
    await loaded;

    expect(store.isLoggedIn()).toBe(false);
  });

  it('isAdmin() is true for admins', async () => {
    const loaded = store.load();
    httpMock.expectOne(ME_URL).flush({ ...USER, role: UserRole.Admin });
    await loaded;

    expect(store.isAdmin()).toBe(true);
  });

  it('login() posts the credentials and stores the user', async () => {
    const result = firstValueFrom(store.login('admin@example.com', 'secret'));
    const request = httpMock.expectOne(LOGIN_URL);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ email: 'admin@example.com', password: 'secret' });
    request.flush(USER);

    expect(await result).toEqual(USER);
    expect(store.currentUser()).toEqual(USER);
  });

  it('logout() posts and clears the user', async () => {
    const loaded = store.load();
    httpMock.expectOne(ME_URL).flush(USER);
    await loaded;

    const done = firstValueFrom(store.logout());
    const request = httpMock.expectOne(LOGOUT_URL);
    expect(request.request.method).toBe('POST');
    request.flush(null, { status: 204, statusText: 'No Content' });
    await done;

    expect(store.isLoggedIn()).toBe(false);
  });

  it('logout() clears the user even if the session was already gone', async () => {
    const loaded = store.load();
    httpMock.expectOne(ME_URL).flush(USER);
    await loaded;

    const done = firstValueFrom(store.logout());
    httpMock.expectOne(LOGOUT_URL).flush(null, { status: 401, statusText: 'Unauthorized' });
    await done;

    expect(store.isLoggedIn()).toBe(false);
  });
});
