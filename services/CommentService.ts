import { connectDB } from '../mongo_db';
import { CommentRepository, CommentFilter, CommentPaginationOptions } from '../repositories/CommentRepository';
import { AuditLogRepository, AuditEventType, AuditSeverity } from '../repositories/AuditLogRepository';
import { NotificationRepository } from '../repositories/NotificationRepository';
import { NotificationPreferencesRepository } from '../repositories/NotificationPreferencesRepository';
import { Comment, CommentData, CommentEntityType, CreateCommentData, UpdateCommentData, CommentMention } from '../Models/Comment';
import { NotificationService } from './NotificationService';
import { NotificationType } from '../Models/enums/NotificationTypes';
import { webSocketService } from './WebSocketService';
import { Db } from 'mongodb';

/**
 * Service for managing comments with business logic and access control
 * All comments are internal/private for HR team collaboration
 */
export class CommentService {
  private commentRepository: CommentRepository | null = null;
  private auditLogRepository: AuditLogRepository | null = null;
  private notificationService: NotificationService | null = null;
  private webSocketService = webSocketService;
  private db: Db | null = null;

  /**
   * Initialize repositories
   */
  private async init(): Promise<void> {
    if (!this.db) {
      this.db = await connectDB();
      this.commentRepository = new CommentRepository(this.db);
      this.auditLogRepository = new AuditLogRepository(this.db);
      
      const notificationRepo = new NotificationRepository(this.db.collection('notifications'));
      const notificationPrefsRepo = new NotificationPreferencesRepository(this.db.collection('notificationPreferences'));
      this.notificationService = new NotificationService(notificationRepo, notificationPrefsRepo);
      
      await this.commentRepository.init();
    }
  }

  // =======================
  // CREATE OPERATIONS
  // =======================

  /**
   * Create a new comment
   * Validates entity exists and user has access
   * Auto-parses @mentions and stores them
   * Triggers notifications for mentions, replies, and entity comments
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
    let parentComment: Comment | null = null;
    if (createData.parentCommentId) {
      parentComment = await this.commentRepository!.findById(createData.parentCommentId);
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

    // Parse and validate @mentions
    const mentionStrings = this.parseMentions(createData.text);
    const validMentions = await this.validateMentions(mentionStrings);

    // Create comment instance
    const comment = Comment.create(createData);
    
    // Add mentions if any were found
    if (validMentions.length > 0) {
      comment.addMentions(validMentions);
    }

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
          isReply: !!createData.parentCommentId,
          mentionCount: validMentions.length
        }
      },
      success: true
    });

    // Trigger notifications (don't await - fire and forget)
    // 1. Trigger mention notifications
    if (validMentions.length > 0) {
      this.triggerMentionNotifications(savedComment, validMentions).catch(err => 
        console.error('Failed to trigger mention notifications:', err)
      );
    }

    // 2. Trigger reply notification if this is a reply
    if (parentComment) {
      this.triggerReplyNotification(savedComment, parentComment).catch(err =>
        console.error('Failed to trigger reply notification:', err)
      );
    }

    // 3. Trigger entity comment notification if this is a top-level comment
    if (!createData.parentCommentId) {
      this.triggerEntityCommentNotification(savedComment).catch(err =>
        console.error('Failed to trigger entity comment notification:', err)
      );
    }

    // 4. Broadcast via WebSocket for real-time updates
    this.broadcastCommentCreated(savedComment);

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

    // Broadcast via WebSocket for real-time updates
    this.broadcastCommentUpdated(comment, updateData.editedBy, updateData.editedByName);

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

    // Broadcast via WebSocket for real-time updates
    this.broadcastCommentDeleted(comment, userId);
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

    // Broadcast via WebSocket for real-time updates
    this.broadcastCommentRestored(comment, userId);
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
  // NOTIFICATION METHODS
  // =======================

  /**
   * Trigger COMMENT_MENTION notifications for mentioned users
   */
  private async triggerMentionNotifications(
    comment: Comment,
    mentionedUsers: CommentMention[]
  ): Promise<void> {
    if (mentionedUsers.length === 0 || !this.notificationService) return;

    for (const mention of mentionedUsers) {
      try {
        await this.notificationService.createNotification({
          userId: mention.userId,
          type: NotificationType.COMMENT_MENTION,
          title: 'You were mentioned in a comment',
          message: `${comment.authorName} mentioned you in a comment: "${comment.text.substring(0, 100)}${comment.text.length > 100 ? '...' : ''}"`,
          action: {
            label: 'View Comment',
            url: `/comments/${comment.commentId}`
          },
          data: {
            commentId: comment.commentId,
            authorId: comment.authorId,
            authorName: comment.authorName,
            entityType: comment.entityType,
            entityId: comment.entityId,
            commentPreview: comment.text.substring(0, 200)
          }
        });
      } catch (error) {
        console.error(`Failed to send mention notification to ${mention.userId}:`, error);
      }
    }
  }

