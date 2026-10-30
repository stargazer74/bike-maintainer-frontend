import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { Currency, Language, UserResponse, UserRole } from '../api-client';
import { LanguageService } from '../i18n/language';
import { translocoTesting } from '../i18n/testing';
import { AuthStore } from './auth-store';

const ME_URL = 'http://localhost/api/v1/auth/me';
const LOGIN_URL = 'http://localhost/api/v1/auth/login';
const LOGOUT_URL = 'http://localhost/api/v1/auth/logout';
const SELECT_URL = 'http://localhost/api/v1/profiles/7/select';

const USER: UserResponse = {
  id: 1,
  email: 'admin@example.com',
  role: UserRole.User,
  language: Language.De,
  currency: Currency.Eur,
  active: true,
  emailVerified: true,
  createdAt: '2026-10-09T12:00:00Z',
};

describe('AuthStore', () => {
  let store: AuthStore;
  let httpMock: HttpTestingController;
  let language: LanguageService;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [provideHttpClientTesting()],
    });
    store = TestBed.inject(AuthStore);
    httpMock = TestBed.inject(HttpTestingController);
    language = TestBed.inject(LanguageService);
    await language.use('de', false);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  /** The language switch loads its translations asynchronously. */
  function settle(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve));
  }

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

  it('selectProfile() posts the selection and stores the profile as current user', async () => {
    const profile: UserResponse = { ...USER, id: 7, email: undefined, displayName: 'Anna' };
    const result = firstValueFrom(store.selectProfile(7));
    const request = httpMock.expectOne(SELECT_URL);
    expect(request.request.method).toBe('POST');
    request.flush(profile);

    expect(await result).toEqual(profile);
    expect(store.currentUser()).toEqual(profile);
  });

  it('load() switches the UI to the language of the account and remembers it', async () => {
    const loaded = store.load();
    httpMock.expectOne(ME_URL).flush({ ...USER, language: Language.En });
    await loaded;

    expect(language.lang()).toBe('en');
    expect(localStorage.getItem('bm.language')).toBe('en');
  });

  it('load() keeps the UI language when nobody is logged in', async () => {
    const loaded = store.load();
    httpMock.expectOne(ME_URL).flush(null, { status: 401, statusText: 'Unauthorized' });
    await loaded;

    expect(language.lang()).toBe('de');
  });

  it('login() switches the UI to the language of the account', async () => {
    const result = firstValueFrom(store.login('admin@example.com', 'secret'));
    httpMock.expectOne(LOGIN_URL).flush({ ...USER, language: Language.En });
    await result;
    await settle();

    expect(language.lang()).toBe('en');
  });

  it('selectProfile() switches the UI to the language of the profile', async () => {
    const result = firstValueFrom(store.selectProfile(7));
    httpMock.expectOne(SELECT_URL).flush({ ...USER, id: 7, language: Language.En });
    await result;
    await settle();

    expect(language.lang()).toBe('en');
  });

  it('changeLanguage() switches the UI and saves the language in the account when logged in', async () => {
    const loaded = store.load();
    httpMock.expectOne(ME_URL).flush(USER);
    await loaded;

    store.changeLanguage('en');
    const request = httpMock.expectOne(ME_URL);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ language: 'en' });
    request.flush({ ...USER, language: Language.En });
    await settle();

    expect(language.lang()).toBe('en');
    expect(store.currentUser()?.language).toBe(Language.En);
  });

  it('changeLanguage() only switches the UI when logged out', async () => {
    store.changeLanguage('en');
    await settle();

    httpMock.expectNone(ME_URL);
    expect(language.lang()).toBe('en');
  });

  it('changeLanguage() keeps the new UI language when saving it fails', async () => {
    const loaded = store.load();
    httpMock.expectOne(ME_URL).flush(USER);
    await loaded;

    store.changeLanguage('en');
    httpMock.expectOne(ME_URL).flush(null, { status: 500, statusText: 'Error' });
    await settle();

    expect(language.lang()).toBe('en');
    expect(store.currentUser()?.language).toBe(Language.De);
  });
});
