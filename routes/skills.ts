import { Router, Request, Response } from 'express';
import { SkillService } from '../services/SkillService';
import { asyncHandler, errorHandler } from './middleware/errorHandler';
import { candidateExists } from './middleware/candidateExists';
import { validation } from './middleware/validation';

const router = Router();
const skillService = new SkillService();

// ====================
// SKILLS ENDPOINTS
// ====================

/**
 * GET /api/candidates/:candidateId/skills - Get candidate skills
 */
router.get('/:candidateId/skills', 
    candidateExists,
    asyncHandler(async (req: Request, res: Response) => {
        const { candidateId } = req.params;
        const skills = await skillService.getSkills(candidateId);
        
        res.json({
            success: true,
            data: skills
        });
    })
);

/**
 * POST /api/candidates/:candidateId/skills - Add skill
 */
router.post('/:candidateId/skills',
    candidateExists,
    validation.requireFields(['name', 'level']),
    asyncHandler(async (req: Request, res: Response) => {
        const { candidateId } = req.params;
        const skillData = req.body;
        
        // Validate skill level
        if (!validation.validateSkillLevel(skillData.level)) {
            return res.status(400).json({
                success: false,
                message: 'Skill level must be an integer between 1 and 10'
            });
        }

        await skillService.addSkill(candidateId, skillData);
        
        res.status(201).json({
            success: true,
            message: 'Skill added successfully'
        });
    })
);

/**
 * PUT /api/candidates/:candidateId/skills/:skillId - Update skill
 */
router.put('/:candidateId/skills/:skillId',
    candidateExists,
    asyncHandler(async (req: Request, res: Response) => {
        const { candidateId, skillId } = req.params;
        const updateData = req.body;
        
        // Validate skill level if provided
        if (updateData.level && !validation.validateSkillLevel(updateData.level)) {
            return res.status(400).json({
                success: false,
                message: 'Skill level must be an integer between 1 and 10'
            });
        }
        
        await skillService.updateSkill(candidateId, skillId, updateData);
        
        res.json({
            success: true,
            message: 'Skill updated successfully'
        });
    })
);

/**
 * DELETE /api/candidates/:candidateId/skills/:skillId - Remove skill
 */
router.delete('/:candidateId/skills/:skillId',
    candidateExists,
    asyncHandler(async (req: Request, res: Response) => {
        const { candidateId, skillId } = req.params;
        
        await skillService.deleteSkill(candidateId, skillId);
        
        res.json({
            success: true,
            message: 'Skill removed successfully'
        });
    })
);

// Error handling middleware
router.use(errorHandler);

export default router;
