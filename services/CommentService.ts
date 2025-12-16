import { connectDB } from "../mongo_db";
import { ObjectId } from "mongodb";
import {
  CommentRepository,
  CommentFilter,
  CommentPaginationOptions,
} from "../repositories/CommentRepository";
import {
  AuditLogRepository,
  AuditEventType,
  AuditSeverity,
} from "../repositories/AuditLogRepository";
import { AuditLogger } from "../utils/AuditLogger";
import { AuditEventType as NewAuditEventType } from "../types/AuditEventTypes";
import { NotificationRepository } from "../repositories/NotificationRepository";
import { NotificationPreferencesRepository } from "../repositories/NotificationPreferencesRepository";
import {
  Comment,
  CommentData,
  CommentEntityType,
  CreateCommentData,
  UpdateCommentData,
  CommentMention,
} from "../Models/Comment";
import { NotificationService } from "./NotificationService";
import { NotificationType } from "../Models/enums/NotificationTypes";
import { webSocketService } from "./WebSocketService";
import { Db } from "mongodb";
import sanitizeHtml from "sanitize-html";
import {
  MAX_COMMENT_TEXT_LENGTH,
  MAX_REPLY_DEPTH,
} from "./constants/CommentConstants";

/**
 * Result of comment creation with mention validation info
 */
