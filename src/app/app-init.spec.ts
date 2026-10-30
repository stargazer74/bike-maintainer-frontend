import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router, withDisabledInitialNavigation } from '@angular/router';
import { Component } from '@angular/core';
import { OperatingMode } from './api-client';
import { startApp } from './app-init';
import { translocoTesting } from './i18n/testing';

@Component({ template: '' })
class Page {}

describe('startApp', () => {
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [
        provideHttpClientTesting(),
        provideRouter([{ path: '**', component: Page }], withDisabledInitialNavigation()),
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => httpMock.verify());

  it('navigates only after the mode and the session are known', async () => {
    const initialNavigation = vi.spyOn(router, 'initialNavigation');
    const started = TestBed.runInInjectionContext(() => startApp());

    httpMock.expectOne('http://localhost/api/v1/config').flush({ mode: OperatingMode.Household });
    await new Promise((resolve) => setTimeout(resolve));
    expect(initialNavigation).not.toHaveBeenCalled();

    httpMock
      .expectOne('http://localhost/api/v1/auth/me')
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    await started;

    expect(initialNavigation).toHaveBeenCalledOnce();
  });
});
