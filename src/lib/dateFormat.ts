/**
 * Date and Time Formatting Utility
 * Provides Go/Hugo `time.Format` (dateFormat) layout support,
 * timestamp extraction, and ISO conversion.
 *
 * Reference: Mon Jan 2 15:04:05 MST 2006 (-0700)
 * Example:
 *   timeFormat("2 Jan 2006", "2023-10-15T13:18:50-07:00") -> "15 Oct 2023"
 */

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const DAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Converts various date/time input types into a valid Date object.
 * Returns null if the input is invalid or empty.
 */
export function asTime(input: string | number | Date | null | undefined): Date | null {
  if (input === null || input === undefined || input === '') {
    return null;
  }
  if (input instanceof Date) {
    return isNaN(input.getTime()) ? null : input;
  }
  if (typeof input === 'number') {
    const d = new Date(input);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return null;
    // Handle numeric string timestamps
    if (/^\d{10,13}$/.test(trimmed)) {
      const num = Number(trimmed);
      const d = new Date(trimmed.length === 10 ? num * 1000 : num);
      return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Format a Date using Go/Hugo layout syntax.
 * Alias: dateFormat
 *
 * Common layouts:
 * - "2 Jan 2006" -> "15 Oct 2023"
 * - "02 Jan 2006" -> "15 Oct 2023"
 * - "2 January 2006" -> "15 October 2023"
 * - "2006-01-02" -> "2023-10-15"
 * - "2 Jan 2006, 15:04" -> "15 Oct 2023, 13:18"
 * - "15:04" -> "13:18"
 */
export function timeFormat(
  layout: string = '2 Jan 2006',
  input: string | number | Date | null | undefined
): string {
  const date = asTime(input);
  if (!date) return '';

  const year = date.getFullYear();
  const year2 = String(year).slice(-2);
  const monthIdx = date.getMonth();
  const monthNum = monthIdx + 1;
  const month01 = String(monthNum).padStart(2, '0');
  const monthName = MONTH_NAMES[monthIdx];
  const monthShort = MONTH_NAMES_SHORT[monthIdx];

  const dayOfMonth = date.getDate();
  const day02 = String(dayOfMonth).padStart(2, '0');
  const dayOfWeek = date.getDay();
  const dayName = DAY_NAMES[dayOfWeek];
  const dayShort = DAY_NAMES_SHORT[dayOfWeek];

  const hours24 = date.getHours();
  const hours15 = String(hours24).padStart(2, '0');
  const hours12 = hours24 % 12 || 12;
  const hours03 = String(hours12).padStart(2, '0');

  const minutes = date.getMinutes();
  const minutes04 = String(minutes).padStart(2, '0');

  const seconds = date.getSeconds();
  const seconds05 = String(seconds).padStart(2, '0');

  const isPM = hours24 >= 12;
  const ampmUpper = isPM ? 'PM' : 'AM';
  const ampmLower = isPM ? 'pm' : 'am';

  // Timezone offset
  const tzOffsetMin = -date.getTimezoneOffset();
  const tzSign = tzOffsetMin >= 0 ? '+' : '-';
  const tzAbsMin = Math.abs(tzOffsetMin);
  const tzHours = String(Math.floor(tzAbsMin / 60)).padStart(2, '0');
  const tzMins = String(tzAbsMin % 60).padStart(2, '0');
  const tzFormatted = `${tzSign}${tzHours}:${tzMins}`;

  // Single-pass regex replacement matching longest tokens first to avoid any collision
  const tokenMap: Record<string, string> = {
    'Monday': dayName,
    'Mon': dayShort,
    'January': monthName,
    'Jan': monthShort,
    '2006': String(year),
    '15': hours15,
    '03': hours03,
    '04': minutes04,
    '05': seconds05,
    '01': month01,
    '02': day02,
    '06': year2,
    'PM': ampmUpper,
    'pm': ampmLower,
    'Z07:00': tzFormatted,
    '-07:00': tzFormatted,
    '+07:00': tzFormatted,
  };

  return layout.replace(
    /Monday|Mon|January|Jan|2006|15|03|04|05|01|02|06|PM|pm|Z07:00|-07:00|\+07:00|(?<![0-9])3(?![0-9])|(?<![0-9])4(?![0-9])|(?<![0-9])5(?![0-9])|(?<![0-9])1(?![0-9])|(?<![0-9])2(?![0-9])/g,
    (match) => {
      if (tokenMap[match] !== undefined) return tokenMap[match];
      if (match === '3') return String(hours12);
      if (match === '4') return String(minutes);
      if (match === '5') return String(seconds);
      if (match === '1') return String(monthNum);
      if (match === '2') return String(dayOfMonth);
      return match;
    }
  );
}

/**
 * Hugo / Go alias for timeFormat
 */
export const dateFormat = timeFormat;

/**
 * Extracts a numeric timestamp (epoch milliseconds) for sorting.
 * Checks item.frontmatter.date -> item.date -> item.updatedAt -> item.createdAt -> item.release_date -> item.first_air_date.
 */
export function getPostTimestamp(item: any): number {
  if (!item) return 0;

  // 1. Direct frontmatter or object date field (ISO string or timestamp)
  const dateVal = item.frontmatter?.date || item.indexFrontmatter?.date || item.date;
  if (dateVal) {
    const d = asTime(dateVal);
    if (d) return d.getTime();
  }

  // 2. UpdatedAt timestamp
  const upVal = item.updatedAt || item.frontmatter?.updatedAt || item.indexFrontmatter?.updatedAt;
  if (upVal) {
    const d = asTime(upVal);
    if (d) return d.getTime();
  }

  // 3. CreatedAt timestamp
  const crVal = item.createdAt || item.frontmatter?.createdAt || item.indexFrontmatter?.createdAt;
  if (crVal) {
    const d = asTime(crVal);
    if (d) return d.getTime();
  }

  // 4. Release date or first air date
  const relVal = item.release_date || item.first_air_date || item.frontmatter?.release_date;
  if (relVal) {
    const d = asTime(relVal);
    if (d) return d.getTime();
  }

  return 0;
}

/**
 * Formats a post's date into "2 Jan 2006" (e.g. "15 Oct 2023")
 */
export function formatPostDate(item: any, layout: string = '2 Jan 2006'): string {
  if (!item) return '';
  const dateVal = item.frontmatter?.date || item.indexFrontmatter?.date || item.date || item.updatedAt || item.createdAt;
  if (dateVal) {
    return timeFormat(layout, dateVal);
  }
  const relVal = item.release_date || item.first_air_date;
  if (relVal) {
    return timeFormat(layout, relVal);
  }
  return '';
}

/**
 * Formats a date into "YYYY-MM-DDTHH:mm" for HTML `<input type="datetime-local">`
 */
export function toDateTimeLocalString(input: string | number | Date | null | undefined): string {
  const d = asTime(input) || new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${mins}`;
}
