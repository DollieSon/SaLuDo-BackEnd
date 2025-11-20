import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { Notification } from '../Models/Notification';

// WebSocket Configuration Constants
const PING_TIMEOUT_MS = 60000;  // 60 seconds
const PING_INTERVAL_MS = 25000; // 25 seconds

interface UserSocket {
  userId: string;
  socketId: string;
  connectedAt: Date;
}

interface RoomPresence {
  userId: string;
  username: string;
  joinedAt: Date;
}

export class WebSocketService {
  private io: SocketIOServer | null = null;
  private userSockets: Map<string, Set<string>> = new Map(); // userId -> Set of socket IDs
  private socketToUser: Map<string, string> = new Map(); // socketId -> userId
  private socketRooms: Map<string, Set<string>> = new Map(); // socketId -> Set of room names (for comment rooms)

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
      pingTimeout: PING_TIMEOUT_MS,
      pingInterval: PING_INTERVAL_MS
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
        this.socketToUser.set(socket.id, userId);
        console.log(`User ${userId} authenticated on socket ${socket.id}`);
        
        // Send confirmation
        socket.emit('authenticated', { userId, socketId: socket.id });
      });

      // Handle comment room join
      socket.on('comment:room:join', (data: { userId: string; username: string; roomName: string }) => {
        socket.join(data.roomName);
        
        // Track room membership
        if (!this.socketRooms.has(socket.id)) {
          this.socketRooms.set(socket.id, new Set());
        }
        this.socketRooms.get(socket.id)!.add(data.roomName);
        
        // Broadcast presence join to room
        socket.to(data.roomName).emit('comment:presence:join', {
          userId: data.userId,
          username: data.username,
          timestamp: new Date()
        });
        
        console.log(`User ${data.userId} joined room ${data.roomName}`);
      });

      // Handle comment room leave
      socket.on('comment:room:leave', (data: { userId: string; username: string; roomName: string }) => {
        socket.leave(data.roomName);
        
        // Remove from tracking
        if (this.socketRooms.has(socket.id)) {
          this.socketRooms.get(socket.id)!.delete(data.roomName);
        }
        
        // Broadcast presence leave to room
        socket.to(data.roomName).emit('comment:presence:leave', {
          userId: data.userId,
          username: data.username,
          timestamp: new Date()
        });
        
        console.log(`User ${data.userId} left room ${data.roomName}`);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        // Clean up comment rooms (broadcast leave events)
        this.cleanupSocketRooms(socket);
        
        // Clean up user socket tracking
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
   * Clean up comment rooms when socket disconnects
   */
  private cleanupSocketRooms(socket: Socket): void {
    if (!this.io) return;
    
    const socketId = socket.id;
    const userId = this.socketToUser.get(socketId);
    const rooms = this.socketRooms.get(socketId);
    
    if (rooms && userId) {
      // Broadcast presence:leave to all rooms the user was in
      rooms.forEach(roomName => {
        socket.to(roomName).emit('comment:presence:leave', {
          userId,
          username: 'Unknown', // We don't store username, frontend should handle
          timestamp: new Date(),
          reason: 'disconnect'
        });
      });
      
      // Clean up tracking
      this.socketRooms.delete(socketId);
    }
    
    this.socketToUser.delete(socketId);
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
