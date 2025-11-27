// =======================
// PROFILE SERVICE
// =======================
// Purpose: Handle profile photo upload/retrieval/deletion using GridFS
// =======================

import { Db, GridFSBucket, GridFSBucketReadStream, ObjectId } from 'mongodb';
import { ProfilePhotoMetadata } from '../Models/interfaces/ProfileInterfaces';
import { connectDB } from '../mongo_db';
import sharp from 'sharp';

export class ProfileService {
  private static instance: ProfileService;
  private db: Db | null = null;

  private constructor() {}

  static getInstance(): ProfileService {
    if (!ProfileService.instance) {
      ProfileService.instance = new ProfileService();
    }
    return ProfileService.instance;
  }

  private async init(): Promise<void> {
    if (!this.db) {
      this.db = await connectDB();
    }
  }

  // =======================
  // PROFILE PHOTO METHODS
  // =======================

  /**
   * Upload profile photo to GridFS
   * @param userId - User ID
   * @param photoFile - Multer file object
   * @param generateThumbnail - Whether to generate thumbnail (default: true)
   * @returns ProfilePhotoMetadata with file information
   */
  async uploadProfilePhoto(
    userId: string,
    photoFile: Express.Multer.File,
    generateThumbnail: boolean = true
  ): Promise<ProfilePhotoMetadata> {
    await this.init();

    if (!this.db) {
      throw new Error('Database connection not initialized');
    }

    // Validate file type
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(photoFile.mimetype)) {
      throw new Error(`Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`);
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (photoFile.size > maxSize) {
      throw new Error(`File size exceeds maximum of ${maxSize / (1024 * 1024)}MB`);
    }

    const bucket = new GridFSBucket(this.db, { bucketName: 'profilePhotos' });

    // Process image with sharp to ensure consistent format and size
    const processedImage = await sharp(photoFile.buffer)
      .resize(800, 800, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 90 })
      .toBuffer();

    // Upload main photo to GridFS
    const uploadStream = bucket.openUploadStream(photoFile.originalname, {
      metadata: {
        contentType: 'image/jpeg', // Always save as JPEG after processing
        userId: userId,
        uploadedAt: new Date(),
      },
    });

    const fileId = uploadStream.id;
    uploadStream.end(processedImage);

    // Wait for upload to complete
    await new Promise((resolve, reject) => {
      uploadStream.on('finish', resolve);
      uploadStream.on('error', reject);
    });

    // Generate thumbnail if requested
    let thumbnailFileId: string | undefined;
    if (generateThumbnail) {
      const thumbnail = await sharp(photoFile.buffer)
        .resize(150, 150, {
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ quality: 80 })
        .toBuffer();

      const thumbnailStream = bucket.openUploadStream(`${photoFile.originalname}_thumb`, {
        metadata: {
          contentType: 'image/jpeg',
          userId: userId,
          uploadedAt: new Date(),
          isThumbnail: true,
          parentFileId: fileId.toString(),
        },
      });

      const thumbId = thumbnailStream.id;
      thumbnailStream.end(thumbnail);

      await new Promise((resolve, reject) => {
        thumbnailStream.on('finish', resolve);
        thumbnailStream.on('error', reject);
      });

      thumbnailFileId = thumbId.toString();
    }

    const photoMetadata: ProfilePhotoMetadata = {
      fileId: fileId.toString(),
      filename: photoFile.originalname,
      contentType: 'image/jpeg',
      size: processedImage.length,
      uploadedAt: new Date(),
      thumbnailFileId,
    };

    return photoMetadata;
  }

  /**
   * Get profile photo stream from GridFS
   * @param fileId - GridFS file ID
   * @param isThumbnail - Whether to get thumbnail version (default: false)
   * @returns GridFS read stream and metadata
   */
  async getProfilePhoto(
    fileId: string,
    isThumbnail: boolean = false
  ): Promise<{ stream: GridFSBucketReadStream; metadata: any }> {
    await this.init();

    if (!this.db) {
      throw new Error('Database connection not initialized');
    }

    const bucket = new GridFSBucket(this.db, { bucketName: 'profilePhotos' });
    
    try {
      const objectId = new ObjectId(fileId);
      const downloadStream = bucket.openDownloadStream(objectId);

      // Get file metadata
      const files = await this.db
        .collection('profilePhotos.files')
        .findOne({ _id: objectId });

      if (!files) {
        throw new Error('Profile photo not found');
      }

      return {
        stream: downloadStream,
        metadata: files.metadata,
      };
    } catch (error) {
      throw new Error(`Failed to retrieve profile photo: ${error}`);
    }
  }

  /**
   * Delete profile photo from GridFS
   * @param fileId - GridFS file ID
   * @param deleteThumbnail - Whether to also delete thumbnail (default: true)
   */
  async deleteProfilePhoto(
    fileId: string,
    deleteThumbnail: boolean = true
  ): Promise<void> {
    await this.init();

    if (!this.db) {
      throw new Error('Database connection not initialized');
    }

    const bucket = new GridFSBucket(this.db, { bucketName: 'profilePhotos' });

    try {
      const objectId = new ObjectId(fileId);

      // Get file metadata to find thumbnail if it exists
      if (deleteThumbnail) {
        const file = await this.db
          .collection('profilePhotos.files')
          .findOne({ _id: objectId });

        if (file) {
          // Find and delete associated thumbnail
          const thumbnail = await this.db
            .collection('profilePhotos.files')
            .findOne({ 
              'metadata.isThumbnail': true,
              'metadata.parentFileId': fileId 
            });

          if (thumbnail) {
            await bucket.delete(thumbnail._id);
          }
        }
      }

      // Delete main file
      await bucket.delete(objectId);
    } catch (error) {
      throw new Error(`Failed to delete profile photo: ${error}`);
    }
  }

  /**
   * Check if a profile photo exists
   * @param fileId - GridFS file ID
   * @returns boolean indicating if file exists
   */
  async profilePhotoExists(fileId: string): Promise<boolean> {
    await this.init();

    if (!this.db) {
      throw new Error('Database connection not initialized');
    }

    try {
      const objectId = new ObjectId(fileId);
      const file = await this.db
        .collection('profilePhotos.files')
        .findOne({ _id: objectId });

      return file !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get profile photo URL (for future CDN integration)
   * @param userId - User ID
   * @param photoMetadata - Photo metadata
   * @returns URL to photo or placeholder
   */
  getProfilePhotoUrl(userId: string, photoMetadata?: ProfilePhotoMetadata): string {
    if (!photoMetadata) {
      // Return initials-based placeholder or default avatar
      return `/api/users/${userId}/profile/photo/placeholder`;
    }
    return `/api/users/${userId}/profile/photo`;
  }
}

export default ProfileService.getInstance();
