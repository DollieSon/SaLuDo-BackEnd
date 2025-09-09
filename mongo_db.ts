import { MongoClient, Db } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const URI = process.env.MONGO_URI as string;
const isLocal = URI.includes('localhost') || URI.includes('127.0.0.1');

// Configure client options based on environment
const clientOptions = isLocal 
  ? {} // No TLS for local connections
  : { tls: true }; // TLS for remote connections

const client = new MongoClient(URI, clientOptions);

let db: Db;

export async function connectDB(): Promise<Db> {
  if (!db) {
    await client.connect();
    db = client.db('SaLuDoTesting');
    
    // Log database connection type
    if (isLocal) {
      console.log('🔧 Connected to LOCAL MongoDB database at:', URI.split('@')[1] || URI.split('//')[1]);
    } else {
      console.log('🌐 Connected to REMOTE MongoDB database');
    }
  }
  return db;
}