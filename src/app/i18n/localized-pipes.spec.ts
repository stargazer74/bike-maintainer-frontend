import { TestBed } from '@angular/core/testing';
import { LanguageService } from './language';
import { LocalDatePipe, LocalNumberPipe } from './localized-pipes';
import { translocoTesting } from './testing';
import './i18n.config';

describe('localized pipes', () => {
  let language: LanguageService;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [translocoTesting()] });
    language = TestBed.inject(LanguageService);
  });

  function transformNumber(value: number | null | undefined): string {
    return TestBed.runInInjectionContext(() => new LocalNumberPipe()).transform(value);
  }

  function transformDate(value: string | null | undefined): string {
    return TestBed.runInInjectionContext(() => new LocalDatePipe()).transform(value);
  }

  it('formats numbers with the separators of the active language', async () => {
    await language.use('de', false);
    expect(transformNumber(12500)).toBe('12.500');

    await language.use('en', false);
    expect(transformNumber(12500)).toBe('12,500');
  });

  it('formats dates in the style of the active language', async () => {
    await language.use('de', false);
    expect(transformDate('2026-10-09')).toBe('09.10.2026');

    await language.use('en', false);
    expect(transformDate('2026-10-09')).toBe('9 Oct 2026');
  });

  it('renders missing values as empty text', () => {
    expect(transformNumber(null)).toBe('');
    expect(transformDate(undefined)).toBe('');
  });
});
