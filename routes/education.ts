import { Router, Request, Response } from 'express';
import { EducationService } from '../services/EducationService';
import { asyncHandler, errorHandler } from './middleware/errorHandler';
import { candidateExists } from './middleware/candidateExists';
import { validation } from './middleware/validation';

const router = Router();
const educationService = new EducationService();

// ====================
// EDUCATION ENDPOINTS
// ====================

/**
 * GET /api/candidates/:candidateId/education - Get education history
 */
router.get('/:candidateId/education',
    candidateExists,
    asyncHandler(async (req: Request, res: Response) => {
        const { candidateId } = req.params;
        const education = await educationService.getEducation(candidateId);
        
        res.json({
            success: true,
            data: education
        });
    })
);

/**
 * POST /api/candidates/:candidateId/education - Add education
 */
router.post('/:candidateId/education',
    candidateExists,
    validation.requireFields(['institution', 'startDate']),
    validation.validateDatesMiddleware(['startDate', 'endDate']),
    asyncHandler(async (req: Request, res: Response) => {
        const { candidateId } = req.params;
        const educationData = req.body;

        await educationService.addEducation(candidateId, educationData);
        
        res.status(201).json({
            success: true,
            message: 'Education added successfully'
        });
    })
);

/**
 * PUT /api/candidates/:candidateId/education/:eduId - Update education
 */
router.put('/:candidateId/education/:eduId',
    candidateExists,
    validation.validateDatesMiddleware(['startDate', 'endDate']),
    asyncHandler(async (req: Request, res: Response) => {
        const { candidateId, eduId } = req.params;
        const updateData = req.body;
        
        await educationService.updateEducation(candidateId, eduId, updateData);
        
        res.json({
            success: true,
            message: 'Education updated successfully'
        });
    })
);

/**
 * DELETE /api/candidates/:candidateId/education/:eduId - Remove education
 */
router.delete('/:candidateId/education/:eduId',
    candidateExists,
    asyncHandler(async (req: Request, res: Response) => {
        const { candidateId, eduId } = req.params;
        
        await educationService.deleteEducation(candidateId, eduId);
        
        res.json({
            success: true,
            message: 'Education removed successfully'
        });
    })
);

// Error handling middleware
router.use(errorHandler);

export default router;
