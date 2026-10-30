import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MaterialUnit } from '../../../api-client';
import { translocoTesting } from '../../../i18n/testing';
import '../../../i18n/i18n.config';
import { MaterialDraft } from './material-draft';
import { MAX_MATERIALS, MaterialEditor } from './material-editor';

@Component({
  imports: [MaterialEditor],
  template: `<app-material-editor
    [(drafts)]="drafts"
    [tasks]="tasks()"
    [currency]="'EUR'"
    [showErrors]="showErrors()"
  />`,
})
class Host {
  readonly drafts = signal<readonly MaterialDraft[]>([]);
  readonly tasks = signal([
    { id: 1, name: 'Ölwechsel' },
    { id: 2, name: 'Kettenpflege' },
  ]);
  readonly showErrors = signal(false);
}

const NBSP = /\u00a0/g;

describe('MaterialEditor', () => {
  let fixture: ComponentFixture<Host>;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [translocoTesting()] });
    fixture = TestBed.createComponent(Host);
    fixture.autoDetectChanges();
    await fixture.whenStable();
  });

  function page(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function host(): Host {
    return fixture.componentInstance;
  }

  async function add(): Promise<void> {
    page().querySelector<HTMLButtonElement>('.material__add')!.click();
    await fixture.whenStable();
  }

  async function type(selector: string, value: string, index = 0): Promise<void> {
    const input = page().querySelectorAll<HTMLInputElement>(selector)[index];
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  async function choose(selector: string, optionIndex: number, index = 0): Promise<void> {
    const select = page().querySelectorAll<HTMLSelectElement>(selector)[index];
    select.selectedIndex = optionIndex;
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
  }

  it('adds a row with one piece by default and takes the entered values', async () => {
    await add();
    await type('.material__name', 'Motoröl');
    await type('.material__quantity', '1.5');
    await choose('.material__unit', 1);
    await type('.material__price', '12.5');

    expect(host().drafts()).toEqual([
      expect.objectContaining({
        name: 'Motoröl',
        quantity: 1.5,
        unit: MaterialUnit.Liter,
        price: 12.5,
        taskId: null,
      }),
    ]);
  });

  it('starts every row with quantity 1 and the unit piece', async () => {
    await add();

    expect(host().drafts()[0]).toEqual(
      expect.objectContaining({ quantity: 1, unit: MaterialUnit.Piece }),
    );
    expect(page().querySelector('.material__unit')?.textContent).toContain('Stk.');
  });

  it('removes a single row', async () => {
    await add();
    await add();
    await type('.material__name', 'Erste', 0);
    await type('.material__name', 'Zweite', 1);

    page().querySelectorAll<HTMLButtonElement>('.material__remove')[0].click();
    await fixture.whenStable();

    expect(
      host()
        .drafts()
        .map((row) => row.name),
    ).toEqual(['Zweite']);
  });

  it('offers only the given tasks and no task', async () => {
    await add();
    const options = Array.from(
      page().querySelectorAll<HTMLOptionElement>('.material__task option'),
    ).map((option) => option.textContent?.trim());
    expect(options).toEqual(['— keine Aufgabe —', 'Ölwechsel', 'Kettenpflege']);

    host().tasks.set([{ id: 2, name: 'Kettenpflege' }]);
    await fixture.whenStable();

    expect(page().querySelectorAll('.material__task option')).toHaveLength(2);
  });

  it('assigns a task and shows a no longer offered task as no task', async () => {
    await add();
    await choose('.material__task', 2);
    expect(host().drafts()[0].taskId).toBe(2);

    host().tasks.set([{ id: 1, name: 'Ölwechsel' }]);
    await fixture.whenStable();

    const select = page().querySelector<HTMLSelectElement>('.material__task')!;
    expect(select.selectedOptions[0].textContent?.trim()).toBe('— keine Aufgabe —');
  });

  it('sums the prices exactly', async () => {
    expect(page().querySelector('.material__total')).toBeNull();

    await add();
    await add();
    await type('.material__price', '0.1', 0);
    await type('.material__price', '0.2', 1);

    expect(page().querySelector('.material__total-value')?.textContent?.replace(NBSP, ' ')).toBe(
      '0,30 €',
    );
  });

  it('shows the problems only when asked to', async () => {
    await add();
    expect(page().querySelector('.material__error')).toBeNull();

    host().showErrors.set(true);
    await fixture.whenStable();

    expect(page().querySelector('.material__error')?.textContent).toContain(
      'Bitte gib eine Bezeichnung ein.',
    );

    await type('.material__name', 'Öl');
    await type('.material__quantity', '0');
    expect(page().querySelector('.material__error')?.textContent).toContain('Menge');
  });

  it('allows no more rows than the backend accepts', async () => {
    for (let i = 0; i < MAX_MATERIALS; i++) {
      await add();
    }

    expect(page().querySelectorAll('.material')).toHaveLength(MAX_MATERIALS);
    expect(page().querySelector('.material__add')).toBeNull();
  });
});
