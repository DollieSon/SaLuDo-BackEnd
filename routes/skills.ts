import { Router, Request, Response } from "express";
import { SkillService } from "../services/SkillService";
import { AddedBy } from "../Models/Skill";
import { asyncHandler, errorHandler } from "./middleware/errorHandler";
import { candidateExists } from "./middleware/candidateExists";
import { validation } from "./middleware/validation";
const router = Router();
const skillService = new SkillService();
// ====================
// SKILLS ENDPOINTS
// ====================
router.get(
  "/:candidateId/skills",
  candidateExists,
  asyncHandler(async (req: Request, res: Response) => {
    const { candidateId } = req.params;
    const includeUnaccepted = req.query.includeUnaccepted !== "false"; // Default to true
    const skills = await skillService.getSkills(candidateId, includeUnaccepted);
    res.json({
      success: true,
      data: skills,
    });
  })
);
router.post(
  "/:candidateId/skills",
  candidateExists,
  validation.requireFields(["skillName", "score"]),
  asyncHandler(async (req: Request, res: Response) => {
    const { candidateId } = req.params;
    const skillData = {
      skillName: req.body.skillName,
      score: req.body.score || 5,
      evidence: req.body.evidence || "",
      addedBy: req.body.addedBy || AddedBy.HUMAN,
    };
    // Validate skill score
    if (skillData.score < 1 || skillData.score > 10) {
      return res.status(400).json({
        success: false,
        message: "Skill score must be between 1 and 10",
      });
    }
    const result = await skillService.addSkill(candidateId, skillData);
    res.status(201).json({
      success: true,
      message: "Skill added successfully",
      data: result,
    });
  })
);
router.post(
  "/:candidateId/skills/bulk",
  candidateExists,
  validation.requireFields(["skills"]),
  asyncHandler(async (req: Request, res: Response) => {
    const { candidateId } = req.params;
    const { skills } = req.body;
    if (!Array.isArray(skills) || skills.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Skills must be a non-empty array",
      });
    }
    // Validate each skill
    for (const skill of skills) {
      if (!skill.skillName) {
        return res.status(400).json({
          success: false,
          message: "Each skill must have a skillName",
        });
      }
      if (skill.score && (skill.score < 1 || skill.score > 10)) {
        return res.status(400).json({
          success: false,
          message: "Skill scores must be between 1 and 10",
        });
      }
    }
    const results = await skillService.addSkillsBulk(candidateId, skills);
    res.status(201).json({
      success: true,
      message: `${results.length} skills added successfully`,
      data: results,
    });
  })
);
router.put(
  "/:candidateId/skills/:candidateSkillId",
  candidateExists,
  asyncHandler(async (req: Request, res: Response) => {
    const { candidateId, candidateSkillId } = req.params;
    const updateData = req.body;
    // Validate skill score if provided
    if (updateData.score && (updateData.score < 1 || updateData.score > 10)) {
      return res.status(400).json({
        success: false,
        message: "Skill score must be between 1 and 10",
      });
    }
    await skillService.updateSkill(candidateId, candidateSkillId, updateData);
    res.json({
      success: true,
      message: "Skill updated successfully",
    });
  })
);
router.delete(
  "/:candidateId/skills/:candidateSkillId",
  candidateExists,
  asyncHandler(async (req: Request, res: Response) => {
    const { candidateId, candidateSkillId } = req.params;
    await skillService.deleteSkill(candidateId, candidateSkillId);
    res.json({
      success: true,
      message: "Skill soft deleted successfully",
    });
  })
);

// Restore soft deleted skill
router.patch(
  "/:candidateId/skills/:candidateSkillId/restore",
  candidateExists,
  asyncHandler(async (req: Request, res: Response) => {
    const { candidateId, candidateSkillId } = req.params;
    await skillService.restoreSkill(candidateId, candidateSkillId);
    res.json({
      success: true,
      message: "Skill restored successfully",
    });
  })
);

