export const SV_LOCALE = 'es-SV';
export const SV_TZ = 'America/El_Salvador';
export const SHIFT_LABEL = '11:00 – 03:00';

export function toUTC(value: string): Date {
  const hasZone = /[Zz]$|[+-]\d{2}:\d{2}$/.test(value);
  return new Date(hasZone ? value : value + 'Z');
}

export function fmtSV(value: string | null | undefined): string {
  if (!value) return '—';
  return toUTC(value).toLocaleString(SV_LOCALE, {
    timeZone: SV_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function fmtTimeSV(value: string | null | undefined): string {
  if (!value) return '—';
  return toUTC(value).toLocaleTimeString(SV_LOCALE, {
    timeZone: SV_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function fmtDateSV(value: string | null | undefined): string {
  if (!value) return '—';
  return toUTC(value).toLocaleDateString(SV_LOCALE, {
    timeZone: SV_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function fmtLongDateSV(value: string | null | undefined): string {
  if (!value) return '—';
  const text = toUTC(value).toLocaleDateString(SV_LOCALE, {
    timeZone: SV_TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return text.charAt(0).toUpperCase() + text.slice(1);
}
