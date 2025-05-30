import { MongoClient, Db } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const URI = process.env.MONGO_URI as string;
const client = new MongoClient(URI, { tls: true });

let db: Db;

export async function connectDB(): Promise<Db> {
  if (!db) {
    await client.connect();
    db = client.db('SaLuDoTesting');
    console.log('Connected to MongoDB');
  }
  return db;
}