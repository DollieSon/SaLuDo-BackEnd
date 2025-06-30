import { Router, Request, Response } from 'express';
import { CandidateService } from '../services/CandidateService';
import { EducationService } from '../services/EducationService';
import { ExperienceService } from '../services/ExperienceService';
import { SkillService } from '../services/SkillService';
import { CertificationService } from '../services/CertificationService';
import { StrengthWeaknessService } from '../services/StrengthWeaknessService';
import { asyncHandler, errorHandler } from './middleware/errorHandler';
import { validation } from './middleware/validation';
import multer from 'multer';

const router = Router();
const upload = multer();

// Initialize services
const candidateService = new CandidateService();
const educationService = new EducationService();
const experienceService = new ExperienceService();
const skillService = new SkillService();
const certificationService = new CertificationService();
const strengthWeaknessService = new StrengthWeaknessService();

// ====================
// CORE CANDIDATE ENDPOINTS
// ====================

/**
 * GET /api/candidates - Get all candidates
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
    const candidates = await candidateService.getAllCandidates();
    res.json({
        success: true,
        data: candidates,
        count: candidates.length
    });
}));

/**
 * POST /api/candidates - Create new candidate
 */
router.post('/', 
    upload.single('resume'),
    validation.requireFields(['name', 'email', 'birthdate', 'roleApplied']),
    validation.validateEmailMiddleware,
    validation.validateDatesMiddleware(['birthdate']),
    asyncHandler(async (req: Request, res: Response) => {
        const { name, email, birthdate, roleApplied } = req.body;
        
        // Parse email array if it's a string
        const emailArray = Array.isArray(email) ? email : [email];
        
        // Handle resume file if uploaded
        let resumeData: string | undefined;
        if (req.file) {
            resumeData = req.file.buffer.toString('base64');
        }

        const candidate = await candidateService.addCandidate(
            name,
            emailArray,
            new Date(birthdate),
            roleApplied,
            resumeData
        );

        res.status(201).json({
            success: true,
            message: 'Candidate created successfully',
            data: candidate
        });
    })
);

/**
 * GET /api/candidates/:id - Get candidate by ID
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const candidate = await candidateService.getCandidate(id);
    
    if (!candidate) {
        return res.status(404).json({
            success: false,
            message: 'Candidate not found'
        });
    }

    res.json({
        success: true,
        data: candidate
    });
}));

/**
 * PUT /api/candidates/:id - Update candidate
 */
router.put('/:id', 
    validation.validateEmailMiddleware,
    validation.validateDatesMiddleware(['birthdate']),
    asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const updateData = req.body;
        
        await candidateService.updateCandidate(id, updateData);
        
        res.json({
            success: true,
            message: 'Candidate updated successfully'
        });
    })
);

/**
 * DELETE /api/candidates/:id - Delete candidate
 */
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    await candidateService.deleteCandidate(id);
    
    res.json({
        success: true,
        message: 'Candidate deleted successfully'
    });
}));

/**
 * GET /api/candidates/:id/full - Get complete candidate profile
 */
router.get('/:id/full', asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const fullProfile = await candidateService.getCandidate(id);
    
    if (!fullProfile) {
        return res.status(404).json({
            success: false,
            message: 'Candidate not found'
        });
    }

    // Get additional data
    const skills = await skillService.getSkills(id);
    const experience = await experienceService.getExperience(id);
    const education = await educationService.getEducation(id);
    const certifications = await certificationService.getCertifications(id);
    const strengthsWeaknesses = await strengthWeaknessService.getAllStrengthsWeaknesses(id);

    const completeProfile = {
        ...fullProfile,
        skills,
        experience,
        education,
        certifications,
        strengthsWeaknesses
    };

    res.json({
        success: true,
        data: completeProfile
    });
}));

// Error handling middleware
router.use(errorHandler);

export default router;
