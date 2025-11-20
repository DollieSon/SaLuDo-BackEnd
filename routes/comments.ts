import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { CommentService } from '../services/CommentService';
import { CommentEntityType, CreateCommentData, UpdateCommentData } from '../Models/Comment';
import { AuthMiddleware, AuthenticatedRequest } from './middleware/auth';
import { asyncHandler } from './middleware/errorHandler';
import { UserRole } from '../Models/User';

const router = Router();
const commentService = new CommentService();

// ====================
// RATE LIMITERS
// ====================

/**
 * Standard rate limit for CRUD operations
 * 30 requests per minute per user
 */
const standardCommentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  message: 'Too many comment requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: AuthenticatedRequest) => {
    // Rate limit per user
    return req.user?.userId || req.ip || 'anonymous';
  }
});

/**
 * Strict rate limit for real-time endpoints (typing, presence)
 * 60 requests per minute per user (1 per second average)
 */
const realtimeCommentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  message: 'Too many real-time requests, please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: AuthenticatedRequest) => {
    return req.user?.userId || req.ip || 'anonymous';
  }
});

/**
 * Very strict rate limit for autocomplete (prevent user enumeration)
 * 20 requests per minute per user
 */
const autocompleteLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  message: 'Too many autocomplete requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: AuthenticatedRequest) => {
    return req.user?.userId || req.ip || 'anonymous';
  }
});

// ====================
// COMMENT ENDPOINTS
// ====================

/**
 * POST /api/comments
 * Create a new comment
 * Body: { text, entityType, entityId, parentCommentId? }
 */
router.post(
  '/',
  AuthMiddleware.authenticate,
  standardCommentLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { text, entityType, entityId, parentCommentId } = req.body;
    const userId = req.user!.userId;
    const username = `${req.user!.firstName} ${req.user!.lastName}`.trim();

    // Validate required fields
    if (!text || !entityType || !entityId) {
      res.status(400).json({
        success: false,
        message: 'Text, entityType, and entityId are required'
      });
      return;
    }

    // Validate entity type
    if (!Object.values(CommentEntityType).includes(entityType)) {
      res.status(400).json({
        success: false,
        message: 'Invalid entity type. Must be CANDIDATE or JOB'
      });
      return;
    }

    const createData: CreateCommentData = {
      text,
      authorId: userId,
      authorName: username,
      entityType,
      entityId,
      parentCommentId: parentCommentId || null
    };

    const result = await commentService.createComment(createData);

    res.status(201).json({
      success: true,
      message: 'Comment created successfully',
      data: {
        comment: result.comment.toObject(),
        mentionValidation: result.mentionValidation
      },
      warnings: result.mentionValidation.failed.length > 0 
        ? [`Failed to resolve ${result.mentionValidation.failed.length} @mention(s): ${result.mentionValidation.failed.join(', ')}`]
        : undefined
    });
  })
);

/**
 * GET /api/comments/:entityType/:entityId
 * Get all comments for an entity (candidate or job)
 * Query: ?page=1&limit=20&sortBy=createdAt&sortOrder=desc
 */
router.get(
  '/:entityType/:entityId',
  AuthMiddleware.authenticate,
  standardCommentLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { entityType, entityId } = req.params;
    const userId = req.user!.userId;
    const { page, limit, sortBy, sortOrder } = req.query;

    // Validate entity type
    if (!Object.values(CommentEntityType).includes(entityType as CommentEntityType)) {
      res.status(400).json({
        success: false,
        message: 'Invalid entity type. Must be CANDIDATE or JOB'
      });
      return;
    }

    const options = {
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 50,
      sortBy: (sortBy as 'createdAt' | 'updatedAt') || 'createdAt',
      sortOrder: (sortOrder as 'asc' | 'desc') || 'desc'
    };

    const comments = await commentService.getCommentsForEntity(
      entityType as CommentEntityType,
      entityId,
      userId,
      options
    );

    const count = await commentService.getCommentCount(
      entityType as CommentEntityType,
      entityId
    );

    const totalPages = Math.ceil(count / options.limit);
    const hasNextPage = options.page < totalPages;
    const hasPreviousPage = options.page > 1;

    res.status(200).json({
      success: true,
      data: {
        comments: comments.map(c => c.toObject()),
        pagination: {
          currentPage: options.page,
          totalPages,
          totalCount: count,
          pageSize: options.limit,
          hasNextPage,
          hasPreviousPage
        }
      }
    });
  })
);