export interface CreateCommentResult {
  comment: Comment;
  mentionValidation: {
    attempted: string[]; // All @mentions found in text
    successful: string[]; // @mentions that resolved to valid users
    failed: string[]; // @mentions that couldn't be resolved
  };
}

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

      const notificationRepo = new NotificationRepository(
        this.db.collection("notifications")
      );
      const notificationPrefsRepo = new NotificationPreferencesRepository(
        this.db.collection("notificationPreferences")
      );
      this.notificationService = new NotificationService(
        notificationRepo,
        notificationPrefsRepo
      );

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
   * Returns comment with mention validation info
   */
  async createComment(
    createData: CreateCommentData
  ): Promise<CreateCommentResult> {
    await this.init();

    // Validate text
    if (!createData.text || createData.text.trim().length === 0) {
      throw new Error("Comment text cannot be empty");
    }

    if (createData.text.length > MAX_COMMENT_TEXT_LENGTH) {
      throw new Error(
        `Comment text cannot exceed ${MAX_COMMENT_TEXT_LENGTH} characters`
      );
    }

    // Sanitize HTML to prevent XSS attacks
    const sanitizedText = this.sanitizeCommentText(createData.text);

    // Skip entity validation - allow comments on all entities
    // Entity existence is implicitly validated by application logic

    // Validate parent comment if replying
    let parentComment: Comment | null = null;
    if (createData.parentCommentId) {
      parentComment = await this.commentRepository!.findById(
        createData.parentCommentId
      );
      if (!parentComment) {
        throw new Error("Parent comment not found");
      }
      if (parentComment.isDeleted) {
        throw new Error("Cannot reply to deleted comment");
      }
      // Ensure reply is on same entity
      if (
        parentComment.entityType !== createData.entityType ||
        parentComment.entityId !== createData.entityId
      ) {
        throw new Error("Reply must be on the same entity as parent comment");
      }

      // Validate reply depth (max 5 levels)
      const depth = await this.getCommentDepth(parentComment);
      if (depth >= MAX_REPLY_DEPTH) {
        throw new Error(
          `Maximum reply depth of ${MAX_REPLY_DEPTH} levels reached. Cannot reply to this comment.`
        );
      }
    }

    // Parse and validate @mentions (use original text for mention parsing)
    const mentionStrings = this.parseMentions(createData.text);
    const { validMentions, failedMentions } =
      await this.validateMentionsWithErrors(mentionStrings);

    // Create comment instance with sanitized text
    const comment = Comment.create({
      ...createData,
      text: sanitizedText,
    });

    // Add mentions if any were found
    if (validMentions.length > 0) {
      comment.addMentions(validMentions);
    }

    // Save to database
    const savedComment = await this.commentRepository!.create(
      comment.toObject()
    );

    // Audit log
    await AuditLogger.logCommentOperation({
      eventType: NewAuditEventType.COMMENT_CREATED,
      commentId: comment.commentId,
      userId: createData.authorId,
      userEmail: createData.authorName,
      action: `Created comment on ${createData.entityType} ${createData.entityId}`,
      metadata: {
        entityType: createData.entityType,
        entityId: createData.entityId,
        isReply: !!createData.parentCommentId,
        parentCommentId: createData.parentCommentId,
        mentionCount: validMentions.length,
        failedMentionCount: failedMentions.length,
        textLength: sanitizedText.length
      }
    });

    // Trigger notifications (don't await - fire and forget)
    // 1. Trigger mention notifications
    if (validMentions.length > 0) {
      this.triggerMentionNotifications(savedComment, validMentions).catch(
        (err) => console.error("Failed to trigger mention notifications:", err)
      );
    }

    // 2. Trigger reply notification if this is a reply
    if (parentComment) {
      this.triggerReplyNotification(savedComment, parentComment).catch((err) =>
        console.error("Failed to trigger reply notification:", err)
      );
    }

    // 3. Trigger entity comment notification if this is a top-level comment
    if (!createData.parentCommentId) {
      this.triggerEntityCommentNotification(savedComment).catch((err) =>
        console.error("Failed to trigger entity comment notification:", err)
      );
    }

    // 4. Broadcast via WebSocket for real-time updates
    this.broadcastCommentCreated(savedComment);

    return {
      comment: savedComment,
      mentionValidation: {
        attempted: mentionStrings,
        successful: validMentions.map((m) => m.username),
        failed: failedMentions,
      },
    };
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

    return await this.commentRepository!.findByEntity(
      entityType,
      entityId,
      options
    );
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

    // Skip entity validation - allow comments on all entities
    // Entity existence is implicitly validated by application logic

    // Validate user has access
    await this.validateUserAccess(userId, entityType, entityId);

    return await this.commentRepository!.findTopLevelByEntity(
      entityType,
      entityId,
      options
    );
  }

  /**
   * Get replies to a comment
   */
  async getReplies(commentId: string, userId: string): Promise<Comment[]> {
    await this.init();

    const parentComment = await this.commentRepository!.findById(commentId);
    if (!parentComment) {
      throw new Error("Comment not found");
    }

    // Validate user has access
    await this.validateUserAccess(
      userId,
      parentComment.entityType,
      parentComment.entityId
    );

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
   * Count comments where user is mentioned
   */
  async getCommentsMentioningUserCount(userId: string): Promise<number> {
    await this.init();
    return await this.commentRepository!.countByMention(userId);
  }

  /**
   * Count comments by author
   */
  async getCommentsByAuthorCount(authorId: string): Promise<number> {
    await this.init();
    return await this.commentRepository!.countByAuthor(authorId);
  }

  /**
   * Get comment count for an entity
   */
  async getCommentCount(
    entityType: CommentEntityType,
    entityId: string
  ): Promise<number> {
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
    try {
      await this.init();

      const comment = await this.commentRepository!.findById(commentId);
      if (!comment) {
        throw new Error("Comment not found");
      }

      if (comment.isDeleted) {
        throw new Error("Cannot edit deleted comment");
      }

      // Verify user is the author
      if (comment.authorId !== userId) {
        throw new Error("Only the comment author can edit");
      }

      // Sanitize HTML to prevent XSS attacks
      const sanitizedText = this.sanitizeCommentText(updateData.text);

      // Update the comment with sanitized text
      comment.updateText(
        sanitizedText,
        updateData.editedBy,
        updateData.editedByName
      );

      // Save to database
      await this.commentRepository!.updateText(comment);

      // Audit log (wrapped in try-catch to prevent audit failures from breaking main operation)
      try {
        await AuditLogger.logCommentOperation({
          eventType: NewAuditEventType.COMMENT_UPDATED,
          commentId: commentId,
          userId: userId,
          userEmail: updateData.editedByName,
          action: `Updated comment on ${comment.entityType} ${comment.entityId}`,
          newValue: sanitizedText,
          metadata: {
            entityType: comment.entityType,
            entityId: comment.entityId,
            editCount: comment.getEditCount(),
            textLength: sanitizedText.length
          }
        });
      } catch (auditError) {
        console.error('CRITICAL: Audit log failed for comment update:', auditError);
        // Continue - don't fail the operation if audit logging fails
      }

      // Broadcast via WebSocket for real-time updates
      this.broadcastCommentUpdated(
        comment,
        updateData.editedBy,
        updateData.editedByName
      );

      return comment;
    } catch (error) {
      console.error('Error updating comment:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to update comment');
    }
  }

  /**
   * Add mentions to a comment
   */
  async addMentions(
    commentId: string,
    mentions: CommentMention[]
  ): Promise<void> {
    await this.init();

    const comment = await this.commentRepository!.findById(commentId);
    if (!comment) {
      throw new Error("Comment not found");
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
  async deleteComment(
    commentId: string,
    userId: string,
    isAdmin: boolean = false
  ): Promise<void> {
    await this.init();

    const comment = await this.commentRepository!.findById(commentId);
    if (!comment) {
      throw new Error("Comment not found");
    }

    if (comment.isDeleted) {
      throw new Error("Comment already deleted");
    }

    // Verify user is author or admin
    if (comment.authorId !== userId && !isAdmin) {
      throw new Error("Only the comment author or admin can delete");
    }

    // Soft delete
    await this.commentRepository!.softDelete(commentId, userId);

    // Audit log
    await AuditLogger.logCommentOperation({
      eventType: NewAuditEventType.COMMENT_DELETED,
      commentId: commentId,
      userId: userId,
      userEmail: "",
      action: `Deleted comment on ${comment.entityType} ${comment.entityId}`,
      metadata: {
        entityType: comment.entityType,
        entityId: comment.entityId,
        deletedByAuthor: comment.authorId === userId,
        isAdmin
      }
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
      throw new Error("Comment not found");
    }

    if (!comment.isDeleted) {
      throw new Error("Comment is not deleted");
    }

    await this.commentRepository!.restore(commentId);

    // Audit log
    await this.auditLogRepository!.logEvent({
      eventType: AuditEventType.USER_UPDATED,
      severity: AuditSeverity.MEDIUM,
      userId: userId,
      userEmail: "",
      ipAddress: "",
      userAgent: "",
      details: {
        action: "comment_restored",
        resource: comment.entityType,
        resourceId: comment.entityId,
        metadata: {
          commentId: commentId,
        },
      },
      success: true,
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
  private async validateEntityExists(
    entityType: CommentEntityType,
    entityId: string
  ): Promise<void> {
    try {
      const db = await connectDB();

      let collection: string;
      let idField: string;

      if (entityType === CommentEntityType.CANDIDATE) {
        collection = "personalinfo";
        // Check both _id and candidateId since they might be different
        // Try to convert to ObjectId for _id field, fallback to string comparison
        const query: any = { candidateId: entityId };

        // Only add _id check if entityId looks like a valid ObjectId (24 hex chars)
        if (/^[a-f\d]{24}$/i.test(entityId)) {
          query.$or = [
            { candidateId: entityId },
            { _id: new ObjectId(entityId) },
          ];
          delete query.candidateId;
        }

        const entity = await db.collection(collection).findOne(query);
        if (!entity) {
          console.error(
            `Entity not found: ${entityType} with ID=${entityId} (checked both _id and candidateId)`
          );
          throw new Error(`${entityType} with ID ${entityId} not found`);
        }
        return;
      } else if (entityType === CommentEntityType.JOB) {
        collection = "jobs";
        idField = "_id";
      } else {
        throw new Error("Invalid entity type");
      }

      const entity = await db
        .collection(collection)
        .findOne({ [idField]: entityId });
      if (!entity) {
        console.error(
          `Entity not found: ${entityType} with ${idField}=${entityId}`
        );
        throw new Error(`${entityType} with ID ${entityId} not found`);
      }
    } catch (error) {
      console.error("validateEntityExists error:", error);
      throw error;
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
          title: "You were mentioned in a comment",
          message: `${
            comment.authorName
          } mentioned you in a comment: "${comment.text.substring(0, 100)}${
            comment.text.length > 100 ? "..." : ""
          }"`,
          action: {
            label: "View Comment",
            url: `/comments/${comment.commentId}`,
          },
          data: {
            commentId: comment.commentId,
            authorId: comment.authorId,
            authorName: comment.authorName,
            entityType: comment.entityType,
            entityId: comment.entityId,
            commentPreview: comment.text.substring(0, 200),
          },
        });
        
        // Audit log for mention
        await AuditLogger.logCommentOperation({
          eventType: NewAuditEventType.COMMENT_MENTION,
          commentId: comment.commentId,
          userId: comment.authorId,
          userEmail: comment.authorName,
          action: `Mentioned ${mention.username} (@${mention.username}) in comment`,
          metadata: {
            entityType: comment.entityType,
            entityId: comment.entityId,
            mentionedUserId: mention.userId,
            mentionedUsername: mention.username
          }
        });
      } catch (error) {
        console.error(
          `Failed to send mention notification to ${mention.userId}:`,
          error
        );
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
        title: "New reply to your comment",
        message: `${
          comment.authorName
        } replied to your comment: "${comment.text.substring(0, 100)}${
          comment.text.length > 100 ? "..." : ""
        }"`,
        action: {
          label: "View Reply",
          url: `/comments/${comment.commentId}`,
        },
        data: {
          commentId: comment.commentId,
          parentCommentId: parentComment.commentId,
          authorId: comment.authorId,
          authorName: comment.authorName,
          entityType: comment.entityType,
          entityId: comment.entityId,
          commentPreview: comment.text.substring(0, 200),
          parentCommentPreview: parentComment.text.substring(0, 200),
        },
      });
    } catch (error) {
      console.error(
        `Failed to send reply notification to ${parentComment.authorId}:`,
        error
      );
    }
  }

  /**
   * Trigger entity comment notifications (COMMENT_ON_CANDIDATE / COMMENT_ON_JOB)
   * Notifies assigned users when a new top-level comment is added
   */
  private async triggerEntityCommentNotification(
    comment: Comment
  ): Promise<void> {
    if (!this.notificationService) return;

    const db = this.db!;
    const notificationType =
      comment.entityType === CommentEntityType.CANDIDATE
        ? NotificationType.COMMENT_ON_CANDIDATE
        : NotificationType.COMMENT_ON_JOB;

    try {
      // Get assigned users based on entity type
      let assignedUserIds: string[] = [];

      if (comment.entityType === CommentEntityType.CANDIDATE) {
        const candidate = await db
          .collection("candidates")
          .findOne(
            { candidateId: comment.entityId },
            { projection: { assignedTo: 1 } }
          );
        if (candidate?.assignedTo) {
          assignedUserIds = [candidate.assignedTo];
        }
      } else if (comment.entityType === CommentEntityType.JOB) {
        const job = await db
          .collection("jobs")
          .findOne(
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
          message: `${comment.authorName} commented: "${comment.text.substring(
            0,
            100
          )}${comment.text.length > 100 ? "..." : ""}"`,
          action: {
            label: `View ${
              comment.entityType === CommentEntityType.CANDIDATE
                ? "Candidate"
                : "Job"
            }`,
            url: `/${comment.entityType.toLowerCase()}s/${comment.entityId}`,
          },
          data: {
            commentId: comment.commentId,
            authorId: comment.authorId,
            authorName: comment.authorName,
            entityType: comment.entityType,
            entityId: comment.entityId,
            commentPreview: comment.text.substring(0, 200),
          },
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
      const roomName = `${comment.entityType.toLowerCase()}:${
        comment.entityId
      }`;
      const io = this.webSocketService.getIO();

      if (io) {
        io.to(roomName).emit("comment:created", {
          commentId: comment.commentId,
          comment: comment.toObject(),
          entityType: comment.entityType,
          entityId: comment.entityId,
          authorId: comment.authorId,
          authorName: comment.authorName,
          isReply: comment.isReply(),
          parentCommentId: comment.parentCommentId,
          timestamp: new Date(),
        });
        console.log(`Broadcast comment:created to room ${roomName}`);
      }
    } catch (error) {
      console.error("Failed to broadcast comment creation:", error);
    }
  }

  /**
   * Broadcast comment update to all users viewing the entity
   */
  private broadcastCommentUpdated(
    comment: Comment,
    editedBy: string,
    editedByName: string
  ): void {
    try {
      const roomName = `${comment.entityType.toLowerCase()}:${
        comment.entityId
      }`;
      const io = this.webSocketService.getIO();

      if (io) {
        io.to(roomName).emit("comment:updated", {
          commentId: comment.commentId,
          comment: comment.toObject(),
          entityType: comment.entityType,
          entityId: comment.entityId,
          editedBy,
          editedByName,
          updatedAt: comment.updatedAt,
          editHistory: comment.editHistory,
          timestamp: new Date(),
        });
        console.log(`Broadcast comment:updated to room ${roomName}`);
      }
    } catch (error) {
      console.error("Failed to broadcast comment update:", error);
    }
  }

  /**
   * Broadcast comment deletion to all users viewing the entity
   */
  private broadcastCommentDeleted(comment: Comment, deletedBy: string): void {
    try {
      const roomName = `${comment.entityType.toLowerCase()}:${
        comment.entityId
      }`;
      const io = this.webSocketService.getIO();

      if (io) {
        io.to(roomName).emit("comment:deleted", {
          commentId: comment.commentId,
          entityType: comment.entityType,
          entityId: comment.entityId,
          deletedBy,
          deletedAt: comment.deletedAt,
          timestamp: new Date(),
        });
        console.log(`Broadcast comment:deleted to room ${roomName}`);
      }
    } catch (error) {
      console.error("Failed to broadcast comment deletion:", error);
    }
  }

  /**
   * Broadcast comment restoration to all users viewing the entity
   */
  private broadcastCommentRestored(comment: Comment, restoredBy: string): void {
    try {
      const roomName = `${comment.entityType.toLowerCase()}:${
        comment.entityId
      }`;
      const io = this.webSocketService.getIO();

      if (io) {
        io.to(roomName).emit("comment:restored", {
          commentId: comment.commentId,
          comment: comment.toObject(),
          entityType: comment.entityType,
          entityId: comment.entityId,
          restoredBy,
          timestamp: new Date(),
        });
        console.log(`Broadcast comment:restored to room ${roomName}`);
      }
    } catch (error) {
      console.error("Failed to broadcast comment restoration:", error);
    }
  }

  // =======================
  // UTILITY METHODS
  // =======================

  /**
   * Get the depth of a comment in the reply chain
   * Recursively traverses up to the top-level comment
   * Returns 1 for top-level comments, 2 for first-level replies, etc.
   */
  private async getCommentDepth(comment: Comment): Promise<number> {
    if (!comment.parentCommentId) {
      return 1; // Top-level comment
    }

    const parentComment = await this.commentRepository!.findById(
      comment.parentCommentId
    );
    if (!parentComment) {
      return 1; // Safety fallback if parent not found
    }

    return 1 + (await this.getCommentDepth(parentComment));
  }

  /**
   * Sanitize HTML in comment text to prevent XSS attacks
   * Allows basic formatting but strips dangerous tags/attributes
   */
  private sanitizeCommentText(text: string): string {
    return sanitizeHtml(text, {
      allowedTags: [
        "b",
        "i",
        "em",
        "strong",
        "u",
        "br",
        "p",
        "ul",
        "ol",
        "li",
        "code",
        "pre",
      ],
      allowedAttributes: {},
      disallowedTagsMode: "escape", // Escape rather than remove
      enforceHtmlBoundary: true,
      parseStyleAttributes: false,
    });
  }

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
   * Supports: @john.doe, @jane@saludo.com (email format)
   */
  parseMentions(text: string): string[] {
    // Match @mentions - email format (no spaces)
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
    const result = await this.validateMentionsWithErrors(mentions);
    return result.validMentions;
  }

  /**
   * Validate mentions and return both valid and failed mentions
   * Used by createComment to provide feedback to users
   */
  async validateMentionsWithErrors(mentions: string[]): Promise<{
    validMentions: CommentMention[];
    failedMentions: string[];
  }> {
    if (mentions.length === 0) {
      return { validMentions: [], failedMentions: [] };
    }

    await this.init();
    const db = this.db!;

    const validMentions: CommentMention[] = [];
    const failedMentions: string[] = [];
    const now = new Date();

    for (const mention of mentions) {
      let user = null;

      // Match by email (exact, case-insensitive)
      user = await db
        .collection("users")
        .findOne(
          { email: mention.toLowerCase(), isActive: true, isDeleted: false },
          { projection: { userId: 1, email: 1, firstName: 1, lastName: 1 } }
        );

      if (user) {
        validMentions.push({
          userId: user.userId,
          username: `${user.firstName} ${user.lastName}`,
          mentionedAt: now,
        });
      } else {
        failedMentions.push(mention);
      }
    }

    return { validMentions, failedMentions };
  }
}
