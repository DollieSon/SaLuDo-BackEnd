import { MongoClient, Db } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const URI = process.env.MONGO_URI as string;
if (!URI) {
  console.error('MONGO_URI environment variable is not set. Database connection will fail.');
  console.error('Set MONGO_URI in your .env file with your MongoDB connection string.');
}
const isLocal = URI?.includes('localhost') || URI?.includes('127.0.0.1');

// Configure client options based on connection type
const clientOptions = isLocal 
  ? {} // No TLS for local connections
  : { tls: true }; // TLS for remote connections

const client = new MongoClient(URI, clientOptions);

let db: Db;

export async function connectDB(): Promise<Db> {
  if (!db) {
    console.log('MongoDB Connection Details:');
    console.log('   Type:', isLocal ? 'LOCAL' : 'REMOTE');
    console.log('   URI:', URI ? URI.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@') : 'NOT SET');
    console.log('   Database:', 'SaLuDoTesting');
    console.log('   TLS:', isLocal ? 'Disabled' : 'Enabled');
    
    try {
      await client.connect();
      db = client.db('SaLuDoTesting');
      console.log('Successfully connected to MongoDB');
    } catch (error) {
      console.error('Failed to connect to MongoDB:', error);
      throw error;
    }
  }
  return db;
}