import { Router, Request, Response } from 'express';
import { ExperienceService } from '../services/ExperienceService';
import { asyncHandler, errorHandler } from './middleware/errorHandler';
import { candidateExists } from './middleware/candidateExists';
import { validation } from './middleware/validation';
const router = Router();
const experienceService = new ExperienceService();
// ====================
// EXPERIENCE ENDPOINTS
// ====================
router.get('/:candidateId/experience',
    candidateExists,
    asyncHandler(async (req: Request, res: Response) => {
        const { candidateId } = req.params;
        const experience = await experienceService.getExperience(candidateId);
        res.json({
            success: true,
            data: experience
        });
    })
);
router.post('/:candidateId/experience',
    candidateExists,
    asyncHandler(async (req: Request, res: Response) => {
        const { candidateId } = req.params;
        const experienceData = req.body;
        await experienceService.addExperience(candidateId, experienceData);
        res.status(201).json({
            success: true,
            message: 'Experience added successfully'
        });
    })
);
router.put('/:candidateId/experience/:expId',
    candidateExists,
    asyncHandler(async (req: Request, res: Response) => {
        const { candidateId, expId } = req.params;
        const updateData = req.body;
        await experienceService.updateExperience(candidateId, expId, updateData);
        res.json({
            success: true,
            message: 'Experience updated successfully'
        });
    })
);
router.delete('/:candidateId/experience/:expId',
    candidateExists,
    asyncHandler(async (req: Request, res: Response) => {
        const { candidateId, expId } = req.params;
        await experienceService.deleteExperience(candidateId, expId);
        res.json({
            success: true,
            message: 'Experience soft deleted successfully'
        });
    })
);

// Restore soft deleted experience
router.patch('/:candidateId/experience/:expId/restore',
    candidateExists,
    asyncHandler(async (req: Request, res: Response) => {
        const { candidateId, expId } = req.params;
        await experienceService.restoreExperience(candidateId, expId);
        res.json({
            success: true,
            message: 'Experience restored successfully'
        });
    })
);

// Hard delete experience (permanent removal)
router.delete('/:candidateId/experience/:expId/hard',
    candidateExists,
    asyncHandler(async (req: Request, res: Response) => {
        const { candidateId, expId } = req.params;
        await experienceService.hardDeleteExperience(candidateId, expId);
        res.json({
            success: true,
            message: 'Experience permanently deleted'
        });
    })
);
// Error handling middleware
router.use(errorHandler);
export default router;
