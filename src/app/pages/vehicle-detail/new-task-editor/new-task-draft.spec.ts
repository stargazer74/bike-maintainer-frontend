import { draftError, emptyDraft, NewTaskDraft, toNewTaskRequests } from './new-task-draft';

function draft(changes: Partial<NewTaskDraft>): NewTaskDraft {
  return { ...emptyDraft(), ...changes };
}

describe('new task drafts', () => {
  it('gives every draft its own key', () => {
    expect(emptyDraft().key).not.toBe(emptyDraft().key);
  });

  it.each([
    [draft({ name: '  ' }), 'newTask.errors.nameRequired'],
    [draft({ name: 'Kette', recurring: true }), 'newTask.errors.intervalRequired'],
    [draft({ name: 'Kette', recurring: true, intervalKm: 0 }), 'newTask.errors.intervalRequired'],
    [draft({ name: 'Kette', recurring: true, intervalMonths: 6 }), null],
    [draft({ name: 'Spiegel' }), null],
  ])('checks %o', (value, expected) => {
    expect(draftError(value)).toBe(expected);
  });

  it('sends one-time work without an interval and recurring work with it', () => {
    expect(
      toNewTaskRequests([
        draft({ name: ' Spiegel ersetzt ', description: '  ', intervalKm: 500 }),
        draft({ name: 'Kette', description: 'reinigen', recurring: true, intervalKm: 1000 }),
      ]),
    ).toEqual([
      {
        name: 'Spiegel ersetzt',
        description: undefined,
        intervalKm: undefined,
        intervalMonths: undefined,
      },
      { name: 'Kette', description: 'reinigen', intervalKm: 1000, intervalMonths: undefined },
    ]);
  });
});
