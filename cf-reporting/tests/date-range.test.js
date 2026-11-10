import assert from 'assert';
import resolveDateRange from '../lib/date-range.js';

describe('lib/date-range.js', () => {
  it('defaults to a 30-day window ending today when nothing is given', () => {
    const { sinceDate, untilDate } = resolveDateRange({});
    const today = new Date().toISOString().slice(0, 10);
    assert.strictEqual(untilDate, today);

    const since = new Date(`${sinceDate}T00:00:00Z`);
    const until = new Date(`${untilDate}T00:00:00Z`);
    const diffDays = Math.round((until - since) / (24 * 60 * 60 * 1000));
    assert.strictEqual(diffDays, 29);
  });

  it('resolves an explicit --days window ending today', () => {
    const { sinceDate, untilDate } = resolveDateRange({ days: 7 });
    const since = new Date(`${sinceDate}T00:00:00Z`);
    const until = new Date(`${untilDate}T00:00:00Z`);
    const diffDays = Math.round((until - since) / (24 * 60 * 60 * 1000));
    assert.strictEqual(diffDays, 6);
  });

  it('resolves an explicit --start/--end range', () => {
    const result = resolveDateRange({ start: '2026-01-01', end: '2026-01-10' });
    assert.deepStrictEqual(result, { sinceDate: '2026-01-01', untilDate: '2026-01-10' });
  });

  it('throws when both --days and --start/--end are given', () => {
    assert.throws(() => resolveDateRange({ days: 7, start: '2026-01-01', end: '2026-01-10' }), /not both/);
  });

  it('throws when only --start is given', () => {
    assert.throws(() => resolveDateRange({ start: '2026-01-01' }), /requires --end/);
  });

  it('throws when only --end is given', () => {
    assert.throws(() => resolveDateRange({ end: '2026-01-10' }), /requires --end/);
  });

  it('throws when --start is after --end', () => {
    assert.throws(() => resolveDateRange({ start: '2026-01-10', end: '2026-01-01' }), /must not be after/);
  });

  it('throws when --end is in the future', () => {
    const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    assert.throws(() => resolveDateRange({ start: '2026-01-01', end: future }), /must not be in the future/);
  });

  it('throws on a malformed date string', () => {
    assert.throws(() => resolveDateRange({ start: 'not-a-date', end: '2026-01-10' }), /YYYY-MM-DD/);
  });

  it('throws when --days is not a positive integer', () => {
    assert.throws(() => resolveDateRange({ days: 0 }), /positive integer/);
    assert.throws(() => resolveDateRange({ days: -5 }), /positive integer/);
  });
});
