import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { Notification } from '../Models/Notification';

interface UserSocket {
  userId: string;
  socketId: string;
  connectedAt: Date;
}

export class WebSocketService {
  private io: SocketIOServer | null = null;
  private userSockets: Map<string, Set<string>> = new Map(); // userId -> Set of socket IDs

  /**
   * Initialize Socket.io server
   */
  initialize(httpServer: HTTPServer): void {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST'],
        credentials: true
      },
      pingTimeout: 60000,
      pingInterval: 25000
    });

    this.setupEventHandlers();
    console.log('WebSocket service initialized');
  }

  /**
   * Setup Socket.io event handlers
   */
  private setupEventHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', (socket: Socket) => {
      console.log(`Socket connected: ${socket.id}`);

      // Handle user authentication
      socket.on('authenticate', (userId: string) => {
        this.registerUserSocket(userId, socket.id);
        socket.join(`user:${userId}`);
        console.log(`User ${userId} authenticated on socket ${socket.id}`);
        
        // Send confirmation
        socket.emit('authenticated', { userId, socketId: socket.id });
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        this.unregisterSocket(socket.id);
        console.log(`Socket disconnected: ${socket.id}`);
      });

      // Handle notification read acknowledgment
      socket.on('notification:read', (notificationId: string) => {
        console.log(`Notification ${notificationId} marked as read via socket ${socket.id}`);
      });

      // Handle typing indicators for future comment system
      socket.on('typing:start', (data: { userId: string; targetId: string }) => {
        socket.broadcast.to(`user:${data.targetId}`).emit('typing:indicator', {
          userId: data.userId,
          isTyping: true
        });
      });

      socket.on('typing:stop', (data: { userId: string; targetId: string }) => {
        socket.broadcast.to(`user:${data.targetId}`).emit('typing:indicator', {
          userId: data.userId,
          isTyping: false
        });
      });
    });
  }

  /**
   * Register a socket for a user
   */
  private registerUserSocket(userId: string, socketId: string): void {
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(socketId);
  }

  /**
   * Unregister a socket when disconnected
   */
  private unregisterSocket(socketId: string): void {
    for (const [userId, socketIds] of this.userSockets.entries()) {
      if (socketIds.has(socketId)) {
        socketIds.delete(socketId);
        if (socketIds.size === 0) {
          this.userSockets.delete(userId);
        }
        break;
      }
    }
  }

  /**
   * Send notification to specific user
   */
  sendNotificationToUser(userId: string, notification: Notification): void {
    if (!this.io) {
      console.warn('WebSocket service not initialized');
      return;
    }

    this.io.to(`user:${userId}`).emit('notification:new', notification);
    console.log(`Notification sent to user ${userId}: ${notification.type}`);
  }

  /**
   * Send notification to multiple users
   */
  sendNotificationToUsers(userIds: string[], notification: Notification): void {
    if (!this.io) {
      console.warn('WebSocket service not initialized');
      return;
    }

    userIds.forEach(userId => {
      this.sendNotificationToUser(userId, notification);
    });
  }

  /**
   * Broadcast notification to all connected users
   */
  broadcastNotification(notification: Notification): void {
    if (!this.io) {
      console.warn('WebSocket service not initialized');
      return;
    }

    this.io.emit('notification:broadcast', notification);
    console.log(`Broadcast notification: ${notification.type}`);
  }

  /**
   * Send update about notification status change
   */
  sendNotificationUpdate(userId: string, notificationId: string, update: Partial<Notification>): void {
    if (!this.io) {
      console.warn('WebSocket service not initialized');
      return;
    }

    this.io.to(`user:${userId}`).emit('notification:updated', {
      notificationId,
      update
    });
  }

  /**
   * Check if user is currently connected
   */
  isUserConnected(userId: string): boolean {
    const sockets = this.userSockets.get(userId);
    return sockets ? sockets.size > 0 : false;
  }

  /**
   * Get number of active connections for a user
   */
  getUserConnectionCount(userId: string): number {
    const sockets = this.userSockets.get(userId);
    return sockets ? sockets.size : 0;
  }

  /**
   * Get total number of connected users
   */
  getConnectedUserCount(): number {
    return this.userSockets.size;
  }

  /**
   * Get all connected user IDs
   */
  getConnectedUserIds(): string[] {
    return Array.from(this.userSockets.keys());
  }

  /**
   * Disconnect all sockets for a user (e.g., on logout)
   */
  disconnectUser(userId: string): void {
    if (!this.io) return;

    const socketIds = this.userSockets.get(userId);
    if (socketIds) {
      socketIds.forEach(socketId => {
        const socket = this.io!.sockets.sockets.get(socketId);
        if (socket) {
          socket.disconnect(true);
        }
      });
      this.userSockets.delete(userId);
    }
  }

  /**
   * Send custom event to user
   */
  sendEventToUser(userId: string, eventName: string, data: any): void {
    if (!this.io) {
      console.warn('WebSocket service not initialized');
      return;
    }

    this.io.to(`user:${userId}`).emit(eventName, data);
  }

  /**
   * Get Socket.io instance for advanced usage
   */
  getIO(): SocketIOServer | null {
    return this.io;
  }
}

// Export singleton instance
export const webSocketService = new WebSocketService();
