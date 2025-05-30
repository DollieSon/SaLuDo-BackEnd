import express, { Request, Response } from 'express';
import cors from 'cors';
import usersRouter from './routes/users';
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
  res.json({ message: 'Here is your data.' });
});

app.use('/api/users', usersRouter);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});