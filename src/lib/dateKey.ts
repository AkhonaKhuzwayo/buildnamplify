const SOUTH_AFRICA_TIMEZONE = 'Africa/Johannesburg';

export function getSouthAfricaDateKey(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SOUTH_AFRICA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

export function getSouthAfricaDateKeyFromTimestamp(timestamp: { toDate?: () => Date } | null | undefined): string | null {
  if (!timestamp?.toDate) return null;
  return getSouthAfricaDateKey(timestamp.toDate());
}
