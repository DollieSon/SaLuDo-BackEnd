import { Db, Collection } from 'mongodb';
import { Comment, CommentData, CommentEntityType, CreateCommentData } from '../Models/Comment';

/**
 * Filter options for querying comments
 */
export interface CommentFilter {
  entityType?: CommentEntityType;
  entityId?: string;
  authorId?: string;
  parentCommentId?: string | null;
  includeDeleted?: boolean;
  mentionsUserId?: string;
}

/**
 * Pagination options for comment queries
 */
export interface CommentPaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Repository for Comment data access
 * Handles all MongoDB operations for comments
 */
export class CommentRepository {
  private db: Db;
  private collection: Collection<CommentData>;

  constructor(db: Db) {
    this.db = db;
    this.collection = this.db.collection<CommentData>('comments');
  }

  /**
   * Initialize repository and create indexes
   */
  async init(): Promise<void> {
    await this.createIndexes();
  }

  /**
   * Create MongoDB indexes for optimal query performance
   */
  private async createIndexes(): Promise<void> {
    await this.collection.createIndex({ commentId: 1 }, { unique: true });
    await this.collection.createIndex({ entityType: 1, entityId: 1, createdAt: -1 });
    await this.collection.createIndex({ authorId: 1, createdAt: -1 });
    await this.collection.createIndex({ 'mentions.userId': 1 });
    await this.collection.createIndex({ parentCommentId: 1 });
    await this.collection.createIndex({ isDeleted: 1 });
    await this.collection.createIndex({ entityType: 1, entityId: 1, isDeleted: 1, createdAt: -1 });
  }

  // =======================
  // CREATE OPERATIONS
  // =======================

  /**
   * Create a new comment
   */
  async create(commentData: CommentData): Promise<Comment> {
    await this.collection.insertOne(commentData);
    return Comment.fromObject(commentData);
  }

  // =======================
  // READ OPERATIONS
  // =======================

  /**
   * Find comment by ID
   */
  async findById(commentId: string): Promise<Comment | null> {
    const data = await this.collection.findOne({ commentId });
    return data ? Comment.fromObject(data) : null;
  }

