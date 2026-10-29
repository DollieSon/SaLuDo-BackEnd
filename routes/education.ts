import { Router, Request, Response } from 'express';
import { EducationService } from '../services/EducationService';
import { asyncHandler, errorHandler } from './middleware/errorHandler';
import { CandidateAccessMiddleware } from './middleware/candidateAccess';
import { AuthMiddleware } from './middleware/auth';
import { validation } from './middleware/validation';
const router = Router();

// Every route requires an authenticated user; candidate routes also check assignment
router.use(AuthMiddleware.authenticate);
const educationService = new EducationService();
// ====================
// EDUCATION ENDPOINTS
// ====================
router.get('/:candidateId/education',
    CandidateAccessMiddleware.checkCandidateAccess,
    asyncHandler(async (req: Request, res: Response) => {
        const { candidateId } = req.params;
        const education = await educationService.getEducation(candidateId);
        res.json({
            success: true,
            data: education
        });
    })
);
router.post('/:candidateId/education',
    CandidateAccessMiddleware.checkCandidateAccess,
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
router.put('/:candidateId/education/:eduId',
    CandidateAccessMiddleware.checkCandidateAccess,
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
router.delete('/:candidateId/education/:eduId',
    CandidateAccessMiddleware.checkCandidateAccess,
    asyncHandler(async (req: Request, res: Response) => {
        const { candidateId, eduId } = req.params;
        await educationService.deleteEducation(candidateId, eduId);
        res.json({
            success: true,
            message: 'Education soft deleted successfully'
        });
    })
);
// Restore soft deleted education
router.patch('/:candidateId/education/:eduId/restore',
    CandidateAccessMiddleware.checkCandidateAccess,
    asyncHandler(async (req: Request, res: Response) => {
        const { candidateId, eduId } = req.params;
        await educationService.restoreEducation(candidateId, eduId);
        res.json({
            success: true,
            message: 'Education restored successfully'
        });
    })
);
// Hard delete education (permanent removal)
router.delete('/:candidateId/education/:eduId/hard',
    CandidateAccessMiddleware.checkCandidateAccess,
    asyncHandler(async (req: Request, res: Response) => {
        const { candidateId, eduId } = req.params;
        await educationService.hardDeleteEducation(candidateId, eduId);
        res.json({
            success: true,
            message: 'Education permanently deleted'
        });
    })
);
// Error handling middleware
router.use(errorHandler);
export default router;
