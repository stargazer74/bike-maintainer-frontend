import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { translocoTesting } from '../../../i18n/testing';
import '../../../i18n/i18n.config';
import { NewTaskDraft } from './new-task-draft';
import { MAX_NEW_TASKS, NewTaskEditor } from './new-task-editor';

@Component({
  imports: [NewTaskEditor],
  template: `<app-new-task-editor [(drafts)]="drafts" [showErrors]="showErrors()" />`,
})
class Host {
  readonly drafts = signal<readonly NewTaskDraft[]>([]);
  readonly showErrors = signal(false);
}

describe('NewTaskEditor', () => {
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
    page().querySelector<HTMLButtonElement>('.new-task__add')!.click();
    await fixture.whenStable();
  }

  async function type(selector: string, value: string, index = 0): Promise<void> {
    const input = page().querySelectorAll<HTMLInputElement>(selector)[index];
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  it('adds entries that are one-time by default', async () => {
    await add();
    await type('.new-task__name', 'Bremsleitung getauscht');
    await type('.new-task__description', 'Stahlflex vorne');

    expect(host().drafts()).toEqual([
      expect.objectContaining({
        name: 'Bremsleitung getauscht',
        description: 'Stahlflex vorne',
        recurring: false,
      }),
    ]);
    expect(page().textContent).toContain('einmalige Arbeit');
    expect(page().querySelector('.new-task__interval-km')).toBeNull();
  });

  it('asks for an interval when the work repeats', async () => {
    await add();
    page().querySelector<HTMLInputElement>('.new-task__recurring')!.click();
    await fixture.whenStable();
    await type('.new-task__interval-km', '1000');

    expect(host().drafts()[0]).toEqual(
      expect.objectContaining({ recurring: true, intervalKm: 1000 }),
    );
  });

  it('removes a single entry', async () => {
    await add();
    await add();
    await type('.new-task__name', 'Erste', 0);
    await type('.new-task__name', 'Zweite', 1);

    page().querySelectorAll<HTMLButtonElement>('.new-task__remove')[0].click();
    await fixture.whenStable();

    expect(
      host()
        .drafts()
        .map((draft) => draft.name),
    ).toEqual(['Zweite']);
  });

  it('shows the problems only when asked to', async () => {
    await add();
    expect(page().querySelector('.new-task__error')).toBeNull();

    host().showErrors.set(true);
    await fixture.whenStable();

    expect(page().querySelector('.new-task__error')?.textContent).toContain(
      'Bitte gib einen Namen ein.',
    );
  });

  it('allows no more entries than the backend accepts', async () => {
    for (let i = 0; i < MAX_NEW_TASKS; i++) {
      await add();
    }

    expect(page().querySelectorAll('.new-task')).toHaveLength(MAX_NEW_TASKS);
    expect(page().querySelector('.new-task__add')).toBeNull();
  });
});