/**
 * GET /api/comments/:entityType/:entityId/top-level
 * Get top-level comments only (no replies)
 */
router.get(
  '/:entityType/:entityId/top-level',
  AuthMiddleware.authenticate,
  standardCommentLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { entityType, entityId } = req.params;
    const userId = req.user!.userId;
    const { page, limit, sortBy, sortOrder } = req.query;

    // Validate entity type
    if (!Object.values(CommentEntityType).includes(entityType as CommentEntityType)) {
      res.status(400).json({
        success: false,
        message: 'Invalid entity type. Must be CANDIDATE or JOB'
      });
      return;
    }

    const options = {
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 50,
      sortBy: (sortBy as 'createdAt' | 'updatedAt') || 'createdAt',
      sortOrder: (sortOrder as 'asc' | 'desc') || 'desc'
    };

    const comments = await commentService.getTopLevelCommentsForEntity(
      entityType as CommentEntityType,
      entityId,
      userId,
      options
    );

    const count = await commentService.getCommentCount(
      entityType as CommentEntityType,
      entityId
    );

    const totalPages = Math.ceil(count / options.limit);
    const hasNextPage = options.page < totalPages;
    const hasPreviousPage = options.page > 1;

    res.status(200).json({
      success: true,
      data: {
        comments: comments.map(c => c.toObject()),
        pagination: {
          currentPage: options.page,
          totalPages,
          totalCount: count,
          pageSize: options.limit,
          hasNextPage,
          hasPreviousPage
        }
      }
    });
  })
);

/**
 * GET /api/comments/:commentId
 * Get a single comment by ID
 */
router.get(
  '/single/:commentId',
  AuthMiddleware.authenticate,
  standardCommentLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { commentId } = req.params;
    const userId = req.user!.userId;

    const comment = await commentService.getComment(commentId, userId);

    if (!comment) {
      res.status(404).json({
        success: false,
        message: 'Comment not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: comment.toObject()
    });
  })
);

/**
 * GET /api/comments/:commentId/replies
 * Get all replies to a comment
 */
router.get(
  '/:commentId/replies',
  AuthMiddleware.authenticate,
  standardCommentLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { commentId } = req.params;
    const userId = req.user!.userId;

    const replies = await commentService.getReplies(commentId, userId);

    res.status(200).json({
      success: true,
      data: replies.map(r => r.toObject())
    });
  })
);

/**
 * PUT /api/comments/:commentId
 * Update a comment (edit text)
 * Body: { text }
 */
router.put(
  '/:commentId',
  AuthMiddleware.authenticate,
  standardCommentLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { commentId } = req.params;
    const { text } = req.body;
    const userId = req.user!.userId;
    const username = `${req.user!.firstName} ${req.user!.lastName}`.trim();

    if (!text) {
      res.status(400).json({
        success: false,
        message: 'Text is required'
      });
      return;
    }

    const updateData: UpdateCommentData = {
      text,
      editedBy: userId,
      editedByName: username
    };

    try {
      const updatedComment = await commentService.updateComment(
        commentId,
        updateData,
        userId
      );

      res.status(200).json({
        success: true,
        message: 'Comment updated successfully',
        data: updatedComment.toObject()
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('Only the comment author')) {
        res.status(403).json({
          success: false,
          message: error.message
        });
        return;
      }
      throw error;
    }
  })
);

/**
 * DELETE /api/comments/:commentId
 * Soft delete a comment
 */
