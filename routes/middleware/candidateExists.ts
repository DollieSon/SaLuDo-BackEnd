import { Request, Response, NextFunction } from 'express';
import { CandidateService } from '../../services/CandidateService';
const candidateService = new CandidateService();
export const candidateExists = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { candidateId } = req.params;
        if (!candidateId) {
            res.status(400).json({
                success: false,
                message: 'Candidate ID is required'
            });
            return;
        }
        const candidate = await candidateService.getCandidate(candidateId);
        if (!candidate) {
            res.status(404).json({
                success: false,
                message: 'Candidate not found'
            });
            return;
        }
        // Add candidate to request object for use in subsequent middleware
        (req as any).candidate = candidate;
        next();
    } catch (error) {
        console.error('Error checking candidate existence:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify candidate',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
