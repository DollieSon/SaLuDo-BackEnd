import { connectDB } from '../mongo_db';
import { CommentRepository, CommentFilter, CommentPaginationOptions } from '../repositories/CommentRepository';
import { AuditLogRepository, AuditEventType, AuditSeverity } from '../repositories/AuditLogRepository';
import { Comment, CommentData, CommentEntityType, CreateCommentData, UpdateCommentData, CommentMention } from '../Models/Comment';
import { Db } from 'mongodb';

/**
 * Service for managing comments with business logic and access control
 * All comments are internal/private for HR team collaboration
 */
export class CommentService {
  private commentRepository: CommentRepository | null = null;
  private auditLogRepository: AuditLogRepository | null = null;
  private db: Db | null = null;

  /**
   * Initialize repositories
   */
  private async init(): Promise<void> {
    if (!this.db) {
      this.db = await connectDB();
      this.commentRepository = new CommentRepository(this.db);
      this.auditLogRepository = new AuditLogRepository(this.db);
      await this.commentRepository.init();
    }
  }

  // =======================
  // CREATE OPERATIONS
  // =======================

  /**
   * Create a new comment
   * Validates entity exists and user has access
   */
  async createComment(createData: CreateCommentData): Promise<Comment> {
    await this.init();

    // Validate text
    if (!createData.text || createData.text.trim().length === 0) {
      throw new Error('Comment text cannot be empty');
    }

    if (createData.text.length > 5000) {
      throw new Error('Comment text cannot exceed 5000 characters');
    }

    // Validate entity exists
    await this.validateEntityExists(createData.entityType, createData.entityId);

    // Validate parent comment if replying
    if (createData.parentCommentId) {
      const parentComment = await this.commentRepository!.findById(createData.parentCommentId);
      if (!parentComment) {
        throw new Error('Parent comment not found');
      }
      if (parentComment.isDeleted) {
        throw new Error('Cannot reply to deleted comment');
      }
      // Ensure reply is on same entity
      if (parentComment.entityType !== createData.entityType || parentComment.entityId !== createData.entityId) {
        throw new Error('Reply must be on the same entity as parent comment');
      }
    }

    // Create comment instance
    const comment = Comment.create(createData);

    // Save to database
    const savedComment = await this.commentRepository!.create(comment.toObject());

    // Audit log
    await this.auditLogRepository!.logEvent({
      eventType: AuditEventType.FILE_UPLOADED,
      severity: AuditSeverity.LOW,
      userId: createData.authorId,
      userEmail: createData.authorName,
      ipAddress: '',
      userAgent: '',
      details: {
        action: 'comment_created',
        resource: createData.entityType,
        resourceId: createData.entityId,
        metadata: {
          commentId: comment.commentId,
          isReply: !!createData.parentCommentId
        }
      },
      success: true
    });

    return savedComment;
  }

  // =======================
  // READ OPERATIONS
  // =======================

  /**
   * Get comment by ID
   */
  async getComment(commentId: string, userId: string): Promise<Comment | null> {
    await this.init();

    const comment = await this.commentRepository!.findById(commentId);
    
    if (!comment) {
      return null;
    }

    // Verify user has access to the entity
    await this.validateUserAccess(userId, comment.entityType, comment.entityId);

    return comment;
  }

  /**
   * Get all comments for an entity (candidate or job)
   */
  async getCommentsForEntity(
    entityType: CommentEntityType,
    entityId: string,
    userId: string,
    options: CommentPaginationOptions = {}
  ): Promise<Comment[]> {
    await this.init();

    // Validate entity exists
    await this.validateEntityExists(entityType, entityId);

    // Validate user has access
    await this.validateUserAccess(userId, entityType, entityId);

    return await this.commentRepository!.findByEntity(entityType, entityId, options);
  }

