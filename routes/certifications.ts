import { Router, Request, Response } from 'express';
import { CertificationService } from '../services/CertificationService';
import { asyncHandler, errorHandler } from './middleware/errorHandler';
import { candidateExists } from './middleware/candidateExists';
import { validation } from './middleware/validation';
import { AuthMiddleware } from './middleware/auth';
const router = Router();
const certificationService = new CertificationService();
// ====================
// CERTIFICATIONS ENDPOINTS
// ====================
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
router.put('/:candidateId/certifications/:certId',
    AuthMiddleware.authenticate,
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
router.delete('/:candidateId/certifications/:certId',
    AuthMiddleware.authenticate,
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
