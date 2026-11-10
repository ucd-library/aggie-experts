const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * @description Formats a Date as a sortable YYYY-MM-DD string, UTC.
 * @param {Date} date
 * @returns {string}
 */
function toDateString(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * @description Parses a YYYY-MM-DD string into a UTC Date at midnight, throwing
 * if the string isn't a valid calendar date.
 * @param {string} value
 * @param {string} label - Name used in error messages (e.g. "--start").
 * @returns {Date}
 */
function parseDateString(value, label) {
  if (!DATE_RE.test(value)) {
    throw new Error(`${label} must be a YYYY-MM-DD date, got "${value}"`);
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || toDateString(date) !== value) {
    throw new Error(`${label} is not a valid calendar date: "${value}"`);
  }
  return date;
}

/**
 * @description Resolves a {sinceDate, untilDate} pair from CLI flags, enforcing
 * the precedence and validation rules shared by every command: --days and
 * --start/--end are mutually exclusive, --start/--end must be given together,
 * both must be valid non-future dates with start <= end, and a bare --days
 * (or no flags at all) resolves to a window ending today (UTC).
 * @param {Object} [opts={}]
 * @param {number} [opts.days] - Convenience window in days, ending today (UTC).
 * @param {string} [opts.start] - YYYY-MM-DD, inclusive.
 * @param {string} [opts.end] - YYYY-MM-DD, inclusive.
 * @param {number} [opts.defaultDays=30] - Used when neither days nor start/end given.
 * @returns {{sinceDate: string, untilDate: string}} Both YYYY-MM-DD, UTC, sortable.
 */
export function resolveDateRange({ days, start, end, defaultDays = 30 } = {}) {
  const hasDays = days !== undefined && days !== null;
  const hasStart = start !== undefined && start !== null;
  const hasEnd = end !== undefined && end !== null;

  if (hasDays && (hasStart || hasEnd)) {
    throw new Error('Pass either --days or --start/--end, not both');
  }
  if (hasStart !== hasEnd) {
    throw new Error('--start requires --end (and vice versa)');
  }

  const todayUtc = toDateString(new Date());

  if (hasStart && hasEnd) {
    parseDateString(start, '--start');
    parseDateString(end, '--end');
    if (start > end) {
      throw new Error(`--start (${start}) must not be after --end (${end})`);
    }
    if (end > todayUtc) {
      throw new Error(`--end (${end}) must not be in the future`);
    }
    return { sinceDate: start, untilDate: end };
  }

  const windowDays = hasDays ? days : defaultDays;
  if (!Number.isInteger(windowDays) || windowDays < 1) {
    throw new Error(`--days must be a positive integer, got "${days}"`);
  }

  const until = new Date(`${todayUtc}T00:00:00Z`);
  const since = new Date(until);
  since.setUTCDate(since.getUTCDate() - (windowDays - 1));

  return { sinceDate: toDateString(since), untilDate: toDateString(until) };
}

export default resolveDateRange;