  /**
   * Trigger COMMENT_REPLY notification for parent comment author
   */
  private async triggerReplyNotification(
    comment: Comment,
    parentComment: Comment
  ): Promise<void> {
    if (!this.notificationService) return;
    
    // Don't notify if replying to own comment
    if (comment.authorId === parentComment.authorId) return;

    try {
      await this.notificationService.createNotification({
        userId: parentComment.authorId,
        type: NotificationType.COMMENT_REPLY,
        title: 'New reply to your comment',
        message: `${comment.authorName} replied to your comment: "${comment.text.substring(0, 100)}${comment.text.length > 100 ? '...' : ''}"`,
        action: {
          label: 'View Reply',
          url: `/comments/${comment.commentId}`
        },
        data: {
          commentId: comment.commentId,
          parentCommentId: parentComment.commentId,
          authorId: comment.authorId,
          authorName: comment.authorName,
          entityType: comment.entityType,
          entityId: comment.entityId,
          commentPreview: comment.text.substring(0, 200),
          parentCommentPreview: parentComment.text.substring(0, 200)
        }
      });
    } catch (error) {
      console.error(`Failed to send reply notification to ${parentComment.authorId}:`, error);
    }
  }

  /**
   * Trigger entity comment notifications (COMMENT_ON_CANDIDATE / COMMENT_ON_JOB)
   * Notifies assigned users when a new top-level comment is added
   */
  private async triggerEntityCommentNotification(comment: Comment): Promise<void> {
    if (!this.notificationService) return;

    const db = this.db!;
    const notificationType = comment.entityType === CommentEntityType.CANDIDATE
      ? NotificationType.COMMENT_ON_CANDIDATE
      : NotificationType.COMMENT_ON_JOB;

    try {
      // Get assigned users based on entity type
      let assignedUserIds: string[] = [];

      if (comment.entityType === CommentEntityType.CANDIDATE) {
        const candidate = await db.collection('candidates').findOne(
          { candidateId: comment.entityId },
          { projection: { assignedTo: 1 } }
        );
        if (candidate?.assignedTo) {
          assignedUserIds = [candidate.assignedTo];
        }
      } else if (comment.entityType === CommentEntityType.JOB) {
        const job = await db.collection('jobs').findOne(
          { jobId: comment.entityId },
          { projection: { createdBy: 1 } }
        );
        if (job?.createdBy) {
          assignedUserIds = [job.createdBy];
        }
      }

      // Notify each assigned user (excluding the comment author)
      for (const userId of assignedUserIds) {
        if (userId === comment.authorId) continue; // Don't notify self

        await this.notificationService.createNotification({
          userId: userId,
          type: notificationType,
          title: `New comment on ${comment.entityType.toLowerCase()}`,
          message: `${comment.authorName} commented: "${comment.text.substring(0, 100)}${comment.text.length > 100 ? '...' : ''}"`,
          action: {
            label: `View ${comment.entityType === CommentEntityType.CANDIDATE ? 'Candidate' : 'Job'}`,
            url: `/${comment.entityType.toLowerCase()}s/${comment.entityId}`
          },
          data: {
            commentId: comment.commentId,
            authorId: comment.authorId,
            authorName: comment.authorName,
            entityType: comment.entityType,
            entityId: comment.entityId,
            commentPreview: comment.text.substring(0, 200)
          }
        });
      }
    } catch (error) {
      console.error(`Failed to send entity comment notification:`, error);
    }
  }

  // =======================
  // WEBSOCKET BROADCAST METHODS
  // =======================

  /**
   * Broadcast comment creation to all users viewing the entity
   */
  private broadcastCommentCreated(comment: Comment): void {
    try {
      const roomName = `${comment.entityType.toLowerCase()}:${comment.entityId}`;
      const io = this.webSocketService.getIO();
      
      if (io) {
        io.to(roomName).emit('comment:created', {
          commentId: comment.commentId,
          comment: comment.toObject(),
          entityType: comment.entityType,
          entityId: comment.entityId,
          authorId: comment.authorId,
          authorName: comment.authorName,
          isReply: comment.isReply(),
          parentCommentId: comment.parentCommentId,
          timestamp: new Date()
        });
        console.log(`Broadcast comment:created to room ${roomName}`);
      }
    } catch (error) {
      console.error('Failed to broadcast comment creation:', error);
    }
  }