  /**
   * Get all comments for a specific entity (candidate or job)
   */
  async findByEntity(
    entityType: CommentEntityType,
    entityId: string,
    options: CommentPaginationOptions = {}
  ): Promise<Comment[]> {
    const {
      page = 1,
      limit = 50,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = options;

    const skip = (page - 1) * limit;
    const sort: any = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const data = await this.collection
      .find({ entityType, entityId, isDeleted: false })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray();

    return data.map(d => Comment.fromObject(d));
  }

  /**
   * Get all top-level comments for an entity (no replies)
   */
  async findTopLevelByEntity(
    entityType: CommentEntityType,
    entityId: string,
    options: CommentPaginationOptions = {}
  ): Promise<Comment[]> {
    const {
      page = 1,
      limit = 50,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = options;

    const skip = (page - 1) * limit;
    const sort: any = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const data = await this.collection
      .find({ 
        entityType, 
        entityId, 
        parentCommentId: null,
        isDeleted: false 
      })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray();

    return data.map(d => Comment.fromObject(d));
  }

  /**
   * Get all replies to a specific comment
   */
  async findReplies(parentCommentId: string): Promise<Comment[]> {
    const data = await this.collection
      .find({ parentCommentId, isDeleted: false })
      .sort({ createdAt: 1 })
      .toArray();

    return data.map(d => Comment.fromObject(d));
  }

  /**
   * Get comments by author
   */
  async findByAuthor(
    authorId: string,
    options: CommentPaginationOptions = {}
  ): Promise<Comment[]> {
    const {
      page = 1,
      limit = 50,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = options;

    const skip = (page - 1) * limit;
    const sort: any = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const data = await this.collection
      .find({ authorId, isDeleted: false })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray();

    return data.map(d => Comment.fromObject(d));
  }

  /**
   * Get comments where a user is mentioned
   */
  async findByMention(
    userId: string,
    options: CommentPaginationOptions = {}
  ): Promise<Comment[]> {
    const {
      page = 1,
      limit = 50,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = options;

    const skip = (page - 1) * limit;
    const sort: any = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const data = await this.collection
      .find({ 
        'mentions.userId': userId,
        isDeleted: false 
      })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray();

    return data.map(d => Comment.fromObject(d));
  }

  /**
   * Get comments with flexible filtering
   */
  async findWithFilter(
    filter: CommentFilter,
    options: CommentPaginationOptions = {}
  ): Promise<Comment[]> {
    const {
      page = 1,
      limit = 50,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = options;

    const skip = (page - 1) * limit;
    const sort: any = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const query: any = {};
    // ass
    if (filter.entityType) query.entityType = filter.entityType;
    if (filter.entityId) query.entityId = filter.entityId;
    if (filter.authorId) query.authorId = filter.authorId;
    if (filter.parentCommentId !== undefined) query.parentCommentId = filter.parentCommentId;
    if (filter.mentionsUserId) query['mentions.userId'] = filter.mentionsUserId;
    if (!filter.includeDeleted) query.isDeleted = false;

    const data = await this.collection
      .find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray();

    return data.map(d => Comment.fromObject(d));
  }

  /**
   * Count comments for an entity
   */
  async countByEntity(entityType: CommentEntityType, entityId: string): Promise<number> {
    return await this.collection.countDocuments({ 
      entityType, 
      entityId, 
      isDeleted: false 
    });
  }

  /**
   * Count replies to a comment
   */
  async countReplies(parentCommentId: string): Promise<number> {
    return await this.collection.countDocuments({ 
      parentCommentId, 
      isDeleted: false 
    });
  }

  /**
   * Count comments where a user is mentioned
   */
  async countByMention(userId: string): Promise<number> {
    return await this.collection.countDocuments({
      'mentions.userId': userId,
      isDeleted: false
    });
  }

  /**
   * Count comments by author
   */
  async countByAuthor(authorId: string): Promise<number> {
    return await this.collection.countDocuments({
      authorId,
      isDeleted: false
    });
  }

  // =======================
  // UPDATE OPERATIONS
  // =======================

  /**
   * Update a comment
   * WARNING: Use specific update methods (updateText, addMentions) instead
   * This method is kept for backward compatibility but should be avoided
   */
  async update(commentId: string, commentData: Partial<CommentData>): Promise<void> {
    // Only set provided fields to prevent unintentional overwrites
    const updateFields: any = {};
    
    if (commentData.text !== undefined) updateFields.text = commentData.text;
    if (commentData.entityType !== undefined) updateFields.entityType = commentData.entityType;
    if (commentData.entityId !== undefined) updateFields.entityId = commentData.entityId;
    if (commentData.authorId !== undefined) updateFields.authorId = commentData.authorId;
    if (commentData.authorName !== undefined) updateFields.authorName = commentData.authorName;
    if (commentData.mentions !== undefined) updateFields.mentions = commentData.mentions;
    if (commentData.parentCommentId !== undefined) updateFields.parentCommentId = commentData.parentCommentId;
    if (commentData.editHistory !== undefined) updateFields.editHistory = commentData.editHistory;
    if (commentData.isDeleted !== undefined) updateFields.isDeleted = commentData.isDeleted;
    if (commentData.deletedAt !== undefined) updateFields.deletedAt = commentData.deletedAt;
    if (commentData.deletedBy !== undefined) updateFields.deletedBy = commentData.deletedBy;
    
    updateFields.updatedAt = new Date();
    
    const result = await this.collection.updateOne(
      { commentId },
      { $set: updateFields }
    );
    
    if (result.matchedCount === 0) {
      throw new Error('Comment not found');
    }
  }

  /**
   * Update comment text and add to edit history
   */
  async updateText(comment: Comment): Promise<void> {
    await this.collection.updateOne(
      { commentId: comment.commentId },
      { 
        $set: { 
          text: comment.text,
          updatedAt: comment.updatedAt,
          editHistory: comment.editHistory
        } 
      }
    );
  }

  /**
   * Soft delete a comment
   */
  async softDelete(commentId: string, deletedBy: string): Promise<void> {
    const now = new Date();
    await this.collection.updateOne(
      { commentId },
      { 
        $set: { 
          isDeleted: true,
          deletedAt: now,
          deletedBy: deletedBy,
          updatedAt: now
        } 
      }
    );
  }

  /**
   * Restore a soft-deleted comment
   */
  async restore(commentId: string): Promise<void> {
    await this.collection.updateOne(
      { commentId },
      { 
        $set: { 
          isDeleted: false,
          updatedAt: new Date()
        },
        $unset: {
          deletedAt: '',
          deletedBy: ''
        }
      }
    );
  }

  /**
   * Add mentions to a comment
   */
  async addMentions(comment: Comment): Promise<void> {
    await this.collection.updateOne(
      { commentId: comment.commentId },
      { 
        $set: { 
          mentions: comment.mentions,
          updatedAt: comment.updatedAt
        } 
      }
    );
  }

  // =======================
  // DELETE OPERATIONS
  // =======================

  /**
   * Hard delete a comment (permanent removal)
   * Use with caution - prefer soft delete
   */
  async delete(commentId: string): Promise<void> {
    await this.collection.deleteOne({ commentId });
  }

  /**
   * Hard delete all comments for an entity
   * Use when entity is permanently deleted
   */
  async deleteByEntity(entityType: CommentEntityType, entityId: string): Promise<void> {
    await this.collection.deleteMany({ entityType, entityId });
  }

  // =======================
  // UTILITY OPERATIONS
  // =======================

  /**
   * Check if a comment exists
   */
  async exists(commentId: string): Promise<boolean> {
    const count = await this.collection.countDocuments({ commentId });
    return count > 0;
  }

  /**
   * Get comment statistics for an entity
   */
  async getEntityStats(entityType: CommentEntityType, entityId: string): Promise<{
    totalComments: number;
    topLevelComments: number;
    replies: number;
    uniqueAuthors: number;
  }> {
    const totalComments = await this.collection.countDocuments({ 
      entityType, 
      entityId, 
      isDeleted: false 
    });

    const topLevelComments = await this.collection.countDocuments({ 
      entityType, 
      entityId, 
      parentCommentId: null,
      isDeleted: false 
    });

    const replies = totalComments - topLevelComments;

    const authors = await this.collection.distinct('authorId', { 
      entityType, 
      entityId, 
      isDeleted: false 
    });

    return {
      totalComments,
      topLevelComments,
      replies,
      uniqueAuthors: authors.length
    };
  }

  /**
   * Get recent activity (latest comments)
   */
  async getRecentActivity(limit: number = 10): Promise<Comment[]> {
    const data = await this.collection
      .find({ isDeleted: false })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    return data.map(d => Comment.fromObject(d));
  }
}