// Hard delete skill (permanent removal)
router.delete(
  "/:candidateId/skills/:candidateSkillId/hard",
  candidateExists,
  asyncHandler(async (req: Request, res: Response) => {
    const { candidateId, candidateSkillId } = req.params;
    await skillService.hardDeleteSkill(candidateId, candidateSkillId);
    res.json({
      success: true,
      message: "Skill permanently deleted",
    });
  })
);
router.get(
  "/:candidateId/skills/threshold/:threshold",
  candidateExists,
  asyncHandler(async (req: Request, res: Response) => {
    const { candidateId, threshold } = req.params;
    const includeUnaccepted = req.query.includeUnaccepted !== "false";
    const thresholdNum = parseInt(threshold);
    if (isNaN(thresholdNum) || thresholdNum < 1 || thresholdNum > 10) {
      return res.status(400).json({
        success: false,
        message: "Threshold must be a number between 1 and 10",
      });
    }
    const skills = await skillService.getSkillsAboveThreshold(
      candidateId,
      thresholdNum,
      includeUnaccepted
    );
    res.json({
      success: true,
      data: skills,
    });
  })
);
// ====================
// SKILL MASTER ENDPOINTS
// ====================
router.get(
  "/search/:skillName",
  asyncHandler(async (req: Request, res: Response) => {
    const { skillName } = req.params;
    const skills = await skillService.searchSkillsByName(skillName);
    res.json({
      success: true,
      data: skills,
    });
  })
);
router.get(
  "/candidates/:skillName",
  asyncHandler(async (req: Request, res: Response) => {
    const { skillName } = req.params;
    const results = await skillService.getCandidatesWithSkill(skillName);
    res.json({
      success: true,
      data: results,
    });
  })
);

// GET /api/skills/master/used - Get only skills used by candidates (must be before :skillId route)
router.get(
  "/master/used",
  asyncHandler(async (req: Request, res: Response) => {
    const skills = await skillService.getUsedSkillMaster();
    res.json({
      success: true,
      data: skills,
      count: skills.length,
    });
  })
);

router.get(
  "/master/:skillId",
  asyncHandler(async (req: Request, res: Response) => {
    const { skillId } = req.params;
    const skillMaster = await skillService.getSkillMaster(skillId);
    if (!skillMaster) {
      return res.status(404).json({
        success: false,
        message: "Skill not found in master database",
      });
    }
    res.json({
      success: true,
      data: skillMaster,
    });
  })
);
router.put(
  "/master/:skillId",
  asyncHandler(async (req: Request, res: Response) => {
    const { skillId } = req.params;
    const updateData = req.body;
    await skillService.updateSkillMaster(skillId, updateData);
    res.json({
      success: true,
      message: "Skill master data updated successfully",
    });
  })
);
// ====================
// GLOBAL SKILLS ENDPOINTS
// ====================

// GET /api/skills - Get all skills (master data)
router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const skills = await skillService.getAllSkillMaster();
    res.json({
      success: true,
      data: skills,
      count: skills.length,
    });
  })
);

// GET /api/skills/master - Get skill master data
router.get(
  "/master",
  asyncHandler(async (req: Request, res: Response) => {
    const skills = await skillService.getAllSkillMaster();
    res.json({
      success: true,
      data: skills,
      count: skills.length,
    });
  })
);

// POST /api/skills/master/merge - Merge multiple skills into one
router.post(
  "/master/merge",
  validation.requireFields(["targetSkillId", "sourceSkillIds"]),
  asyncHandler(async (req: Request, res: Response) => {
    const { targetSkillId, sourceSkillIds } = req.body;

    // Validate input
    if (!Array.isArray(sourceSkillIds) || sourceSkillIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "sourceSkillIds must be a non-empty array",
      });
    }

    if (sourceSkillIds.includes(targetSkillId)) {
      return res.status(400).json({
        success: false,
        message: "Target skill cannot be included in source skills",
      });
    }

    const result = await skillService.mergeSkills(
      targetSkillId,
      sourceSkillIds
    );

    res.json({
      success: true,
      message: `Successfully merged ${sourceSkillIds.length} skills into target skill`,
      data: result,
    });
  })
);

// Error handling middleware
router.use(errorHandler);
export default router;
