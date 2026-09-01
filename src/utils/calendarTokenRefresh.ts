import { google } from 'googleapis';
import { Client } from '@microsoft/microsoft-graph-client';
import fetch from 'node-fetch';
import { decrypt, encrypt } from '../utils/crypto';
import { dbCommand } from '../api/db';
import type { CalendarIntegration } from '../models/CalendarIntegration';

/** Refresh Google access token using refresh token */
async function refreshGoogleToken(integration: CalendarIntegration): Promise<CalendarIntegration> {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.CALLBACK_URL,
  );
  const refreshToken = decrypt(integration.encryptedRefreshToken);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await oauth2Client.refreshAccessToken();
  if (!credentials.access_token || !credentials.expiry_date) {
    throw new Error('Failed to refresh Google token');
  }
  const updated: CalendarIntegration = {
    ...integration,
    encryptedAccessToken: encrypt(credentials.access_token),
    expiresAt: new Date(credentials.expiry_date),
  };
  const coll = dbCommand.collection('calendar_integrations');
  await coll.updateOne({ _id: integration._id }, { $set: updated });
  return updated;
}

/** Refresh Outlook access token using Microsoft identity platform */
async function refreshOutlookToken(integration: CalendarIntegration): Promise<CalendarIntegration> {
  const refreshToken = decrypt(integration.encryptedRefreshToken);
  const tokenEndpoint = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
  const params = new URLSearchParams({
    client_id: process.env.OUTLOOK_CLIENT_ID ?? '',
    client_secret: process.env.OUTLOOK_CLIENT_SECRET ?? '',
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    scope: 'https://graph.microsoft.com/.default',
  });
  const res = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  if (!res.ok) {
    throw new Error('Failed to refresh Outlook token');
  }
  const data = await res.json();
  const updated: CalendarIntegration = {
    ...integration,
    encryptedAccessToken: encrypt(data.access_token),
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
  const coll = dbCommand.collection('calendar_integrations');
  await coll.updateOne({ _id: integration._id }, { $set: updated });
  return updated;
}

/** Ensure a valid access token, refreshing it if expired */
export async function getValidAccessToken(integration: CalendarIntegration): Promise<{ provider: 'google' | 'outlook'; accessToken: string }> {
  if (integration.expiresAt.getTime() <= Date.now()) {
    if (integration.provider === 'google') {
      integration = await refreshGoogleToken(integration);
    } else {
      integration = await refreshOutlookToken(integration);
    }
  }
  return { provider: integration.provider, accessToken: decrypt(integration.encryptedAccessToken) };
}