  /**
   * Get top-level comments for an entity (no replies)
   */
  async getTopLevelCommentsForEntity(
    entityType: CommentEntityType,
    entityId: string,
    userId: string,
    options: CommentPaginationOptions = {}
  ): Promise<Comment[]> {
    await this.init();

    // Validate entity exists
    await this.validateEntityExists(entityType, entityId);

    // Validate user has access
    await this.validateUserAccess(userId, entityType, entityId);

    return await this.commentRepository!.findTopLevelByEntity(entityType, entityId, options);
  }

  /**
   * Get replies to a comment
   */
  async getReplies(commentId: string, userId: string): Promise<Comment[]> {
    await this.init();

    const parentComment = await this.commentRepository!.findById(commentId);
    if (!parentComment) {
      throw new Error('Comment not found');
    }

    // Validate user has access
    await this.validateUserAccess(userId, parentComment.entityType, parentComment.entityId);

    return await this.commentRepository!.findReplies(commentId);
  }

  /**
   * Get comments by author
   */
  async getCommentsByAuthor(
    authorId: string,
    options: CommentPaginationOptions = {}
  ): Promise<Comment[]> {
    await this.init();
    return await this.commentRepository!.findByAuthor(authorId, options);
  }

  /**
   * Get comments where user is mentioned
   */
  async getCommentsMentioningUser(
    userId: string,
    options: CommentPaginationOptions = {}
  ): Promise<Comment[]> {
    await this.init();
    return await this.commentRepository!.findByMention(userId, options);
  }

  /**
   * Get comment count for an entity
   */
  async getCommentCount(entityType: CommentEntityType, entityId: string): Promise<number> {
    await this.init();
    return await this.commentRepository!.countByEntity(entityType, entityId);
  }

  /**
   * Get comment statistics for an entity
   */
  async getEntityStats(entityType: CommentEntityType, entityId: string) {
    await this.init();
    return await this.commentRepository!.getEntityStats(entityType, entityId);
  }

  // =======================
  // UPDATE OPERATIONS
  // =======================

  /**
   * Update comment text
   * Only comment author can edit
   */
  async updateComment(
    commentId: string,
    updateData: UpdateCommentData,
    userId: string
  ): Promise<Comment> {
    await this.init();

    const comment = await this.commentRepository!.findById(commentId);
    if (!comment) {
      throw new Error('Comment not found');
    }

    if (comment.isDeleted) {
      throw new Error('Cannot edit deleted comment');
    }

    // Verify user is the author
    if (comment.authorId !== userId) {
      throw new Error('Only the comment author can edit');
    }

    // Update the comment
    comment.updateText(updateData.text, updateData.editedBy, updateData.editedByName);

    // Save to database
    await this.commentRepository!.updateText(comment);

    // Audit log
    await this.auditLogRepository!.logEvent({
      eventType: AuditEventType.USER_UPDATED,
      severity: AuditSeverity.LOW,
      userId: userId,
      userEmail: updateData.editedByName,
      ipAddress: '',
      userAgent: '',
      details: {
        action: 'comment_updated',
        resource: comment.entityType,
        resourceId: comment.entityId,
        metadata: {
          commentId: commentId,
          editCount: comment.getEditCount()
        }
      },
      success: true
    });

    return comment;
  }

  /**
   * Add mentions to a comment
   */
  async addMentions(commentId: string, mentions: CommentMention[]): Promise<void> {
    await this.init();

    const comment = await this.commentRepository!.findById(commentId);
    if (!comment) {
      throw new Error('Comment not found');
    }

    comment.addMentions(mentions);
    await this.commentRepository!.addMentions(comment);
  }

  // =======================
  // DELETE OPERATIONS
  // =======================

