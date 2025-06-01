import { Router, Request, Response } from 'express';
import multer from 'multer';
import { connectDB } from '../mongo_db';

const router = Router();
const upload = multer(); // memory storage by default

router.get('/', async (req: Request, res: Response) => {
  try {
    const db = await connectDB();
    const users = await db.collection('SaLuDoDataBase').find().toArray();
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Use multer middleware to handle multipart/form-data
router.post('/', upload.single('resume'), async (req: Request, res: Response) => {
  try {
    // Print body fields
    console.log('Received user data (body):', req.body);

    // Print file info if present
    if (req.file) {
      console.log('Received file info:', {
        fieldname: req.file.fieldname,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        buffer: req.file.buffer ? '[Buffer]' : undefined,
      });
      // TODO: Handle file upload to GridFS here
      // Example (commented out):
      // const db = await connectDB();
      // const bucket = new mongodb.GridFSBucket(db);
      // const uploadStream = bucket.openUploadStream(req.file.originalname);
      // uploadStream.end(req.file.buffer);
    } else {
      console.log('No file uploaded.');
    }

    // Commented out: do not upload to MongoDB for now
    // const db = await connectDB();
    // const newUser = req.body;
    // const result = await db.collection('SaLuDoDataBase').insertOne(newUser);

    res.status(201).json({ message: 'User Created' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

export default router;