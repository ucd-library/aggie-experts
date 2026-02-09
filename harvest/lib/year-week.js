import { Temporal } from '@js-temporal/polyfill';
import config from './config.js';

const TZ = config.timezone;

/**
 * @method getTodaysDate
 * @description Get today's date as a Temporal.PlainDate in the ae configured timezone.
 * 
 * @returns {Temporal.PlainDate} today's date in the ae configured timezone
 */
function getTodaysDate() {
  return Temporal.Now.plainDateISO(TZ);
}

/**
 * @function getYearWeek
 * @description Get the year-week string (format: YYYY-WW) for a given date.  Weeks start on Saturday.
 * Prior to the first Saturday of the year is considered week 52/53 of the previous year.
 * 
 * Note: this math is a pain.  Always use this method to get year-week instead of trying to calculate it yourself.
 * 
 * @param {Object} opts options object
 * @param {Temporal.PlainDate} opts.date original date as Temporal.PlainDate, used for prior year calculations.  Defaults to same value as `date` param.
 * @param {Boolean} opts.allValues if true, will return an object with yearWeek, weekStart, weekEnd, and date
 * @param {Boolean} opts.asString if true, will return year-week as a string instead of an object with all values (overrides opts.allValues)
 * 
 * @returns {String} year-week string in format YYYY-WW
 */
function getYearWeek(opts={}) {
  if( !opts.date ) opts.date = getTodaysDate();
  if( !opts.orgDate ) opts.orgDate = opts.date;

  // IMPORTANT, Don't hand us a JS Date object
  if( !(opts.date instanceof Temporal.PlainDate) ) {
    throw new Error('Date must be a Temporal.PlainDate');
  }

  // find first Saturday of the year
  let yearOffset = new Temporal.PlainDate(opts.date.year, 1, 1).dayOfWeek;
  let firstSat = null

  // if Jan 1 is a Saturday, week 1 starts that day
  if( yearOffset === 6 ) {
    firstSat = new Temporal.PlainDate(opts.date.year, 1, 1);

  // otherwise, week 1 starts the first Saturday on or after Jan 1
  } else {

    // if Jan 1 is a Sunday, week 1 (first sat) starts on Jan 7
    if( yearOffset === 7 ) {
      firstSat = new Temporal.PlainDate(opts.date.year, 1, 7);
    // otherwise, week 1 starts on the first Saturday after Jan 1
    } else {
      firstSat = new Temporal.PlainDate(opts.date.year, 1, 7-yearOffset);
    }

    if( Temporal.PlainDate.compare(opts.date, firstSat) < 0 ) {
      opts.date = new Temporal.PlainDate(opts.date.year-1, 12, 31);
      return getYearWeek(opts);
    }
  }

  // calculate week number, starting with week 1 on first Saturday
  let week = 1, weekStart, weekEnd;
  while( week <= 53 ) {
    weekStart = Temporal.PlainDate.from(firstSat);
    weekStart = weekStart.add({ days: (week-1)*7 });

    weekEnd = Temporal.PlainDate.from(firstSat);
    weekEnd = weekEnd.add({ days: (week*7) - 1 });

    if( Temporal.PlainDate.compare(opts.date, weekStart) >= 0 && 
        Temporal.PlainDate.compare(opts.date, weekEnd) <= 0 ) {
      break;
    }
    week++;
  }

  const year = opts.date.year;

  // pad week with leading zero if needed
  if( (week+'').length === 1 ) week = '0'+week;

  if( opts.allValues ) {
    if( opts.asString ) {
      return {
        yearWeek : year+'-'+week,
        weekStart : weekStart.toString(),
        weekEnd : weekEnd.toString(),
        date: opts.orgDate.toString()
      };
    } 

    return {
      yearWeek : year+'-'+week,
      weekStart,
      weekEnd,
      date: opts.orgDate
    }
  }

  return year+'-'+week;
}

export {
  getYearWeek,
  getTodaysDate
}