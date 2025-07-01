import { Router, Request, Response } from "express";
import { JobService } from "../services/JobService";
import { asyncHandler, errorHandler } from "./middleware/errorHandler";
import { validation } from "./middleware/validation";
import { parseJobWithGemini } from "../services/GeminiJobService";
// import { JobSkillRequirement } from '../models/JobTypes';

const router = Router();
const jobService = new JobService();

// ====================
// JOB MANAGEMENT ENDPOINTS
// ====================

// GET /api/jobs - List all jobs with pagination
router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const result = await jobService.getAllJobs(page, limit);

    res.json({
      success: true,
      data: result.jobs,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  })
);

// GET /api/jobs/summaries - List job summaries
router.get(
  "/summaries",
  asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const result = await jobService.getJobSummaries(page, limit);

    res.json({
      success: true,
      data: result.summaries,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  })
);

// GET /api/jobs/search - Search jobs
router.get(
  "/search",
  asyncHandler(async (req: Request, res: Response) => {
    const criteria = {
      jobName: req.query.jobName as string,
      skillIds: req.query.skillIds
        ? (req.query.skillIds as string).split(",")
        : undefined,
      skillNames: req.query.skillNames
        ? (req.query.skillNames as string).split(",")
        : undefined,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 10,
    };

    const result = await jobService.searchJobs(criteria);

    res.json({
      success: true,
      data: result.jobs,
      pagination: {
        page: criteria.page,
        limit: criteria.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  })
);

// GET /api/jobs/by-skill/:skillId - Get jobs requiring a specific skill
router.get(
  "/by-skill/:skillId",
  asyncHandler(async (req: Request, res: Response) => {
    const { skillId } = req.params;
    const jobs = await jobService.getJobsBySkill(skillId);

    res.json({
      success: true,
      data: jobs,
      count: jobs.length,
    });
  })
);

// GET /api/jobs/by-skill-name/:skillName - Get jobs requiring a specific skill by name
router.get(
  "/by-skill-name/:skillName",
  asyncHandler(async (req: Request, res: Response) => {
    const { skillName } = req.params;
    const jobs = await jobService.getJobsBySkillName(skillName);

    res.json({
      success: true,
      data: jobs,
      count: jobs.length,
    });
  })
);

// GET /api/jobs/:id - Get specific job
router.get(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const includeSkillNames = req.query.includeSkillNames === "true";

    const job = includeSkillNames
      ? await jobService.getJobWithSkillNames(id)
      : await jobService.getJob(id);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    res.json({
      success: true,
      data: job,
    });
  })
);

// POST /api/jobs - Create a new job with AI-parsed skills
router.post(
  "/",
  validation.requireFields(["jobName", "jobDescription"]),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const { jobName, jobDescription } = req.body;

      const parsed = await parseJobWithGemini(jobName, jobDescription);

      // Map parsed skills to JobSkillRequirement[] by looking up or creating skills by name
      const skillMasterRepo = require("../repositories/SkillMasterRepository");
      const skillMaster = new skillMasterRepo.SkillMasterRepository();
      const skillsWithIds = [];
      for (const skill of parsed) {
        // Try to find the skill by name
        let skillDoc = await skillMaster.findByName(skill.skillName);
        if (!skillDoc) {
          // If not found, create it
          skillDoc = await skillMaster.create({ name: skill.skillName });
        }
        skillsWithIds.push({
          skillId: skillDoc._id,
          requiredLevel: skill.requiredLevel,
          evidence: skill.evidence,
        });
      }

      const jobData = {
        jobName,
        jobDescription,
        skills: skillsWithIds,
      };

      const newJob = await jobService.createJob(jobData);
      res.status(201).json({
        success: true,
        message: "Job created and skills parsed successfully",
        data: newJob,
      });
    } catch (err: any) {
      console.error("❌ Job creation error:", err);
      res.status(500).json({
        success: false,
        message: "Failed to create job",
        error: err.message || "Unknown error",
      });
    }
  })
);

// PUT /api/jobs/:id - Update a job
router.put(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const updateData = req.body;

    if (updateData.skills) {
      if (!Array.isArray(updateData.skills)) {
        return res
          .status(400)
          .json({ success: false, message: "Skills must be an array" });
      }

      for (const skill of updateData.skills) {
        if (
          !skill.skillId ||
          typeof skill.requiredLevel !== "number" ||
          skill.requiredLevel < 0.0 ||
          skill.requiredLevel > 10.0
        ) {
          return res
            .status(400)
            .json({ success: false, message: "Invalid skill data" });
        }
      }
    }

    await jobService.updateJob(id, updateData);
    res.json({ success: true, message: "Job updated successfully" });
  })
);

