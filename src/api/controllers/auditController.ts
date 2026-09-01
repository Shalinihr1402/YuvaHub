import { Request, Response } from 'express';
import { AuditReport } from '../../models/AuditReport';
import { addContentToAuditQueue } from '../../queues/contentAuditQueue';
import { logger } from '../../utils/logger';

const normalizeContentId = (value?: string | string[]) => Array.isArray(value) ? value[0] : value ?? '';

/**
 * Triggers a new audit for a piece of content.
 */
export const triggerAudit = async (req: Request, res: Response) => {
    try {
        const { contentId, contentType } = req.body;

        if (!contentId || !contentType) {
            return res.status(400).json({ error: 'contentId and contentType are required' });
        }

        await addContentToAuditQueue(contentId, contentType);
        res.status(202).json({ message: 'Audit queued successfully' });
    } catch (error: any) {
        logger.error({ err: error }, 'Error triggering audit');
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Fetches the audit report for a specific piece of content.
 */
export const getAuditReport = async (req: Request, res: Response) => {
    try {
        const contentId = normalizeContentId(req.params.contentId);
        const contentType = normalizeContentId(req.params.contentType) as 'event' | 'forum_post' | 'opportunity';

        const report = await AuditReport.findOne({ contentId, contentType }).sort({ createdAt: -1 });

        if (!report) {
            return res.status(404).json({ error: 'No audit report found for this content' });
        }

        res.status(200).json({ data: report });
    } catch (error: any) {
        logger.error({ err: error }, 'Error fetching audit report');
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Marks a specific issue in an audit report as resolved.
 */
export const resolveAuditIssue = async (req: Request, res: Response) => {
    try {
        const { reportId, issueIndex } = req.body;

        const report = await AuditReport.findById(reportId);
        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }

        if (report.issues[issueIndex]) {
            report.issues[issueIndex].resolved = true;

            // Recalculate score
            const unresolvedIssues = report.issues.filter((_, idx) => idx !== issueIndex && !report.issues[idx].resolved);
            // Simplified score recalculation for brevity
            report.accessibilityScore = Math.min(100, report.accessibilityScore + 5);
            report.seoScore = Math.min(100, report.seoScore + 5);

            await report.save();
        }

        res.status(200).json({ message: 'Issue marked as resolved', data: report });
    } catch (error: any) {
        logger.error({ err: error }, 'Error resolving audit issue');
        res.status(500).json({ error: 'Internal server error' });
    }
};
