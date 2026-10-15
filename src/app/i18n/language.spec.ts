import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { LanguageService } from './language';
import { translocoTesting } from './testing';

describe('LanguageService', () => {
  let service: LanguageService;
  let document: Document;

  function setBrowserLanguages(languages: string[]): void {
    vi.spyOn(document.defaultView!.navigator, 'languages', 'get').mockReturnValue(languages);
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ imports: [translocoTesting()] });
    service = TestBed.inject(LanguageService);
    document = TestBed.inject(DOCUMENT);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('starts with the stored language', async () => {
    localStorage.setItem('bm.language', 'en');
    setBrowserLanguages(['de-DE']);

    await service.initialize();

    expect(service.lang()).toBe('en');
  });

  it('falls back to the first supported browser language', async () => {
    setBrowserLanguages(['fr-FR', 'en-US', 'de-DE']);

    await service.initialize();

    expect(service.lang()).toBe('en');
  });

  it('falls back to German when no browser language is supported', async () => {
    setBrowserLanguages(['fr-FR', 'es-ES']);

    await service.initialize();

    expect(service.lang()).toBe('de');
    expect(service.locale()).toBe('de-DE');
  });

  it('ignores an invalid stored value', async () => {
    localStorage.setItem('bm.language', 'xx');
    setBrowserLanguages(['de-AT']);

    await service.initialize();

    expect(service.lang()).toBe('de');
  });

  it('does not remember the detected initial language', async () => {
    setBrowserLanguages(['en-GB']);

    await service.initialize();

    expect(localStorage.getItem('bm.language')).toBeNull();
  });

  it('switches Transloco, locale and <html lang> and remembers the choice', async () => {
    await service.use('en');

    expect(service.lang()).toBe('en');
    expect(service.locale()).toBe('en-GB');
    expect(TestBed.inject(TranslocoService).getActiveLang()).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(localStorage.getItem('bm.language')).toBe('en');
  });
});