// DELETE /api/jobs/:id - Delete a job
router.delete(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    await jobService.deleteJob(id);
    res.json({ success: true, message: "Job deleted successfully" });
  })
);

// POST /api/jobs/:id/skills - Add a skill to a job
router.post(
  "/:id/skills",
  validation.requireFields(["skillId", "requiredLevel"]),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { skillId, requiredLevel, evidence } = req.body;

    if (
      typeof requiredLevel !== "number" ||
      requiredLevel < 0.0 ||
      requiredLevel > 10.0
    ) {
      return res.status(400).json({
        success: false,
        message: "Required level must be a number between 0.0 and 10.0",
      });
    }

    if (evidence && typeof evidence !== "string") {
      return res.status(400).json({
        success: false,
        message: "Evidence must be a string if provided",
      });
    }
    //todo create addskillstojob taking in a list of skills
    await jobService.addSkillToJob(id, skillId, requiredLevel, evidence);
    res.json({ success: true, message: "Skill added to job successfully" });
  })
);

// POST /api/jobs/:id/skills/bulk - Add multiple skills to a job
router.post(
  "/:id/skills/bulk",
  validation.requireFields(["skills"]),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { skills } = req.body;

    // Validate skills array
    if (!Array.isArray(skills) || skills.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Skills must be a non-empty array",
      });
    }

    // Validate each skill in the array
    for (let i = 0; i < skills.length; i++) {
      const skill = skills[i];

      if (!skill.skillId) {
        return res.status(400).json({
          success: false,
          message: `Skill at index ${i} must have a skillId`,
        });
      }

      if (
        typeof skill.requiredLevel !== "number" ||
        skill.requiredLevel < 0.0 ||
        skill.requiredLevel > 10.0
      ) {
        return res.status(400).json({
          success: false,
          message: `Required level must be a number between 0.0 and 10.0 for skill at index ${i}`,
        });
      }

      // Validate evidence field if provided
      if (skill.evidence && typeof skill.evidence !== "string") {
        return res.status(400).json({
          success: false,
          message: `Evidence must be a string if provided for skill at index ${i}`,
        });
      }
    }

    await jobService.addSkillsToJob(id, skills);

    res.json({
      success: true,
      message: `${skills.length} skills added to job successfully`,
    });
  })
);

// POST /api/jobs/:id/skills/bulk-by-name - Add multiple skills to a job by skill names
router.post(
  "/:id/skills/bulk-by-name",
  validation.requireFields(["skills"]),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { skills } = req.body;

    // Validate skills array
    if (!Array.isArray(skills) || skills.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Skills must be a non-empty array",
      });
    }

    // Validate each skill in the array
    for (let i = 0; i < skills.length; i++) {
      const skill = skills[i];

      if (
        !skill.skillName ||
        typeof skill.skillName !== "string" ||
        skill.skillName.trim() === ""
      ) {
        return res.status(400).json({
          success: false,
          message: `Skill at index ${i} must have a non-empty skillName`,
        });
      }

      if (
        typeof skill.requiredLevel !== "number" ||
        skill.requiredLevel < 0.0 ||
        skill.requiredLevel > 10.0
      ) {
        return res.status(400).json({
          success: false,
          message: `Required level must be a number between 0.0 and 10.0 for skill at index ${i}`,
        });
      }

      // Validate evidence field if provided
      if (skill.evidence && typeof skill.evidence !== "string") {
        return res.status(400).json({
          success: false,
          message: `Evidence must be a string if provided for skill at index ${i}`,
        });
      }
    }

    await jobService.addSkillsToJobByName(id, skills);

    res.json({
      success: true,
      message: `${skills.length} skills added to job successfully by name (skills auto-created if needed)`,
    });
  })
);

// DELETE /api/jobs/:id/skills/:skillId - Remove a skill from a job
router.delete(
  "/:id/skills/:skillId",
  asyncHandler(async (req: Request, res: Response) => {
    const { id, skillId } = req.params;
    await jobService.removeSkillFromJob(id, skillId);
    res.json({ success: true, message: "Skill removed from job successfully" });
  })
);

// GET /api/jobs/:id/skills - Get skills for a specific job
router.get(
  "/:id/skills",
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const job = await jobService.getJob(id);

    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    res.json({ success: true, data: job.skills, count: job.skills.length });
  })
);

router.use(errorHandler);
export default router;
