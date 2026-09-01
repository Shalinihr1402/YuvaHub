import { DateTime, Interval } from 'luxon';
import { getValidAccessToken } from '../utils/calendarTokenRefresh.js';
import { dbCommand } from '../api/db.js';
import type { CalendarIntegration } from '../models/CalendarIntegration.js';

/** Slot representing a free interval for booking */
export interface Slot {
  start: Date; // exact Date object (UTC)
  end: Date;   // exact Date object (UTC)
}

/** Normalized calendar event */
interface NormalizedEvent {
  start: Date;
  end: Date;
}

/** Retrieve raw events from the provider for the given user and date (YYYY-MM-DD) */
async function fetchProviderEvents(integration: CalendarIntegration, date: string): Promise<any[]> {
  const { provider, accessToken } = await getValidAccessToken(integration);
  const dayStart = DateTime.fromISO(date, { zone: 'utc' }).startOf('day');
  const dayEnd = dayStart.endOf('day');

  if (provider === 'google') {
    const { google } = await import('googleapis');
    const calendar = google.calendar({ version: 'v3', auth: accessToken });
    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin: dayStart.toISO(),
      timeMax: dayEnd.toISO(),
      singleEvents: true,
      orderBy: 'startTime',
    });
    return res.data.items ?? [];
  }
  // Outlook / Microsoft Graph
  const graphEndpoint = `https://graph.microsoft.com/v1.0/me/calendarview?startDateTime=${dayStart.toISO()}&endDateTime=${dayEnd.toISO()}`;
  const res = await fetch(graphEndpoint, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Failed to fetch Outlook events');
  const data = await res.json();
  return data.value ?? [];
}

/** Convert raw provider events into a uniform {start, end} structure */
function normalizeEvents(rawEvents: any[], provider: 'google' | 'outlook'): NormalizedEvent[] {
  return rawEvents.map((ev) => {
    if (provider === 'google') {
      const start = ev.start?.dateTime ?? ev.start?.date;
      const end = ev.end?.dateTime ?? ev.end?.date;
      return { start: new Date(start), end: new Date(end) };
    }
    // Outlook event format
    return { start: new Date(ev.start?.dateTime), end: new Date(ev.end?.dateTime) };
  });
}

/** Compute free slots for a given day.
 *   workingHours: start and end hour in 24h format (default 9‑17).
 *   slotMinutes: desired slot length in minutes (default 30).
 */
export function computeFreeSlots(
  events: NormalizedEvent[],
  date: string,
  slotMinutes = 30,
  workingHours = { start: 9, end: 17 }
): Slot[] {
  const dayStart = DateTime.fromISO(date, { zone: 'utc' }).set({ hour: workingHours.start, minute: 0, second: 0 });
  const dayEnd = DateTime.fromISO(date, { zone: 'utc' }).set({ hour: workingHours.end, minute: 0, second: 0 });

  // Merge overlapping busy intervals
  const busy: Interval[] = events
    .map((e) => Interval.fromDateTimes(DateTime.fromJSDate(e.start), DateTime.fromJSDate(e.end)))
    .sort((a, b) => a.start.toMillis() - b.start.toMillis());

  const merged: Interval[] = [];
  for (const i of busy) {
    if (merged.length === 0) {
      merged.push(i);
    } else {
      const last = merged[merged.length - 1];
      if (last.overlaps(i) || last.abutsStart(i)) {
        merged[merged.length - 1] = Interval.fromDateTimes(last.start, DateTime.max(last.end, i.end));
      } else {
        merged.push(i);
      }
    }
  }

  const free: Slot[] = [];
  let cursor = dayStart;
  for (const busyInt of merged) {
    if (busyInt.start > cursor) {
      const gap = Interval.fromDateTimes(cursor, busyInt.start);
      free.push(...sliceInterval(gap, slotMinutes));
    }
    cursor = DateTime.max(cursor, busyInt.end);
  }
  // final gap till end of day
  if (cursor < dayEnd) {
    const gap = Interval.fromDateTimes(cursor, dayEnd);
    free.push(...sliceInterval(gap, slotMinutes));
  }
  return free;
}

/** Slice an Interval into fixed‑length slots (in minutes) */
function sliceInterval(interval: Interval, slotMinutes: number): Slot[] {
  const slots: Slot[] = [];
  let start = interval.start;
  const end = interval.end;
  const dur = { minutes: slotMinutes };
  while (start.plus(dur) <= end) {
    slots.push({ start: start.toJSDate(), end: start.plus(dur).toJSDate() });
    start = start.plus(dur);
  }
  return slots;
}

/** Public API: get free slots for a user on a specific date */
export async function getFreeSlots(userId: string, date: string, slotMinutes = 30): Promise<Slot[]> {
  const coll = dbCommand.collection('calendar_integrations');
  const integration = (await coll.findOne({ userId })) as CalendarIntegration | null;
  if (!integration) return [];
  const raw = await fetchProviderEvents(integration, date);
  const norm = normalizeEvents(raw, integration.provider);
  return computeFreeSlots(norm, date, slotMinutes);
}
