import { ObjectId } from 'mongodb';

export interface CalendarIntegration {
  _id?: ObjectId;
  userId: string; // matches JWT uid
  provider: 'google' | 'outlook';
  encryptedAccessToken: string;
  encryptedRefreshToken: string;
  expiresAt: Date;
  connectedAt: Date;
}