router.delete(
  '/:commentId',
  AuthMiddleware.authenticate,
  standardCommentLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { commentId } = req.params;
    const userId = req.user!.userId;
    const isAdmin = req.user!.role === UserRole.ADMIN;

    try {
      await commentService.deleteComment(commentId, userId, isAdmin);

      res.status(200).json({
        success: true,
        message: 'Comment deleted successfully'
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('Only the comment author')) {
        res.status(403).json({
          success: false,
          message: error.message
        });
        return;
      }
      throw error;
    }
  })
);

/**
 * POST /api/comments/:commentId/restore
 * Restore a soft-deleted comment (admin only)
 */
router.post(
  '/:commentId/restore',
  AuthMiddleware.authenticate,
  AuthMiddleware.requireRole(UserRole.ADMIN),
  standardCommentLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { commentId } = req.params;
    const userId = req.user!.userId;

    await commentService.restoreComment(commentId, userId);

    res.status(200).json({
      success: true,
      message: 'Comment restored successfully'
    });
  })
);

/**
 * GET /api/comments/stats/:entityType/:entityId
 * Get comment statistics for an entity
 */
router.get(
  '/stats/:entityType/:entityId',
  AuthMiddleware.authenticate,
  standardCommentLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { entityType, entityId } = req.params;

    // Validate entity type
    if (!Object.values(CommentEntityType).includes(entityType as CommentEntityType)) {
      res.status(400).json({
        success: false,
        message: 'Invalid entity type. Must be CANDIDATE or JOB'
      });
      return;
    }

    const stats = await commentService.getEntityStats(
      entityType as CommentEntityType,
      entityId
    );

    res.status(200).json({
      success: true,
      data: stats
    });
  })
);

/**
 * GET /api/comments/user/mentions
 * Get comments where the authenticated user is mentioned
 * Query: ?page=1&limit=20
 */
router.get(
  '/user/mentions',
  AuthMiddleware.authenticate,
  standardCommentLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { page, limit } = req.query;

    const options = {
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 20
    };

    const comments = await commentService.getCommentsMentioningUser(userId, options);

    const totalCount = await commentService.getCommentsMentioningUserCount(userId);
    const totalPages = Math.ceil(totalCount / options.limit);
    const hasNextPage = options.page < totalPages;
    const hasPreviousPage = options.page > 1;

    res.status(200).json({
      success: true,
      data: {
        comments: comments.map(c => c.toObject()),
        pagination: {
          currentPage: options.page,
          totalPages,
          totalCount,
          pageSize: options.limit,
          hasNextPage,
          hasPreviousPage
        }
      }
    });
  })
);

/**
 * GET /api/comments/user/authored
 * Get comments authored by the authenticated user
 * Query: ?page=1&limit=20
 */
router.get(
  '/user/authored',
  AuthMiddleware.authenticate,
  standardCommentLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { page, limit } = req.query;

    const options = {
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 20
    };

    const comments = await commentService.getCommentsByAuthor(userId, options);

    const totalCount = await commentService.getCommentsByAuthorCount(userId);
    const totalPages = Math.ceil(totalCount / options.limit);
    const hasNextPage = options.page < totalPages;
    const hasPreviousPage = options.page > 1;

    res.status(200).json({
      success: true,
      data: {
        comments: comments.map(c => c.toObject()),
        pagination: {
          currentPage: options.page,
          totalPages,
          totalCount,
          pageSize: options.limit,
          hasNextPage,
          hasPreviousPage
        }
      }
    });
  })
);

// ====================
// REAL-TIME ENDPOINTS (Phase 5d)
// ====================

/**
 * POST /api/comments/typing
 * Broadcast typing indicator
 * Body: { entityType, entityId, isTyping }
 */
router.post(
  '/typing',
  AuthMiddleware.authenticate,
  realtimeCommentLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { entityType, entityId, isTyping } = req.body;
    const userId = req.user!.userId;
    const username = `${req.user!.firstName} ${req.user!.lastName}`.trim();

    if (!entityType || !entityId || typeof isTyping !== 'boolean') {
      res.status(400).json({
        success: false,
        message: 'entityType, entityId, and isTyping are required'
      });
      return;
    }

    // Broadcast typing indicator via WebSocket
    const { webSocketService } = await import('../services/WebSocketService');
    const io = webSocketService.getIO();
    
    if (io) {
      const roomName = `${entityType.toLowerCase()}:${entityId}`;
      io.to(roomName).emit('comment:typing', {
        userId,
        username,
        entityType,
        entityId,
        isTyping,
        timestamp: new Date()
      });
    }

    res.status(200).json({
      success: true,
      message: 'Typing indicator broadcast'
    });
  })
);

