import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { OperatingMode } from '../api-client';
import { AppConfigStore } from './app-config-store';

const CONFIG_URL = 'http://localhost/api/v1/config';

describe('AppConfigStore', () => {
  let store: AppConfigStore;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClientTesting()] });
    store = TestBed.inject(AppConfigStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('starts in portal mode', () => {
    expect(store.mode()).toBe(OperatingMode.Portal);
    expect(store.isHousehold()).toBe(false);
  });

  it('load() takes the mode from the backend', async () => {
    const loaded = store.load();
    httpMock.expectOne(CONFIG_URL).flush({ mode: OperatingMode.Household });
    await loaded;

    expect(store.mode()).toBe(OperatingMode.Household);
    expect(store.isHousehold()).toBe(true);
  });

  it('load() falls back to portal mode if the backend cannot be asked', async () => {
    const loaded = store.load();
    httpMock.expectOne(CONFIG_URL).flush(null, { status: 503, statusText: 'Unavailable' });
    await loaded;

    expect(store.mode()).toBe(OperatingMode.Portal);
  });
});
