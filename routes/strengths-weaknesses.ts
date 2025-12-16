import { Router, Request, Response } from 'express';
import { StrengthWeaknessService } from '../services/StrengthWeaknessService';
import { asyncHandler, errorHandler } from './middleware/errorHandler';
import { candidateExists } from './middleware/candidateExists';
import { validation } from './middleware/validation';
import { AuthMiddleware } from './middleware/auth';
const router = Router();
import { OK, CREATED, BAD_REQUEST, UNAUTHORIZED, NOT_FOUND } from "../constants/HttpStatusCodes";
const strengthWeaknessService = new StrengthWeaknessService();
// ====================
// STRENGTHS & WEAKNESSES ENDPOINTS
// ====================
router.get('/:candidateId/strengths-weaknesses',
    candidateExists,
    asyncHandler(async (req: Request, res: Response) => {
        const { candidateId } = req.params;
        const data = await strengthWeaknessService.getAllStrengthsWeaknesses(candidateId);
        res.json({
            success: true,
            data: data
        });
    })
);
router.post('/:candidateId/strengths-weaknesses',
    candidateExists,
    validation.requireFields(['type', 'description']),
    asyncHandler(async (req: Request, res: Response) => {
        const { candidateId } = req.params;
        const data = req.body;
        if (!['strength', 'weakness'].includes(data.type)) {
            return res.status(BAD_REQUEST).json({
                success: false,
                message: 'Invalid type. Must be either "strength" or "weakness"'
            });
        }
        if (data.type === 'strength') {
            await strengthWeaknessService.addStrength(candidateId, data);
        } else {
            await strengthWeaknessService.addWeakness(candidateId, data);
        }
        res.status(CREATED).json({
            success: true,
            message: `${data.type} added successfully`
        });
    })
);
router.put('/:candidateId/strengths-weaknesses/:id',
    AuthMiddleware.authenticate,
    candidateExists,
    asyncHandler(async (req: Request, res: Response) => {
        const { candidateId, id } = req.params;
        const updateData = req.body;
        if (!updateData.type || !['strength', 'weakness'].includes(updateData.type)) {
            return res.status(BAD_REQUEST).json({
                success: false,
                message: 'Invalid type. Must be either "strength" or "weakness"'
            });
        }
        const type = updateData.type === 'strength' ? 'Strength' : 'Weakness';
        await strengthWeaknessService.updateStrengthWeakness(candidateId, id, updateData, type);
        res.json({
            success: true,
            message: `${updateData.type} updated successfully`
        });
    })
);
router.delete('/:candidateId/strengths-weaknesses/:id',
    AuthMiddleware.authenticate,
    candidateExists,
    asyncHandler(async (req: Request, res: Response) => {
        const { candidateId, id } = req.params;
        const { type } = req.query;
        if (!type || !['strength', 'weakness'].includes(type as string)) {
            return res.status(BAD_REQUEST).json({
                success: false,
                message: 'Query parameter "type" is required and must be either "strength" or "weakness"'
            });
        }
        const strengthWeaknessType = type === 'strength' ? 'Strength' : 'Weakness';
        await strengthWeaknessService.deleteStrengthWeakness(candidateId, id, strengthWeaknessType);
        res.json({
            success: true,
            message: `${type} removed successfully`
        });
    })
);
// Error handling middleware
router.use(errorHandler);
export default router;
