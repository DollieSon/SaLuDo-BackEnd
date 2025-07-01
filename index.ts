import express, { Request, Response } from 'express';
import cors from 'cors';
import usersRouter from './routes/users';
import jobRouter from './routes/job';
import candidatesRouter from './routes/candidates-core';
import skillsRouter from './routes/skills';
import experienceRouter from './routes/experience';
import educationRouter from './routes/education';
import certificationsRouter from './routes/certifications';
import strengthsWeaknessesRouter from './routes/strengths-weaknesses';
import transcriptsRouter from './routes/transcripts';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  res.send('Hello from Render!');
});

app.get('/api/data', (req: Request, res: Response) => {
  console.log('something heheh');
  res.json({ message: 'Here is your data.' });
});

app.use('/api/users', usersRouter);
app.use('/api/jobs', jobRouter);  // Changed from /api/job to /api/jobs
app.use('/api/candidates', candidatesRouter);
app.use('/api/candidates', skillsRouter);  // Candidate-specific skill routes
app.use('/api/skills', skillsRouter);       // Global skill routes (search, master data)
app.use('/api/candidates', experienceRouter);
app.use('/api/candidates', educationRouter);
app.use('/api/candidates', certificationsRouter);
app.use('/api/candidates', strengthsWeaknessesRouter);
app.use('/api/candidates/:candidateId/transcripts', transcriptsRouter); // Transcript routes

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});