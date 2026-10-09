import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';
import { translocoTesting } from './i18n/testing';

describe('App', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App, translocoTesting()],
      providers: [provideRouter(routes), provideHttpClientTesting()],
    })
      .compileComponents();
  });

  afterEach(() => localStorage.clear());

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the shell with the app brand name', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const httpMock = TestBed.inject(HttpTestingController);
    httpMock.expectOne('http://localhost/api/v1/vehicles').flush([]);

    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Bike Maintainer');
    expect(compiled.textContent).toContain('Bike hinzufügen');
  });

  it('switches the UI to English via the language switcher', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController).expectOne('http://localhost/api/v1/vehicles').flush([]);
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    const englishButton = [...compiled.querySelectorAll<HTMLButtonElement>('.shell__language-option')].find(
      (button) => button.textContent?.trim() === 'EN',
    )!;
    englishButton.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(compiled.textContent).toContain('Add bike');
    expect(compiled.textContent).not.toContain('Bike hinzufügen');
    expect(englishButton.getAttribute('aria-pressed')).toBe('true');
    expect(localStorage.getItem('bm.language')).toBe('en');
  });
});
