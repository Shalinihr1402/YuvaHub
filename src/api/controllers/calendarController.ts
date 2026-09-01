import { Request, Response } from 'express';
import { google } from 'googleapis';
import fetch from 'node-fetch';
import { encrypt } from '../utils/crypto';
import { getValidAccessToken } from '../utils/calendarTokenRefresh';
import { AvailabilityCache } from '../utils/availabilityCache';
import { getFreeSlots, Slot } from '../services/calendarService';
import { dbCommand } from '../api/db';
import type { CalendarIntegration } from '../models/CalendarIntegration';

/** Helper to get user ID from JWT middleware (assumes req.user.uid) */
const getUserId = (req: Request): string => {
  // @ts-ignore – the auth middleware attaches user
  const uid = (req as any).user?.uid;
  if (!uid) throw new Error('Unauthenticated');
  return uid;
};

/** Initiate Google OAuth flow */
export const googleAuthHandler = async (req: Request, res: Response) => {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.CALLBACK_URL}?provider=google`,
  );
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar'],
    prompt: 'consent',
  });
  res.json({ url: authUrl });
};

/** Initiate Outlook OAuth flow */
export const outlookAuthHandler = async (req: Request, res: Response) => {
  const params = new URLSearchParams({
    client_id: process.env.OUTLOOK_CLIENT_ID ?? '',
    response_type: 'code',
    redirect_uri: `${process.env.CALLBACK_URL}?provider=outlook`,
    scope: 'https://graph.microsoft.com/.default offline_access',
    response_mode: 'query',
  });
  const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`;
  res.json({ url: authUrl });
};

/** OAuth callback for both providers */
export const oauthCallbackHandler = async (req: Request, res: Response) => {
  const { code, provider } = req.query as { code: string; provider: string };
  const userId = getUserId(req);
  if (!code || !provider) {
    return res.status(400).json({ error: 'Missing code or provider' });
  }

  if (provider === 'google') {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.CALLBACK_URL}?provider=google`,
    );
    const { tokens } = await oauth2Client.getToken(code);
    if (!tokens.access_token || !tokens.refresh_token) {
      return res.status(400).json({ error: 'Failed to obtain tokens from Google' });
    }
    const integration: CalendarIntegration = {
      userId,
      provider: 'google',
      encryptedAccessToken: encrypt(tokens.access_token),
      encryptedRefreshToken: encrypt(tokens.refresh_token),
      expiresAt: new Date(tokens.expiry_date || Date.now() + 3600 * 1000),
      connectedAt: new Date(),
    };
    await dbCommand.collection('calendar_integrations').updateOne(
      { userId, provider: 'google' },
      { $set: integration },
      { upsert: true },
    );
    return res.json({ success: true, provider: 'google' });
  }

  if (provider === 'outlook') {
    const tokenEndpoint = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
    const params = new URLSearchParams({
      client_id: process.env.OUTLOOK_CLIENT_ID ?? '',
      client_secret: process.env.OUTLOOK_CLIENT_SECRET ?? '',
      code,
      grant_type: 'authorization_code',
      redirect_uri: `${process.env.CALLBACK_URL}?provider=outlook`,
    });
    const tokenRes = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    if (!tokenRes.ok) {
      return res.status(400).json({ error: 'Failed to exchange Outlook code' });
    }
    const data = await tokenRes.json();
    const integration: CalendarIntegration = {
      userId,
      provider: 'outlook',
      encryptedAccessToken: encrypt(data.access_token),
      encryptedRefreshToken: encrypt(data.refresh_token),
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      connectedAt: new Date(),
    };
    await dbCommand.collection('calendar_integrations').updateOne(
      { userId, provider: 'outlook' },
      { $set: integration },
      { upsert: true },
    );
    return res.json({ success: true, provider: 'outlook' });
  }

  res.status(400).json({ error: 'Unsupported provider' });
};

/** Return available free slots for a given date */
export const availabilityHandler = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { date, slotMinutes } = req.query as { date: string; slotMinutes?: string };
    if (!date) return res.status(400).json({ error: 'Missing date query param (YYYY-MM-DD)' });
    const minutes = slotMinutes ? parseInt(slotMinutes, 10) : 30;
    // Try cache first
    const cached = await AvailabilityCache.get(userId, date);
    if (cached) return res.json({ slots: cached });
    const slots = await getFreeSlots(userId, date, minutes);
    await AvailabilityCache.set(userId, date, slots);
    res.json({ slots });
  } catch (err: any) {
    console.error('[Availability] error', err);
    res.status(500).json({ error: err.message ?? 'Internal error' });
  }
};

/** Book an interview slot */
export const bookInterviewHandler = async (req: Request, res: Response) => {
  try {
    const studentId = getUserId(req);
    const { employerId, start, end } = req.body as { employerId: string; start: string; end: string };
    if (!employerId || !start || !end) return res.status(400).json({ error: 'Missing required fields' });
    const date = start.split('T')[0]; // use start date for cache key
    // Verify slot is still free
    const slots = await getFreeSlots(studentId, date);
    const slotExists = slots.some((s) => s.start.toISOString() === start && s.end.toISOString() === end);
    if (!slotExists) return res.status(409).json({ error: 'Slot no longer available' });

    // Obtain valid access token for the student (who owns the calendar)
    const coll = dbCommand.collection('calendar_integrations');
    const integration = (await coll.findOne({ userId: studentId })) as CalendarIntegration | null;
    if (!integration) return res.status(400).json({ error: 'Calendar not connected' });
    const { provider, accessToken } = await getValidAccessToken(integration);

    let meetingLink = '';
    if (provider === 'google') {
      const calendar = google.calendar({ version: 'v3', auth: accessToken });
      const eventRes = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: {
          summary: 'Interview',
          start: { dateTime: start },
          end: { dateTime: end },
          attendees: [
            { email: employerId }, // assume employerId is email; in real code resolve email
          ],
          conferenceData: { createRequest: { requestId: `${Date.now()}` } },
        },
        conferenceDataVersion: 1,
      });
      meetingLink = eventRes.data.hangoutLink ?? '';
    } else {
      // Outlook – create online meeting then event
      const meetingRes = await fetch('https://graph.microsoft.com/v1.0/me/onlineMeetings', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDateTime: start, endDateTime: end, participants: { attendees: [{ emailAddress: { address: employerId } }] } }),
      });
      if (meetingRes.ok) {
        const data = await meetingRes.json();
        meetingLink = data.joinWebUrl;
      }
    }

    const interviewDoc = {
      studentId,
      employerId,
      startTime: new Date(start),
      endTime: new Date(end),
      title: 'Interview',
      meetingLink,
      status: 'scheduled',
      createdAt: new Date(),
    };
    const result = await dbCommand.collection('interviews').insertOne(interviewDoc);
    // Invalidate cache for that day
    await AvailabilityCache.set(studentId, date, []); // simple flush
    res.json({ success: true, interviewId: result.insertedId, meetingLink });
  } catch (err: any) {
    console.error('[Book Interview] error', err);
    res.status(500).json({ error: err.message ?? 'Internal error' });
  }
};

/** Return connected providers for the current user */
export const meHandler = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const integrations = await dbCommand.collection('calendar_integrations').find({ userId }).toArray();
    const providers = integrations.map((i) => i.provider);
    res.json({ providers });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'Internal error' });
  }
};

/** Disconnect a provider */
export const disconnectHandler = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { provider } = req.params;
    await dbCommand.collection('calendar_integrations').deleteOne({ userId, provider });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'Internal error' });
  }
};
