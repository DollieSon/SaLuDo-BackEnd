import { Router, Request, Response } from 'express';
import { StrengthWeaknessService } from '../services/StrengthWeaknessService';
import { asyncHandler, errorHandler } from './middleware/errorHandler';
import { candidateExists } from './middleware/candidateExists';
import { validation } from './middleware/validation';

const router = Router();
const strengthWeaknessService = new StrengthWeaknessService();

// ====================
// STRENGTHS & WEAKNESSES ENDPOINTS
// ====================

/**
 * GET /api/candidates/:candidateId/strengths-weaknesses - Get strengths & weaknesses
 */
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

/**
 * POST /api/candidates/:candidateId/strengths-weaknesses - Add strength/weakness
 */
router.post('/:candidateId/strengths-weaknesses',
    candidateExists,
    validation.requireFields(['type', 'description']),
    asyncHandler(async (req: Request, res: Response) => {
        const { candidateId } = req.params;
        const data = req.body;
        
        if (!['strength', 'weakness'].includes(data.type)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid type. Must be either "strength" or "weakness"'
            });
        }

        if (data.type === 'strength') {
            await strengthWeaknessService.addStrength(candidateId, data);
        } else {
            await strengthWeaknessService.addWeakness(candidateId, data);
        }
        
        res.status(201).json({
            success: true,
            message: `${data.type} added successfully`
        });
    })
);

/**
 * PUT /api/candidates/:candidateId/strengths-weaknesses/:id - Update strength/weakness
 */
router.put('/:candidateId/strengths-weaknesses/:id',
    candidateExists,
    asyncHandler(async (req: Request, res: Response) => {
        const { candidateId, id } = req.params;
        const updateData = req.body;
        
        if (!updateData.type || !['strength', 'weakness'].includes(updateData.type)) {
            return res.status(400).json({
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

/**
 * DELETE /api/candidates/:candidateId/strengths-weaknesses/:id - Remove strength/weakness
 */
router.delete('/:candidateId/strengths-weaknesses/:id',
    candidateExists,
    asyncHandler(async (req: Request, res: Response) => {
        const { candidateId, id } = req.params;
        const { type } = req.query;
        
        if (!type || !['strength', 'weakness'].includes(type as string)) {
            return res.status(400).json({
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
