import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CostSummaryEntry, Currency } from '../../../api-client';
import { translocoTesting } from '../../../i18n/testing';
import '../../../i18n/i18n.config';
import { CostTile } from './cost-tile';

@Component({
  imports: [CostTile],
  template: `<app-cost-tile [entries]="entries()" />`,
})
class Host {
  readonly entries = signal<CostSummaryEntry[]>([]);
}

const NBSP = /\u00a0/g;

describe('CostTile', () => {
  let fixture: ComponentFixture<Host>;

  async function render(entries: CostSummaryEntry[]): Promise<void> {
    TestBed.configureTestingModule({ imports: [translocoTesting()] });
    fixture = TestBed.createComponent(Host);
    fixture.componentInstance.entries.set(entries);
    fixture.autoDetectChanges();
    await fixture.whenStable();
  }

  function text(selector: string): string[] {
    const root = fixture.nativeElement as HTMLElement;
    return [...root.querySelectorAll(selector)].map((el) =>
      (el.textContent ?? '').replace(NBSP, ' ').trim(),
    );
  }

  it('shows total and current year for one currency', async () => {
    await render([{ currency: Currency.Eur, total: 1234.5, currentYear: 80 }]);

    expect(text('.cost-tile__row')).toHaveLength(1);
    expect(text('.cost-tile__total .cost-tile__value')).toEqual(['1.234,50 €']);
    expect(text('.cost-tile__year .cost-tile__value')).toEqual(['80,00 €']);
    expect(text('.cost-tile__empty')).toEqual([]);
  });

  it('shows one row per currency in the given order', async () => {
    await render([
      { currency: Currency.Chf, total: 10, currentYear: 0 },
      { currency: Currency.Eur, total: 20.25, currentYear: 5 },
    ]);

    expect(text('.cost-tile__row')).toHaveLength(2);
    const totals = text('.cost-tile__total .cost-tile__value');
    expect(totals[0]).toContain('CHF');
    expect(totals[1]).toBe('20,25 €');
  });

  it('shows the empty state without entries', async () => {
    await render([]);

    expect(text('.cost-tile__empty')).toEqual(['Noch keine Kosten erfasst']);
    expect(text('.cost-tile__row')).toHaveLength(0);
  });
});
