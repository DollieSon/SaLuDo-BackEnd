import { Router, Request, Response } from 'express';
import multer from 'multer';

const router = Router();
const upload = multer();

/*
// GET /jobs - List all jobs
router.get('/', (req: Request, res: Response) => {
    res.send('List of jobs');
});

// GET /jobs/:id - Get a specific job
router.get('/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    res.send(`Get job with ID: ${id}`);
});


// PUT /jobs/:id - Update a job
router.put('/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    res.send(`Update job with ID: ${id}`);
});

// DELETE /jobs/:id - Delete a job
router.delete('/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    res.send(`Delete job with ID: ${id}`);
});
*/

// POST /jobs - Create a new job
router.post('/', upload.none(), (req: Request, res: Response) => {
    console.log('Received job data:', req.body);
    // TODO - Handle job creation logic here, e.g., save to database
    res.send('Create a new job');
});

export default router;