  /**
   * Broadcast comment update to all users viewing the entity
   */
  private broadcastCommentUpdated(comment: Comment, editedBy: string, editedByName: string): void {
    try {
      const roomName = `${comment.entityType.toLowerCase()}:${comment.entityId}`;
      const io = this.webSocketService.getIO();
      
      if (io) {
        io.to(roomName).emit('comment:updated', {
          commentId: comment.commentId,
          comment: comment.toObject(),
          entityType: comment.entityType,
          entityId: comment.entityId,
          editedBy,
          editedByName,
          updatedAt: comment.updatedAt,
          editHistory: comment.editHistory,
          timestamp: new Date()
        });
        console.log(`Broadcast comment:updated to room ${roomName}`);
      }
    } catch (error) {
      console.error('Failed to broadcast comment update:', error);
    }
  }

  /**
   * Broadcast comment deletion to all users viewing the entity
   */
  private broadcastCommentDeleted(comment: Comment, deletedBy: string): void {
    try {
      const roomName = `${comment.entityType.toLowerCase()}:${comment.entityId}`;
      const io = this.webSocketService.getIO();
      
      if (io) {
        io.to(roomName).emit('comment:deleted', {
          commentId: comment.commentId,
          entityType: comment.entityType,
          entityId: comment.entityId,
          deletedBy,
          deletedAt: comment.deletedAt,
          timestamp: new Date()
        });
        console.log(`Broadcast comment:deleted to room ${roomName}`);
      }
    } catch (error) {
      console.error('Failed to broadcast comment deletion:', error);
    }
  }

  /**
   * Broadcast comment restoration to all users viewing the entity
   */
  private broadcastCommentRestored(comment: Comment, restoredBy: string): void {
    try {
      const roomName = `${comment.entityType.toLowerCase()}:${comment.entityId}`;
      const io = this.webSocketService.getIO();
      
      if (io) {
        io.to(roomName).emit('comment:restored', {
          commentId: comment.commentId,
          comment: comment.toObject(),
          entityType: comment.entityType,
          entityId: comment.entityId,
          restoredBy,
          timestamp: new Date()
        });
        console.log(`Broadcast comment:restored to room ${roomName}`);
      }
    } catch (error) {
      console.error('Failed to broadcast comment restoration:', error);
    }
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
   * Returns array of mentioned usernames/emails (without @ symbol)
   * Examples: @john.doe, @jane@saludo.com
   */
  parseMentions(text: string): string[] {
    const mentionRegex = /@([a-zA-Z0-9._@-]+)/g;
    const mentions: string[] = [];
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      mentions.push(match[1]);
    }

    return [...new Set(mentions)]; // Remove duplicates
  }

  /**
   * Validate that mentioned users exist
   * Searches by:
   * - Email (exact match)
   * - firstName.lastName pattern (case-insensitive)
   * Returns array of valid CommentMention objects
   */
  async validateMentions(mentions: string[]): Promise<CommentMention[]> {
    if (mentions.length === 0) return [];

    await this.init();
    const db = this.db!;
    
    const validMentions: CommentMention[] = [];
    const now = new Date();

    for (const mention of mentions) {
      let user = null;

      // Try email match first (exact)
      if (mention.includes('@')) {
        user = await db.collection('users').findOne(
          { email: mention.toLowerCase(), isActive: true, isDeleted: false },
          { projection: { userId: 1, email: 1, firstName: 1, lastName: 1 } }
        );
      } else {
        // Try firstName.lastName pattern (case-insensitive)
        const parts = mention.split('.');
        if (parts.length === 2) {
          const [firstName, lastName] = parts;
          user = await db.collection('users').findOne(
            {
              firstName: { $regex: new RegExp(`^${firstName}$`, 'i') },
              lastName: { $regex: new RegExp(`^${lastName}$`, 'i') },
              isActive: true,
              isDeleted: false
            },
            { projection: { userId: 1, email: 1, firstName: 1, lastName: 1 } }
          );
        }
      }

      if (user) {
        validMentions.push({
          userId: user.userId,
          username: `${user.firstName} ${user.lastName}`,
          mentionedAt: now
        });
      }
    }

    return validMentions;
  }
}
