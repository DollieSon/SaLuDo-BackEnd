import { Router, Request, Response } from 'express';
import { connectDB } from '../mongo_db';
const router = Router();

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

router.post('/', async (req: Request, res: Response) => {
  try {
    const db = await connectDB();
    const newUser = req.body;
    const result = await db.collection('SaLuDoDataBase').insertOne(newUser);
    res.status(201).json({ message: 'User created', userId: result.insertedId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

export default router;