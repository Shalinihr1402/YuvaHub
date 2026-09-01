import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { EventWaitlist } from '../../models/EventWaitlist';
import { addWaitlistPromotionJob } from '../../queues/eventWaitlistQueue';
import { logger } from '../../utils/logger';

const getEventId = (value?: string | string[]) => Array.isArray(value) ? value[0] : value ?? '';

/**
 * Adds a user to the waitlist for a specific event.
 */
export const joinWaitlist = async (req: Request, res: Response) => {
    try {
        const eventIdParam = getEventId(req.params.eventId);
        const userId = (req as any).user?.uid;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!eventIdParam) {
            return res.status(400).json({ error: 'Event ID is required' });
        }

        const eventObjectId = new mongoose.Types.ObjectId(eventIdParam);

        // Check if user is already registered or waiting
        const existingEntry = await EventWaitlist.findOne({ eventId: eventObjectId, userId });
        if (existingEntry) {
            return res.status(400).json({ error: 'Already in waitlist or registered' });
        }

        // Calculate position
        const waitingCount = await EventWaitlist.countDocuments({ eventId: eventObjectId, status: 'waiting' });
        const newPosition = waitingCount + 1;

        const newEntry = await EventWaitlist.create({
            eventId: eventObjectId,
            userId,
            position: newPosition,
            status: 'waiting',
        });

        res.status(201).json({
            message: 'Successfully joined waitlist',
            data: { position: newPosition, eventId: eventObjectId.toString() }
        });
    } catch (error: any) {
        logger.error({ err: error }, 'Error joining waitlist');
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Handles a user claiming a promoted waitlist spot.
 */
export const claimWaitlistSpot = async (req: Request, res: Response) => {
    try {
        const { token } = req.body;
        const userId = (req as any).user?.uid;

        const entry = await EventWaitlist.findOne({ claimToken: token, userId });

        if (!entry) {
            return res.status(404).json({ error: 'Invalid or expired claim token' });
        }

        if (entry.status !== 'promoted') {
            return res.status(400).json({ error: 'Spot has already been claimed or expired' });
        }

        if (entry.claimExpiresAt && new Date() > entry.claimExpiresAt) {
            entry.status = 'expired';
            await entry.save();
            // Trigger promotion for the next person
            await addWaitlistPromotionJob(entry.eventId.toString());
            return res.status(400).json({ error: 'Claim window has expired' });
        }

        // Register the user for the event (mocked logic)
        entry.status = 'claimed';
        await entry.save();

        // Decrement positions of remaining waiting users
        await EventWaitlist.updateMany(
            { eventId: entry.eventId, status: 'waiting' },
            { $inc: { position: -1 } }
        );

        res.status(200).json({ message: 'Spot successfully claimed!' });
    } catch (error: any) {
        logger.error({ err: error }, 'Error claiming waitlist spot');
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Fetches the current waitlist status for a user and event.
 */
export const getWaitlistStatus = async (req: Request, res: Response) => {
    try {
        const eventId = getEventId(req.params.eventId);
        const userId = (req as any).user?.uid;

        if (!eventId) {
            return res.status(400).json({ error: 'Event ID is required' });
        }

        const entry = await EventWaitlist.findOne({ eventId: new mongoose.Types.ObjectId(eventId), userId });

        if (!entry) {
            return res.status(404).json({ error: 'Not in waitlist' });
        }

        res.status(200).json({
            data: {
                position: entry.position,
                status: entry.status,
                estimatedWaitTime: entry.position * 2, // Mock estimation: 2 hours per position
            }
        });
    } catch (error: any) {
        logger.error({ err: error }, 'Error fetching waitlist status');
        res.status(500).json({ error: 'Internal server error' });
    }
};