/**
 * POST /api/comments/presence/join
 * User joins entity room (starts viewing)
 * Body: { entityType, entityId }
 */
router.post(
  '/presence/join',
  AuthMiddleware.authenticate,
  realtimeCommentLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { entityType, entityId } = req.body;
    const userId = req.user!.userId;
    const username = `${req.user!.firstName} ${req.user!.lastName}`.trim();

    if (!entityType || !entityId) {
      res.status(400).json({
        success: false,
        message: 'entityType and entityId are required'
      });
      return;
    }

    // Broadcast presence join via WebSocket
    const { webSocketService } = await import('../services/WebSocketService');
    const io = webSocketService.getIO();
    
    if (io) {
      const roomName = `${entityType.toLowerCase()}:${entityId}`;
      io.to(roomName).emit('comment:presence:join', {
        userId,
        username,
        entityType,
        entityId,
        timestamp: new Date()
      });
    }

    res.status(200).json({
      success: true,
      message: 'Joined entity room'
    });
  })
);

/**
 * POST /api/comments/presence/leave
 * User leaves entity room (stops viewing)
 * Body: { entityType, entityId }
 */
router.post(
  '/presence/leave',
  AuthMiddleware.authenticate,
  realtimeCommentLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { entityType, entityId } = req.body;
    const userId = req.user!.userId;
    const username = `${req.user!.firstName} ${req.user!.lastName}`.trim();

    if (!entityType || !entityId) {
      res.status(400).json({
        success: false,
        message: 'entityType and entityId are required'
      });
      return;
    }

    // Broadcast presence leave via WebSocket
    const { webSocketService } = await import('../services/WebSocketService');
    const io = webSocketService.getIO();
    
    if (io) {
      const roomName = `${entityType.toLowerCase()}:${entityId}`;
      io.to(roomName).emit('comment:presence:leave', {
        userId,
        username,
        entityType,
        entityId,
        timestamp: new Date()
      });
    }

    res.status(200).json({
      success: true,
      message: 'Left entity room'
    });
  })
);

/**
 * GET /api/comments/autocomplete/users
 * Search users for @mention autocomplete
 * Query: ?query=john
 */
router.get(
  '/autocomplete/users',
  AuthMiddleware.authenticate,
  autocompleteLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { query } = req.query;

    if (!query || typeof query !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Query parameter is required'
      });
      return;
    }

    const searchQuery = query.trim();
    if (searchQuery.length < 3) {
      res.status(400).json({
        success: false,
        message: 'Query must be at least 3 characters'
      });
      return;
    }

    // Search users by firstName, lastName, or email
    const { connectDB } = await import('../mongo_db');
    const db = await connectDB();
    
    const users = await db.collection('users')
      .find({
        $and: [
          { isActive: true, isDeleted: false },
          {
            $or: [
              { firstName: { $regex: searchQuery, $options: 'i' } },
              { lastName: { $regex: searchQuery, $options: 'i' } },
              { email: { $regex: searchQuery, $options: 'i' } }
            ]
          }
        ]
      })
      .project({
        userId: 1,
        firstName: 1,
        lastName: 1,
        email: 1,
        title: 1,
        role: 1
      })
      .limit(10)
      .toArray();

    // Format results for autocomplete
    const results = users.map(user => ({
      userId: user.userId,
      username: `${user.firstName} ${user.lastName}`,
      email: user.email,
      title: user.title,
      role: user.role,
      // Suggest both name and email formats
      mentionFormats: [
        `@${user.firstName}.${user.lastName}`.toLowerCase(),
        `@${user.email}`
      ]
    }));

    res.status(200).json({
      success: true,
      data: results
    });
  })
);

export default router;
