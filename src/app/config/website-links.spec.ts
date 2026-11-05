import { Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { OperatingMode } from '../api-client';
import { LanguageService } from '../i18n/language';
import { translocoTesting } from '../i18n/testing';
import { AppConfigStore } from './app-config-store';
import { injectWebsiteLinks, websiteLinks } from './website-links';

const CONFIG_URL = 'http://localhost/api/v1/config';

describe('websiteLinks', () => {
  it('links to the German pages without prefix', () => {
    expect(websiteLinks('https://www.example.com', 'de')).toEqual({
      home: 'https://www.example.com/',
      imprint: 'https://www.example.com/impressum/',
      privacy: 'https://www.example.com/datenschutz/',
    });
  });

  it('links to the English pages under /en/', () => {
    expect(websiteLinks('https://www.example.com', 'en')).toEqual({
      home: 'https://www.example.com/en/',
      imprint: 'https://www.example.com/en/legal-notice/',
      privacy: 'https://www.example.com/en/privacy/',
    });
  });
});

describe('injectWebsiteLinks', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  async function loadConfig(body: object): Promise<void> {
    const loaded = TestBed.inject(AppConfigStore).load();
    httpMock.expectOne(CONFIG_URL).flush(body);
    await loaded;
  }

  function links() {
    return runInInjectionContext(TestBed.inject(Injector), () => injectWebsiteLinks());
  }

  it('is null without a website', async () => {
    await loadConfig({ mode: OperatingMode.Portal });

    expect(links()()).toBeNull();
  });

  it('follows the active language', async () => {
    await loadConfig({ mode: OperatingMode.Portal, websiteUrl: 'https://www.example.com' });
    const current = links();
    await TestBed.inject(LanguageService).use('de', false);
    expect(current()?.imprint).toBe('https://www.example.com/impressum/');

    await TestBed.inject(LanguageService).use('en', false);
    expect(current()?.imprint).toBe('https://www.example.com/en/legal-notice/');
  });
});
