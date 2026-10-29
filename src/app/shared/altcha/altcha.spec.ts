import { TestBed } from '@angular/core/testing';
import { LanguageService } from '../../i18n/language';
import { translocoTesting } from '../../i18n/testing';
import { Altcha } from './altcha';

describe('Altcha', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [translocoTesting()] });
  });

  function create() {
    const fixture = TestBed.createComponent(Altcha);
    fixture.detectChanges();
    const widget = fixture.nativeElement.querySelector('altcha-widget') as HTMLElement;
    return { fixture, component: fixture.componentInstance, widget };
  }

  it('loads the challenge from the backend and solves it automatically', () => {
    const { widget } = create();

    expect(widget.getAttribute('challenge')).toBe('/api/v1/auth/challenge');
    expect(widget.getAttribute('auto')).toBe('onload');
  });

  it('uses the translations of the active language', async () => {
    const { fixture, widget } = create();
    expect(widget.getAttribute('language')).toBe('de');
    expect(globalThis.$altcha.i18n.get('de')?.['label']).toBe('Ich bin kein Roboter');

    await TestBed.inject(LanguageService).use('en', false);
    fixture.detectChanges();

    expect(widget.getAttribute('language')).toBe('en');
    expect(globalThis.$altcha.i18n.get('en')?.['label']).toBe("I'm not a robot");
  });

  it('exposes the payload once the challenge is solved', () => {
    const { component, widget } = create();
    expect(component.payload()).toBeNull();

    widget.dispatchEvent(new CustomEvent('verified', { detail: { payload: 'solved-payload' } }));

    expect(component.payload()).toBe('solved-payload');
  });

  it('forgets the payload when the challenge expires', () => {
    const { component, widget } = create();
    widget.dispatchEvent(new CustomEvent('verified', { detail: { payload: 'solved-payload' } }));

    widget.dispatchEvent(new CustomEvent('statechange', { detail: { state: 'expired' } }));

    expect(component.payload()).toBeNull();
  });

  it('solves a new challenge on reset', () => {
    const { component, widget } = create();
    const resetSpy = vi.fn();
    const verifySpy = vi.fn().mockResolvedValue(null);
    Object.defineProperty(widget, 'reset', { value: resetSpy, configurable: true });
    Object.defineProperty(widget, 'verify', { value: verifySpy, configurable: true });
    widget.dispatchEvent(new CustomEvent('verified', { detail: { payload: 'solved-payload' } }));

    component.reset();

    expect(component.payload()).toBeNull();
    expect(resetSpy).toHaveBeenCalled();
    expect(verifySpy).toHaveBeenCalled();
  });
});
