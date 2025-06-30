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

/**
 * GET /api/candidates/:candidateId/experience - Get work experience
 */
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

/**
 * POST /api/candidates/:candidateId/experience - Add experience
 */
router.post('/:candidateId/experience',
    candidateExists,
    validation.requireFields(['company', 'position', 'startDate']),
    validation.validateDatesMiddleware(['startDate', 'endDate']),
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

/**
 * PUT /api/candidates/:candidateId/experience/:expId - Update experience
 */
router.put('/:candidateId/experience/:expId',
    candidateExists,
    validation.validateDatesMiddleware(['startDate', 'endDate']),
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

/**
 * DELETE /api/candidates/:candidateId/experience/:expId - Remove experience
 */
router.delete('/:candidateId/experience/:expId',
    candidateExists,
    asyncHandler(async (req: Request, res: Response) => {
        const { candidateId, expId } = req.params;
        
        await experienceService.deleteExperience(candidateId, expId);
        
        res.json({
            success: true,
            message: 'Experience removed successfully'
        });
    })
);

// Error handling middleware
router.use(errorHandler);

export default router;
