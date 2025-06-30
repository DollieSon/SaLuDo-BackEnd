import { Router, Request, Response } from 'express';
import { CandidateService } from '../services/CandidateService';
import { asyncHandler, errorHandler } from './middleware/errorHandler';
import { candidateExists } from './middleware/candidateExists';
import { validation } from './middleware/validation';
import multer from 'multer';
const router = Router({ mergeParams: true }); // mergeParams to access :candidateId from parent router
const upload = multer();
// Initialize service
const candidateService = new CandidateService();
// ====================
// TRANSCRIPT FILE ENDPOINTS
// ====================
router.post('/',
    upload.single('transcript'),
    candidateExists,
    validation.validateTranscriptFile,
    asyncHandler(async (req: Request, res: Response) => {
        const { candidateId } = req.params;
        const transcriptFile = req.file!; // Safe to use ! since validation middleware ensures file exists
        // Extract optional metadata from request body
        const metadata = {
            interviewRound: req.body.interviewRound,
            duration: req.body.duration ? parseFloat(req.body.duration) : undefined
        };
        const transcriptMetadata = await candidateService.addTranscriptFile(
            candidateId,
            transcriptFile,
            metadata
        );
        res.status(201).json({
            success: true,
            message: 'Transcript file uploaded successfully',
            data: transcriptMetadata
        });
    })
);
router.get('/',
    candidateExists,
    asyncHandler(async (req: Request, res: Response) => {
        const { candidateId } = req.params;
        const transcripts = await candidateService.getAllTranscripts(candidateId);
        res.json({
            success: true,
            data: transcripts,
            count: transcripts.length
        });
    })
);
router.get('/:transcriptId',
    candidateExists,
    asyncHandler(async (req: Request, res: Response) => {
        const { candidateId, transcriptId } = req.params;
        const { stream, metadata } = await candidateService.getTranscriptFile(candidateId, transcriptId);
        // Set appropriate headers for file download
        res.set({
            'Content-Type': metadata.contentType,
            'Content-Disposition': `attachment; filename="${metadata.filename}"`,
            'Content-Length': metadata.size.toString()
        });
        // Stream the file to the response
        stream.pipe(res);
    })
);
router.put('/:transcriptId',
    upload.single('transcript'),
    candidateExists,
    validation.validateTranscriptFile,
    asyncHandler(async (req: Request, res: Response) => {
        const { candidateId, transcriptId } = req.params;
        const transcriptFile = req.file!; // Safe to use ! since validation middleware ensures file exists
        // Extract optional metadata from request body
        const metadata = {
            interviewRound: req.body.interviewRound,
            duration: req.body.duration ? parseFloat(req.body.duration) : undefined
        };
        const updatedMetadata = await candidateService.updateTranscriptFile(
            candidateId,
            transcriptId,
            transcriptFile,
            metadata
        );
        res.json({
            success: true,
            message: 'Transcript file updated successfully',
            data: updatedMetadata
        });
    })
);
router.delete('/:transcriptId',
    candidateExists,
    asyncHandler(async (req: Request, res: Response) => {
        const { candidateId, transcriptId } = req.params;
        await candidateService.deleteTranscriptFile(candidateId, transcriptId);
        res.json({
            success: true,
            message: 'Transcript file deleted successfully'
        });
    })
);
router.get('/:transcriptId/metadata',
    candidateExists,
    asyncHandler(async (req: Request, res: Response) => {
        const { candidateId, transcriptId } = req.params;
        const metadata = await candidateService.getTranscriptMetadata(candidateId, transcriptId);
        if (!metadata) {
            return res.status(404).json({
                success: false,
                message: 'Transcript not found'
            });
        }
        res.json({
            success: true,
            data: metadata
        });
    })
);
router.post('/:transcriptId/transcribe',
    candidateExists,
    asyncHandler(async (req: Request, res: Response) => {
        const { candidateId, transcriptId } = req.params;
        // TODO: Implement AI transcription service integration
        // For now, just update the status to pending
        res.json({
            success: true,
            message: 'Transcription request submitted (placeholder)',
            data: {
                transcriptId,
                status: 'pending',
                note: 'AI transcription service integration coming soon!'
            }
        });
    })
);
// Apply error handler
router.use(errorHandler);
export default router;
