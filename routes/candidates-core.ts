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
    res.json({
        success: true,
        data: candidates,
        count: candidates.length
    });
}));
router.post('/', 
    upload.single('resume'),
    validation.requireFields(['name', 'email', 'birthdate']),
    validation.validateEmailMiddleware,
    validation.validateDatesMiddleware(['birthdate']),
    asyncHandler(async (req: Request, res: Response) => {
        const { name, email, birthdate, roleApplied } = req.body;
        // Validate resume file is provided
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Resume file is required'
            });
        }
        // Validate file type
        const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (!allowedTypes.includes(req.file.mimetype)) {
            return res.status(400).json({
                success: false,
                message: 'Resume must be a PDF or Word document'
            });
        }
        // Validate file size (10MB max)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (req.file.size > maxSize) {
            return res.status(400).json({
                success: false,
                message: 'Resume file size must not exceed 10MB'
            });
        }
        // Parse email array if it's a string
        const emailArray = Array.isArray(email) ? email : [email];
        
        // Parse roleApplied (can be null, undefined, or a job ID)
        const jobId = roleApplied || null;
        
        const candidate = await candidateService.addCandidate(
            name,
            emailArray,
            new Date(birthdate),
            jobId,
            req.file
        );
        // @Ranz Implement The AI Resume Parsing Here
        // Do your thing bestfweind 💅💅
        // COMPREHENSIVE EXAMPLES: How to add all candidate data after AI resume parsing
        /*
        // ========================================
        // SKILLS EXAMPLES
        // ========================================
        // Example 1: Add a single skill
        await skillService.addSkill(candidate.candidateId, {
            skillName: 'JavaScript',
            score: 8,
            evidence: 'Extracted from resume: "5 years experience with JavaScript and React"',
            addedBy: AddedBy.AI
        });
        // Example 2: Add multiple skills in bulk (recommended for resume parsing)
        const extractedSkills = [
            { skillName: 'JavaScript', score: 8, evidence: 'Mentioned in projects section', addedBy: AddedBy.AI },
            { skillName: 'React', score: 7, evidence: 'Used in 3 projects', addedBy: AddedBy.AI },
            { skillName: 'Node.js', score: 6, evidence: 'Backend development experience', addedBy: AddedBy.AI },
            { skillName: 'MongoDB', score: 5, evidence: 'Database experience mentioned', addedBy: AddedBy.AI }
        ];
        await skillService.addSkillsBulk(candidate.candidateId, extractedSkills);
        // ========================================
        // EDUCATION EXAMPLES
        // ========================================
        // Example 1: Add education entry
        await educationService.addEducation(candidate.candidateId, {
            institution: 'University of Technology',
            startDate: new Date('2018-09-01'),
            endDate: new Date('2022-06-15'),
            description: 'Bachelor of Science in Computer Science - Specialized in software engineering and artificial intelligence'
        });
        // Example 2: Add multiple education entries
        const educationEntries = [
            {
                institution: 'Community College',
                startDate: new Date('2016-09-01'),
                endDate: new Date('2018-05-15'),
                description: 'Associate Degree in Computer Programming - Foundation in programming fundamentals'
            },
            {
                institution: 'Tech Bootcamp',
                startDate: new Date('2022-07-01'),
                endDate: new Date('2022-12-15'),
                description: 'Full Stack Development Certificate - Intensive 6-month program covering modern web technologies'
            }
        ];
        for (const education of educationEntries) {
            await educationService.addEducation(candidate.candidateId, education);
        }
        // ========================================
        // EXPERIENCE EXAMPLES
        // ========================================
        // Example 1: Add work experience
        await experienceService.addExperience(candidate.candidateId, {
            title: 'Tech Solutions Inc.',
            role: 'Senior Software Developer',
            description: 'Led development of enterprise web applications using React and Node.js. Managed a team of 5 developers and implemented CI/CD pipelines. Reduced application load time by 40% and improved code coverage to 95%.'
        });
        // Example 2: Add multiple experience entries
        const experienceEntries = [
            {
                title: 'StartupXYZ',
                role: 'Full Stack Developer',
                description: 'Developed MVP for fintech startup using MERN stack. Built RESTful APIs and responsive frontend. Built entire application from scratch in 6 months.'
            },
            {
                title: 'Freelance Projects',
                role: 'Web Developer',
                description: 'Provided web development services to small businesses. Created custom websites and e-commerce solutions. Delivered 15+ successful projects with 98% client satisfaction rate.'
            }
        ];
        for (const experience of experienceEntries) {
            await experienceService.addExperience(candidate.candidateId, experience);
        }
        // ========================================
        // CERTIFICATIONS EXAMPLES
        // ========================================
        // Example 1: Add certification
        await certificationService.addCertification(candidate.candidateId, {
            name: 'AWS Certified Solutions Architect',
            issuingOrganization: 'Amazon Web Services',
            issueDate: new Date('2023-03-15'),
            description: 'Demonstrates expertise in designing distributed systems on AWS'
        });
        // Example 2: Add multiple certifications
        const certifications = [
            {
                name: 'Microsoft Azure Developer Associate',
                issuingOrganization: 'Microsoft',
                issueDate: new Date('2023-01-20'),
                description: 'Cloud development and deployment expertise'
            },
            {
                name: 'Certified Kubernetes Administrator',
                issuingOrganization: 'Cloud Native Computing Foundation',
                issueDate: new Date('2023-06-10'),
                description: 'Container orchestration and management'
            },
            {
                name: 'Google Analytics Certified',
                issuingOrganization: 'Google',
                issueDate: new Date('2022-11-05'),
                description: 'Web analytics and data interpretation'
            }
        ];
        for (const certification of certifications) {
            await certificationService.addCertification(candidate.candidateId, certification);
        }
        // ========================================
        // STRENGTHS & WEAKNESSES EXAMPLES
        // ========================================
        // Example 1: Add individual strengths and weaknesses
        await strengthWeaknessService.addStrength(candidate.candidateId, {
            name: 'Problem Solving',
            description: 'Excellent at breaking down complex problems into manageable components and finding innovative solutions. Consistently resolved critical production issues and improved system performance by 30%.',
            type: 'Strength'
        });
        await strengthWeaknessService.addWeakness(candidate.candidateId, {
            name: 'Public Speaking',
            description: 'Still developing confidence in presenting to large audiences. Enrolled in Toastmasters and practicing with team presentations monthly to improve.',
            type: 'Weakness'
        });
        // Example 2: Add multiple strengths
        const strengths = [
            {
                name: 'Team Leadership',
                description: 'Natural ability to motivate and guide team members towards common goals. Successfully led 3 cross-functional teams, delivered projects 20% ahead of schedule.',
                type: 'Strength' as const
            },
            {
                name: 'Technical Learning',
                description: 'Quick to adapt and master new technologies and frameworks. Became proficient in React within 2 months, now mentoring junior developers.',
                type: 'Strength' as const
            },
            {
                name: 'Communication',
                description: 'Clear and effective communication with both technical and non-technical stakeholders. Facilitated successful client meetings and translated technical requirements for business teams.',
                type: 'Strength' as const
            }
        ];
        for (const strength of strengths) {
            await strengthWeaknessService.addStrength(candidate.candidateId, strength);
        }
        // Example 3: Add multiple weaknesses
        const weaknesses = [
            {
                name: 'Time Management',
                description: 'Sometimes struggle with estimating time for complex tasks. Using time-tracking tools and breaking tasks into smaller, measurable chunks to improve.',
                type: 'Weakness' as const
            },
            {
                name: 'Documentation',
                description: 'Tend to focus on coding rather than comprehensive documentation. Implementing documentation-first approach, allocating specific time for technical writing.',
                type: 'Weakness' as const
            }
        ];
        for (const weakness of weaknesses) {
            await strengthWeaknessService.addWeakness(candidate.candidateId, weakness);
        }
        */
        res.status(201).json({
            success: true,
            message: 'Candidate created successfully',
            data: candidate
        });
    })
);
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
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    await candidateService.deleteCandidate(id);
    res.json({
        success: true,
        message: 'Candidate deleted successfully'
    });
}));
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
router.get('/:id/resume', asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const resumeFile = await candidateService.getResumeFile(id);
    if (!resumeFile) {
        return res.status(404).json({
            success: false,
            message: 'Resume not found'
        });
    }
    res.set({
        'Content-Type': resumeFile.metadata.contentType,
        'Content-Disposition': `attachment; filename="${resumeFile.metadata.filename}"`,
        'Content-Length': resumeFile.metadata.size.toString()
    });
    resumeFile.stream.pipe(res);
    resumeFile.stream.on('error', () => {
        res.status(500).json({
            success: false,
            message: 'Error downloading resume'
        });
    });
}));
router.put('/:id/resume',
    upload.single('resume'),
    asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Resume file is required'
            });
        }
        // Validate file type
        const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (!allowedTypes.includes(req.file.mimetype)) {
            return res.status(400).json({
                success: false,
                message: 'Resume must be a PDF or Word document'
            });
        }
        // Validate file size (10MB max)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (req.file.size > maxSize) {
            return res.status(400).json({
                success: false,
                message: 'Resume file size must not exceed 10MB'
            });
        }
        await candidateService.updateResumeFile(id, req.file);
        res.json({
            success: true,
            message: 'Resume updated successfully'
        });
    })
);
router.delete('/:id/resume', asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    await candidateService.deleteResumeFile(id);
    res.json({
        success: true,
        message: 'Resume deleted successfully'
    });
}));
router.get('/:id/resume/metadata', asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const metadata = await candidateService.getResumeMetadata(id);
    if (!metadata) {
        return res.status(404).json({
            success: false,
            message: 'Resume not found'
        });
    }
    res.json({
        success: true,
        data: metadata
    });
}));
router.post('/:id/resume/parse', asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    // Check if candidate has resume
    const hasResume = await candidateService.hasResume(id);
    if (!hasResume) {
        return res.status(404).json({
            success: false,
            message: 'No resume found to parse'
        });
    }
    // TODO: Implement AI resume parsing
    // For now, just update parse status
    const metadata = await candidateService.getResumeMetadata(id);
    if (metadata) {
        // Update parse status (this would be done by actual parsing service)
        // This is a placeholder for future implementation
    }
    res.json({
        success: true,
        message: 'Resume parsing initiated (feature coming soon)',
        data: {
            status: 'pending',
            note: 'AI resume parsing will be implemented in a future update'
        }
    });
}));
// ====================
// JOB-RELATED ENDPOINTS
// ====================
// Apply candidate to job
router.put('/:candidateId/apply-job/:jobId', 
    asyncHandler(async (req: Request, res: Response) => {
        const { candidateId, jobId } = req.params;
        
        await candidateService.applyCandidateToJob(candidateId, jobId);
        
        res.json({
            success: true,
            message: 'Candidate successfully applied to job'
        });
    })
);

// Remove candidate from job
router.put('/:candidateId/remove-job', 
    asyncHandler(async (req: Request, res: Response) => {
        const { candidateId } = req.params;
        
        await candidateService.removeCandidateFromJob(candidateId);
        
        res.json({
            success: true,
            message: 'Candidate successfully removed from job'
        });
    })
);

// Get candidates by job
router.get('/by-job/:jobId', 
    asyncHandler(async (req: Request, res: Response) => {
        const { jobId } = req.params;
        
        const candidates = await candidateService.getCandidatesByJob(jobId);
        
        res.json({
            success: true,
            data: candidates,
            count: candidates.length
        });
    })
);

// Get candidates without job
router.get('/without-job', 
    asyncHandler(async (req: Request, res: Response) => {
        const candidates = await candidateService.getCandidatesWithoutJob();
        
        res.json({
            success: true,
            data: candidates,
            count: candidates.length
        });
    })
);

// Error handling middleware
router.use(errorHandler);
export default router;
