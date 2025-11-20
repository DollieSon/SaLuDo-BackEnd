import { v4 as uuidv4 } from 'uuid';

// =======================
// ENUMS
// =======================

/**
 * Entity types that can be commented on
 */
export enum CommentEntityType {
  CANDIDATE = 'CANDIDATE',
  JOB = 'JOB'
}

// =======================
// INTERFACES
// =======================

/**
 * Edit history record for tracking comment modifications
 */
export interface CommentEditHistory {
  editedAt: Date;
  editedBy: string; // userId of the editor
  editedByName: string; // username for display
  oldContent: string; // previous text content
}

/**
 * Mentioned user in a comment
 */
export interface CommentMention {
  userId: string;
  username: string;
  mentionedAt: Date;
}

/**
 * Comment data structure for MongoDB storage
 */
export interface CommentData {
  commentId: string;
  text: string;
  authorId: string;
  authorName: string;
  entityType: CommentEntityType;
  entityId: string; // candidateId or jobId
  parentCommentId: string | null; // null for top-level comments, commentId for replies
  mentions: CommentMention[]; // @mentioned users
  createdAt: Date;
  updatedAt: Date;
  editHistory: CommentEditHistory[];
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: string;
}

/**
 * Data required to create a new comment
 */
export interface CreateCommentData {
  text: string;
  authorId: string;
  authorName: string;
  entityType: CommentEntityType;
  entityId: string;
  parentCommentId?: string | null;
}

/**
 * Data for updating an existing comment
 */
export interface UpdateCommentData {
  text: string;
  editedBy: string;
  editedByName: string;
}

// =======================
// COMMENT CLASS
// =======================

/**
 * Comment model for internal HR team collaboration
 * All comments are private/internal - never visible to candidates
 */
export class Comment {
  public commentId: string;
  public text: string;
  public authorId: string;
  public authorName: string;
  public entityType: CommentEntityType;
  public entityId: string;
  public parentCommentId: string | null;
  public mentions: CommentMention[];
  public createdAt: Date;
  public updatedAt: Date;
  public editHistory: CommentEditHistory[];
  public isDeleted: boolean;
  public deletedAt?: Date;
  public deletedBy?: string;

  constructor(
    text: string,
    authorId: string,
    authorName: string,
    entityType: CommentEntityType,
    entityId: string,
    commentId?: string,
    parentCommentId: string | null = null,
    mentions: CommentMention[] = [],
    createdAt?: Date,
    updatedAt?: Date,
    editHistory: CommentEditHistory[] = [],
    isDeleted: boolean = false,
    deletedAt?: Date,
    deletedBy?: string
  ) {
    this.commentId = commentId || uuidv4();
    this.text = text;
    this.authorId = authorId;
    this.authorName = authorName;
    this.entityType = entityType;
    this.entityId = entityId;
    this.parentCommentId = parentCommentId;
    this.mentions = mentions;
    this.createdAt = createdAt || new Date();
    this.updatedAt = updatedAt || new Date();
    this.editHistory = editHistory;
    this.isDeleted = isDeleted;
    this.deletedAt = deletedAt;
    this.deletedBy = deletedBy;

    this.validate();
  }

  // =======================
  // VALIDATION
  // =======================

  private validate(): void {
    if (!this.text || this.text.trim().length === 0) {
      throw new Error('Comment text cannot be empty');
    }

    if (this.text.length > 5000) {
      throw new Error('Comment text cannot exceed 5000 characters');
    }

    if (!this.authorId || this.authorId.trim().length === 0) {
      throw new Error('Author ID is required');
    }

    if (!this.authorName || this.authorName.trim().length === 0) {
      throw new Error('Author name is required');
    }

    if (!this.entityType || !Object.values(CommentEntityType).includes(this.entityType)) {
      throw new Error('Valid entity type is required (CANDIDATE or JOB)');
    }

    if (!this.entityId || this.entityId.trim().length === 0) {
      throw new Error('Entity ID is required');
    }
  }

  // =======================
  // STATIC FACTORY METHODS
  // =======================

