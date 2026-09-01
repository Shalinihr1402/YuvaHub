import { Router } from 'express';
import {
  googleAuthHandler,
  outlookAuthHandler,
  oauthCallbackHandler,
  availabilityHandler,
  bookInterviewHandler,
  meHandler,
  disconnectHandler,
} from '../controllers/calendarController.js';

const router = Router();

// Initiate OAuth flows
router.post('/google/auth', googleAuthHandler);
router.post('/outlook/auth', outlookAuthHandler);

// OAuth callback (both providers redirect here with ?code=...&provider=...)
router.get('/callback', oauthCallbackHandler);

// Availability and booking
router.get('/availability', availabilityHandler);
router.post('/book', bookInterviewHandler);

// Connection status
router.get('/me', meHandler);
router.delete('/:provider', disconnectHandler);

export default router;
