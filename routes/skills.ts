import { Router, Request, Response } from 'express';
import { SkillService } from '../services/SkillService';
import { AddedBy } from '../Models/Skill';
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
        const includeUnaccepted = req.query.includeUnaccepted !== 'false'; // Default to true
        const skills = await skillService.getSkills(candidateId, includeUnaccepted);
        
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
    validation.requireFields(['skillName', 'score']),
    asyncHandler(async (req: Request, res: Response) => {
        const { candidateId } = req.params;
        const skillData = {
            skillName: req.body.skillName,
            score: req.body.score || 5,
            evidence: req.body.evidence || '',
            addedBy: req.body.addedBy || AddedBy.HUMAN
        };
        
        // Validate skill score
        if (skillData.score < 1 || skillData.score > 10) {
            return res.status(400).json({
                success: false,
                message: 'Skill score must be between 1 and 10'
            });
        }

        const result = await skillService.addSkill(candidateId, skillData);
        
        res.status(201).json({
            success: true,
            message: 'Skill added successfully',
            data: result
        });
    })
);

/**
 * POST /api/candidates/:candidateId/skills/bulk - Add multiple skills
 */
router.post('/:candidateId/skills/bulk',
    candidateExists,
    validation.requireFields(['skills']),
    asyncHandler(async (req: Request, res: Response) => {
        const { candidateId } = req.params;
        const { skills } = req.body;
        
        if (!Array.isArray(skills) || skills.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Skills must be a non-empty array'
            });
        }

        // Validate each skill
        for (const skill of skills) {
            if (!skill.skillName) {
                return res.status(400).json({
                    success: false,
                    message: 'Each skill must have a skillName'
                });
            }
            if (skill.score && (skill.score < 1 || skill.score > 10)) {
                return res.status(400).json({
                    success: false,
                    message: 'Skill scores must be between 1 and 10'
                });
            }
        }

        const results = await skillService.addSkillsBulk(candidateId, skills);
        
        res.status(201).json({
            success: true,
            message: `${results.length} skills added successfully`,
            data: results
        });
    })
);
/**
 * PUT /api/candidates/:candidateId/skills/:candidateSkillId - Update skill
 */
router.put('/:candidateId/skills/:candidateSkillId',
    candidateExists,
    asyncHandler(async (req: Request, res: Response) => {
        const { candidateId, candidateSkillId } = req.params;
        const updateData = req.body;
        
        // Validate skill score if provided
        if (updateData.score && (updateData.score < 1 || updateData.score > 10)) {
            return res.status(400).json({
                success: false,
                message: 'Skill score must be between 1 and 10'
            });
        }
        
        await skillService.updateSkill(candidateId, candidateSkillId, updateData);
        
        res.json({
            success: true,
            message: 'Skill updated successfully'
        });
    })
);

/**
 * DELETE /api/candidates/:candidateId/skills/:candidateSkillId - Remove skill
 */
router.delete('/:candidateId/skills/:candidateSkillId',
    candidateExists,
    asyncHandler(async (req: Request, res: Response) => {
        const { candidateId, candidateSkillId } = req.params;
        
        await skillService.deleteSkill(candidateId, candidateSkillId);
        
        res.json({
            success: true,
            message: 'Skill removed successfully'
        });
    })
);

/**
 * GET /api/candidates/:candidateId/skills/threshold/:threshold - Get skills above threshold
 */
router.get('/:candidateId/skills/threshold/:threshold',
    candidateExists,
    asyncHandler(async (req: Request, res: Response) => {
        const { candidateId, threshold } = req.params;
        const includeUnaccepted = req.query.includeUnaccepted !== 'false';
        const thresholdNum = parseInt(threshold);
        
        if (isNaN(thresholdNum) || thresholdNum < 1 || thresholdNum > 10) {
            return res.status(400).json({
                success: false,
                message: 'Threshold must be a number between 1 and 10'
            });
        }

        const skills = await skillService.getSkillsAboveThreshold(candidateId, thresholdNum, includeUnaccepted);
        
        res.json({
            success: true,
            data: skills
        });
    })
);

// ====================
// SKILL MASTER ENDPOINTS  
// ====================

/**
 * GET /api/skills/search/:skillName - Search skills in master database
 */
router.get('/search/:skillName',
    asyncHandler(async (req: Request, res: Response) => {
        const { skillName } = req.params;
        
        const skills = await skillService.searchSkillsByName(skillName);
        
        res.json({
            success: true,
            data: skills
        });
    })
);

/**
 * GET /api/skills/candidates/:skillName - Get candidates with specific skill
 */
router.get('/candidates/:skillName',
    asyncHandler(async (req: Request, res: Response) => {
        const { skillName } = req.params;
        
        const results = await skillService.getCandidatesWithSkill(skillName);
        
        res.json({
            success: true,
            data: results
        });
    })
);

/**
 * GET /api/skills/master/:skillId - Get skill master data
 */
router.get('/master/:skillId',
    asyncHandler(async (req: Request, res: Response) => {
        const { skillId } = req.params;
        
        const skillMaster = await skillService.getSkillMaster(skillId);
        
        if (!skillMaster) {
            return res.status(404).json({
                success: false,
                message: 'Skill not found in master database'
            });
        }
        
        res.json({
            success: true,
            data: skillMaster
        });
    })
);

/**
 * PUT /api/skills/master/:skillId - Update skill master data
 */
router.put('/master/:skillId',
    asyncHandler(async (req: Request, res: Response) => {
        const { skillId } = req.params;
        const updateData = req.body;
        
        await skillService.updateSkillMaster(skillId, updateData);
        
        res.json({
            success: true,
            message: 'Skill master data updated successfully'
        });
    })
);

// Error handling middleware
router.use(errorHandler);

export default router;
