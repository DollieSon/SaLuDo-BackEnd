import { Router, Request, Response } from 'express';
import { CandidateService } from '../services/CandidateService';
import { EducationService } from '../services/EducationService';
import { ExperienceService } from '../services/ExperienceService';
import { SkillService } from '../services/SkillService';
import { CertificationService } from '../services/CertificationService';
import { StrengthWeaknessService } from '../services/StrengthWeaknessService';
import { AddedBy } from '../Models/Skill';
import { asyncHandler, errorHandler } from './middleware/errorHandler';
import { validation } from './middleware/validation';
import multer from 'multer';
import { parseResumeWithGemini } from '../services/geminiResumeService';

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
router.get('/', asyncHandler(async (req: Request, res: Response) => {
    const candidates = await candidateService.getAllCandidates();
    res.json({ success: true, data: candidates, count: candidates.length });
}));

router.post('/', 
    upload.single('resume'),
    validation.requireFields(['name', 'email', 'birthdate', 'roleApplied']),
    validation.validateEmailMiddleware,
    validation.validateDatesMiddleware(['birthdate']),
    asyncHandler(async (req: Request, res: Response) => {
        const { name, email, birthdate, roleApplied } = req.body;

        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Resume file is required' });
        }

        const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (!allowedTypes.includes(req.file.mimetype)) {
            return res.status(400).json({ success: false, message: 'Resume must be a PDF or Word document' });
        }

        const maxSize = 10 * 1024 * 1024; // 10MB
        if (req.file.size > maxSize) {
            return res.status(400).json({ success: false, message: 'Resume file size must not exceed 10MB' });
        }

        const emailArray = Array.isArray(email) ? email : [email];
        const candidate = await candidateService.addCandidate(
            name,
            emailArray,
            new Date(birthdate),
            roleApplied,
            req.file
        );

        // Use Gemini to parse resume
        const parsedData = await parseResumeWithGemini(req.file.buffer);

        // Save parsed data
        if (parsedData.skills.length) {
            await skillService.addSkillsBulk(candidate.candidateId, parsedData.skills.map(skill => ({
                ...skill,
                addedBy: AddedBy.AI
            })));
        }
        for (const edu of parsedData.education) await educationService.addEducation(candidate.candidateId, edu);
        for (const exp of parsedData.experience) await experienceService.addExperience(candidate.candidateId, exp);
        for (const cert of parsedData.certifications) await certificationService.addCertification(candidate.candidateId, cert);
        for (const strength of parsedData.strengths) await strengthWeaknessService.addStrength(candidate.candidateId, strength);
        for (const weakness of parsedData.weaknesses) await strengthWeaknessService.addWeakness(candidate.candidateId, weakness);

        res.status(201).json({
            success: true,
            message: 'Candidate created and resume parsed successfully',
            data: candidate
        });
    })
);

router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const candidate = await candidateService.getCandidate(id);
    if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found' });
    res.json({ success: true, data: candidate });
}));

router.put('/:id', 
    validation.validateEmailMiddleware,
    validation.validateDatesMiddleware(['birthdate']),
    asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        await candidateService.updateCandidate(id, req.body);
        res.json({ success: true, message: 'Candidate updated successfully' });
    })
);

router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    await candidateService.deleteCandidate(id);
    res.json({ success: true, message: 'Candidate deleted successfully' });
}));

router.get('/:id/full', asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const fullProfile = await candidateService.getCandidate(id);
    if (!fullProfile) return res.status(404).json({ success: false, message: 'Candidate not found' });

    const skills = await skillService.getSkills(id);
    const experience = await experienceService.getExperience(id);
    const education = await educationService.getEducation(id);
    const certifications = await certificationService.getCertifications(id);
    const strengthsWeaknesses = await strengthWeaknessService.getAllStrengthsWeaknesses(id);

    res.json({
        success: true,
        data: { ...fullProfile, skills, experience, education, certifications, strengthsWeaknesses }
    });
}));

router.post('/:id/resume/parse', asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const candidate = await candidateService.getCandidate(id);
    if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found' });

    const resumeFile = await candidateService.getResumeFile(id);
    if (!resumeFile) return res.status(404).json({ success: false, message: 'No resume found to parse' });

    const chunks: Uint8Array[] = [];
    for await (const chunk of resumeFile.stream) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    const parsedData = await parseResumeWithGemini(buffer);

    if (parsedData.skills.length) {
        await skillService.addSkillsBulk(id, parsedData.skills.map(skill => ({
            ...skill,
            addedBy: AddedBy.AI
        })));
    }
    for (const edu of parsedData.education) await educationService.addEducation(id, edu);
    for (const exp of parsedData.experience) await experienceService.addExperience(id, exp);
    for (const cert of parsedData.certifications) await certificationService.addCertification(id, cert);
    for (const strength of parsedData.strengths) await strengthWeaknessService.addStrength(id, strength);
    for (const weakness of parsedData.weaknesses) await strengthWeaknessService.addWeakness(id, weakness);

    res.json({
        success: true,
        message: 'Resume parsed and candidate profile updated',
        data: parsedData
    });
}));

router.use(errorHandler);
export default router;
