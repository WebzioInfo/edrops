/**
 * Timezone Utility for eDrops Core Scheduling & Delivery Logistics
 * Standard Business Timezone: Asia/Kolkata (IST = UTC+5:30)
 */

export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * Returns a Date object representing UTC midnight for the calendar date in Indian Standard Time (IST).
 * Safe for database Date columns and Prisma @db.Date comparisons.
 */
export function getISTMidnight(inputDate?: Date | string | number): Date {
  const d = inputDate ? new Date(inputDate) : new Date();
  // Shift by +5:30 to get IST calendar components
  const istTime = new Date(d.getTime() + IST_OFFSET_MS);
  return new Date(
    Date.UTC(
      istTime.getUTCFullYear(),
      istTime.getUTCMonth(),
      istTime.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );
}

/**
 * Returns UTC boundaries for the full 24-hour day in IST.
 * Useful for querying orders or deliveries scheduled on a specific IST calendar date.
 */
export function getISTDayRange(inputDate?: Date | string | number): {
  start: Date;
  end: Date;
} {
  const midnight = getISTMidnight(inputDate);
  const nextDay = new Date(midnight.getTime() + 24 * 60 * 60 * 1000);
  return {
    start: midnight,
    end: nextDay,
  };
}

/**
 * Formats a Date object to YYYY-MM-DD string according to IST.
 */
export function formatISTDateString(inputDate: Date | string | number): string {
  const midnight = getISTMidnight(inputDate);
  const year = midnight.getUTCFullYear();
  const month = String(midnight.getUTCMonth() + 1).padStart(2, '0');
  const day = String(midnight.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Checks if two dates fall on the exact same calendar day in IST.
 */
export function isSameISTDay(
  dateA: Date | string | number,
  dateB: Date | string | number,
): boolean {
  return formatISTDateString(dateA) === formatISTDateString(dateB);
}
