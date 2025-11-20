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
      
      // Create indexes for notification system
      await createNotificationIndexes(db);
    } catch (error) {
      console.error('Failed to connect to MongoDB:', error);
      throw error;
    }
  }
  return db;
}

/**
 * Create indexes for notification collections
 */
async function createNotificationIndexes(database: Db): Promise<void> {
  try {
    const notificationsCollection = database.collection('notifications');
    const preferencesCollection = database.collection('notificationPreferences');

    // Notifications collection indexes
    await notificationsCollection.createIndex({ notificationId: 1 }, { unique: true });
    await notificationsCollection.createIndex({ userId: 1, createdAt: -1 });
    await notificationsCollection.createIndex({ userId: 1, isRead: 1 });
    await notificationsCollection.createIndex({ userId: 1, isArchived: 1 });
    await notificationsCollection.createIndex({ type: 1 });
    await notificationsCollection.createIndex({ category: 1 });
    await notificationsCollection.createIndex({ priority: 1 });
    await notificationsCollection.createIndex({ expiresAt: 1 }, { sparse: true });
    await notificationsCollection.createIndex({ groupKey: 1 }, { sparse: true });
    await notificationsCollection.createIndex({ sourceId: 1, sourceType: 1 }, { sparse: true });
    
    // Composite indexes for common queries
    await notificationsCollection.createIndex({ 
      userId: 1, 
      isRead: 1, 
      isArchived: 1, 
      createdAt: -1 
    });
    await notificationsCollection.createIndex({ 
      userId: 1, 
      category: 1, 
      createdAt: -1 
    });
    
    // Channel-specific delivery status indexes
    await notificationsCollection.createIndex({ 
      channels: 1, 
      'deliveryStatus.inApp.status': 1 
    });
    await notificationsCollection.createIndex({ 
      channels: 1, 
      'deliveryStatus.email.status': 1 
    });

    // Notification preferences indexes
    await preferencesCollection.createIndex({ userId: 1 }, { unique: true });
    await preferencesCollection.createIndex({ enabled: 1 });
    await preferencesCollection.createIndex({ 'emailDigest.enabled': 1, 'emailDigest.frequency': 1 });

    console.log('✓ Notification system indexes created successfully');
  } catch (error) {
    console.error('Warning: Failed to create notification indexes:', error);
    // Don't throw - allow app to continue even if index creation fails
  }
}