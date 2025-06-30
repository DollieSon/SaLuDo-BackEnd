import { Router, Request, Response } from 'express';
import { CertificationService } from '../services/CertificationService';
import { asyncHandler, errorHandler } from './middleware/errorHandler';
import { candidateExists } from './middleware/candidateExists';
import { validation } from './middleware/validation';

const router = Router();
const certificationService = new CertificationService();

// ====================
// CERTIFICATIONS ENDPOINTS
// ====================

/**
 * GET /api/candidates/:candidateId/certifications - Get certifications
 */
router.get('/:candidateId/certifications',
    candidateExists,
    asyncHandler(async (req: Request, res: Response) => {
        const { candidateId } = req.params;
        const certifications = await certificationService.getCertifications(candidateId);
        
        res.json({
            success: true,
            data: certifications
        });
    })
);

/**
 * POST /api/candidates/:candidateId/certifications - Add certification
 */
router.post('/:candidateId/certifications',
    candidateExists,
    validation.requireFields(['name', 'issuedBy']),
    validation.validateDatesMiddleware(['dateIssued', 'expiryDate']),
    asyncHandler(async (req: Request, res: Response) => {
        const { candidateId } = req.params;
        const certificationData = req.body;

        await certificationService.addCertification(candidateId, certificationData);
        
        res.status(201).json({
            success: true,
            message: 'Certification added successfully'
        });
    })
);

/**
 * PUT /api/candidates/:candidateId/certifications/:certId - Update certification
 */
router.put('/:candidateId/certifications/:certId',
    candidateExists,
    validation.validateDatesMiddleware(['dateIssued', 'expiryDate']),
    asyncHandler(async (req: Request, res: Response) => {
        const { candidateId, certId } = req.params;
        const updateData = req.body;
        
        await certificationService.updateCertification(candidateId, certId, updateData);
        
        res.json({
            success: true,
            message: 'Certification updated successfully'
        });
    })
);

/**
 * DELETE /api/candidates/:candidateId/certifications/:certId - Remove certification
 */
router.delete('/:candidateId/certifications/:certId',
    candidateExists,
    asyncHandler(async (req: Request, res: Response) => {
        const { candidateId, certId } = req.params;
        
        await certificationService.deleteCertification(candidateId, certId);
        
        res.json({
            success: true,
            message: 'Certification removed successfully'
        });
    })
);

// Error handling middleware
router.use(errorHandler);

export default router;