  /**
   * Create a Comment instance from database data
   */
  static fromObject(data: CommentData): Comment {
    return new Comment(
      data.text,
      data.authorId,
      data.authorName,
      data.entityType,
      data.entityId,
      data.commentId,
      data.parentCommentId,
      data.mentions,
      data.createdAt,
      data.updatedAt,
      data.editHistory,
      data.isDeleted,
      data.deletedAt,
      data.deletedBy
    );
  }

  /**
   * Create a new comment from user input
   */
  static create(createData: CreateCommentData): Comment {
    return new Comment(
      createData.text,
      createData.authorId,
      createData.authorName,
      createData.entityType,
      createData.entityId,
      undefined,
      createData.parentCommentId || null
    );
  }

  // =======================
  // INSTANCE METHODS
  // =======================

  /**
   * Convert to plain object for MongoDB storage
   */
  toObject(): CommentData {
    return {
      commentId: this.commentId,
      text: this.text,
      authorId: this.authorId,
      authorName: this.authorName,
      entityType: this.entityType,
      entityId: this.entityId,
      parentCommentId: this.parentCommentId,
      mentions: this.mentions,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      editHistory: this.editHistory,
      isDeleted: this.isDeleted,
      deletedAt: this.deletedAt,
      deletedBy: this.deletedBy
    };
  }

  /**
   * Update comment text and track edit history
   */
  updateText(newText: string, editedBy: string, editedByName: string): void {
    if (!newText || newText.trim().length === 0) {
      throw new Error('Comment text cannot be empty');
    }

    if (newText.length > 5000) {
      throw new Error('Comment text cannot exceed 5000 characters');
    }

    // Save current text to edit history
    this.editHistory.push({
      editedAt: new Date(),
      editedBy: editedBy,
      editedByName: editedByName,
      oldContent: this.text
    });

    this.text = newText;
    this.updatedAt = new Date();
  }

  /**
   * Soft delete the comment
   */
  softDelete(deletedBy: string): void {
    this.isDeleted = true;
    this.deletedAt = new Date();
    this.deletedBy = deletedBy;
    this.updatedAt = new Date();
  }

  /**
   * Restore a soft-deleted comment
   */
  restore(): void {
    this.isDeleted = false;
    this.deletedAt = undefined;
    this.deletedBy = undefined;
    this.updatedAt = new Date();
  }

  /**
   * Add mentions to the comment
   */
  addMentions(mentions: CommentMention[]): void {
    // Avoid duplicate mentions
    const existingUserIds = new Set(this.mentions.map(m => m.userId));
    const newMentions = mentions.filter(m => !existingUserIds.has(m.userId));
    this.mentions.push(...newMentions);
    this.updatedAt = new Date();
  }

  /**
   * Check if comment is a reply (has parent)
   */
  isReply(): boolean {
    return this.parentCommentId !== null;
  }

  /**
   * Check if comment is top-level
   */
  isTopLevel(): boolean {
    return this.parentCommentId === null;
  }

  /**
   * Check if comment has been edited
   */
  isEdited(): boolean {
    return this.editHistory.length > 0;
  }

  /**
   * Check if comment has mentions
   */
  hasMentions(): boolean {
    return this.mentions.length > 0;
  }

  /**
   * Get all mentioned user IDs
   */
  getMentionedUserIds(): string[] {
    return this.mentions.map(m => m.userId);
  }

  /**
   * Get comment age in milliseconds
   */
  getAge(): number {
    return Date.now() - this.createdAt.getTime();
  }

  /**
   * Check if comment was created within the last N minutes
   */
  isRecentlyCreated(minutes: number = 5): boolean {
    const ageInMinutes = this.getAge() / (1000 * 60);
    return ageInMinutes <= minutes;
  }

  /**
   * Get edit count
   */
  getEditCount(): number {
    return this.editHistory.length;
  }

  /**
   * Get last edit time
   */
  getLastEditTime(): Date | null {
    if (this.editHistory.length === 0) return null;
    return this.editHistory[this.editHistory.length - 1].editedAt;
  }
}