  /**
   * Soft delete a comment
   * Only comment author or admin can delete
   */
  async deleteComment(commentId: string, userId: string, isAdmin: boolean = false): Promise<void> {
    await this.init();

    const comment = await this.commentRepository!.findById(commentId);
    if (!comment) {
      throw new Error('Comment not found');
    }

    if (comment.isDeleted) {
      throw new Error('Comment already deleted');
    }

    // Verify user is author or admin
    if (comment.authorId !== userId && !isAdmin) {
      throw new Error('Only the comment author or admin can delete');
    }

    // Soft delete
    await this.commentRepository!.softDelete(commentId, userId);

    // Audit log
    await this.auditLogRepository!.logEvent({
      eventType: AuditEventType.USER_DELETED,
      severity: AuditSeverity.MEDIUM,
      userId: userId,
      userEmail: '',
      ipAddress: '',
      userAgent: '',
      details: {
        action: 'comment_deleted',
        resource: comment.entityType,
        resourceId: comment.entityId,
        metadata: {
          commentId: commentId,
          deletedByAuthor: comment.authorId === userId
        }
      },
      success: true
    });
  }

  /**
   * Restore a soft-deleted comment
   * Admin only
   */
  async restoreComment(commentId: string, userId: string): Promise<void> {
    await this.init();

    const comment = await this.commentRepository!.findById(commentId);
    if (!comment) {
      throw new Error('Comment not found');
    }

    if (!comment.isDeleted) {
      throw new Error('Comment is not deleted');
    }

    await this.commentRepository!.restore(commentId);

    // Audit log
    await this.auditLogRepository!.logEvent({
      eventType: AuditEventType.USER_UPDATED,
      severity: AuditSeverity.MEDIUM,
      userId: userId,
      userEmail: '',
      ipAddress: '',
      userAgent: '',
      details: {
        action: 'comment_restored',
        resource: comment.entityType,
        resourceId: comment.entityId,
        metadata: {
          commentId: commentId
        }
      },
      success: true
    });
  }

  // =======================
  // VALIDATION HELPERS
  // =======================

  /**
   * Validate that an entity exists
   */
  private async validateEntityExists(entityType: CommentEntityType, entityId: string): Promise<void> {
    const db = await connectDB();
    
    let collection: string;
    let idField: string;

    if (entityType === CommentEntityType.CANDIDATE) {
      collection = 'personalinfo';
      idField = 'candidateId';
    } else if (entityType === CommentEntityType.JOB) {
      collection = 'jobs';
      idField = '_id';
    } else {
      throw new Error('Invalid entity type');
    }

    const entity = await db.collection(collection).findOne({ [idField]: entityId });
    if (!entity) {
      throw new Error(`${entityType} not found`);
    }
  }

  /**
   * Validate that a user has access to an entity
   * This is a placeholder - implement based on your access control logic
   */
  private async validateUserAccess(
    userId: string,
    entityType: CommentEntityType,
    entityId: string
  ): Promise<void> {
    // TODO: Implement actual access control logic
    // For candidates: Check if user is assigned HR or admin
    // For jobs: Check if user has permission to view/edit jobs
    
    // For now, allow all authenticated users
    // This should be enhanced based on your specific requirements
    return;
  }

  // =======================
  // UTILITY METHODS
  // =======================

  /**
   * Get recent comment activity
   */
  async getRecentActivity(limit: number = 10): Promise<Comment[]> {
    await this.init();
    return await this.commentRepository!.getRecentActivity(limit);
  }

  /**
   * Parse @mentions from comment text
   * Returns array of usernames mentioned
   */
  parseMentions(text: string): string[] {
    const mentionRegex = /@([a-zA-Z0-9._-]+)/g;
    const mentions: string[] = [];
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      mentions.push(match[1]);
    }

    return [...new Set(mentions)]; // Remove duplicates
  }

  /**
   * Validate that mentioned users exist
   * Returns array of valid user IDs
   */
  async validateMentions(usernames: string[]): Promise<{ userId: string; username: string }[]> {
    if (usernames.length === 0) return [];

    const db = await connectDB();
    const users = await db.collection('users')
      .find({ username: { $in: usernames } })
      .project({ userId: 1, username: 1 })
      .toArray();

    return users.map(u => ({ userId: u.userId, username: u.username }));
  }
}
