import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { Notification } from '../Models/Notification';
import type { User } from '../Models/User';
import { getAllowedOrigins } from '../utils/securityConfig';

// WebSocket Configuration Constants
const PING_TIMEOUT_MS = 60000;  // 60 seconds
const PING_INTERVAL_MS = 25000; // 25 seconds
const MAX_SOCKET_MESSAGE_BYTES = 100 * 1024; // clients only send small control messages
const COMMENT_ROOM_PATTERN = /^(candidate|job):([A-Za-z0-9_-]{1,64})$/;

interface SocketUserData {
  user: User;
  userId: string;
  displayName: string;
}

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
        origin: getAllowedOrigins(),
        methods: ['GET', 'POST'],
        credentials: true
      },
      pingTimeout: PING_TIMEOUT_MS,
      pingInterval: PING_INTERVAL_MS,
      maxHttpBufferSize: MAX_SOCKET_MESSAGE_BYTES
    });

    // Every connection must present a valid access token during the handshake.
    // The user identity comes from the verified JWT, never from event payloads.
    this.io.use(async (socket, next) => {
      try {
        const token = this.extractHandshakeToken(socket);
        if (!token) {
          next(new Error('Authentication required'));
          return;
        }

        const { AuthMiddleware } = await import('../routes/middleware/auth');
        const user = await AuthMiddleware.resolveUserFromToken(token);
        if (!user) {
          next(new Error('Invalid or expired token'));
          return;
        }

        const data = socket.data as SocketUserData;
        data.user = user;
        data.userId = user.userId;
        data.displayName = `${user.firstName} ${user.lastName}`.trim();
        next();
      } catch (error) {
        console.error('WebSocket handshake authentication failed:', error);
        next(new Error('Authentication failed'));
      }
    });

    this.setupEventHandlers();
    console.log('WebSocket service initialized');
  }

  /**
   * Read the access token from the Socket.io handshake (auth payload or Authorization header)
   */
  private extractHandshakeToken(socket: Socket): string | undefined {
    const authToken = socket.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.trim()) {
      return authToken.trim().replace(/^Bearer\s+/i, '');
    }

    const header = socket.handshake.headers.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice('Bearer '.length).trim() || undefined;
    }

    return undefined;
  }

  /**
   * Check that the socket's user may join a comment room ("candidate:<id>" or "job:<id>")
   */
  private async canJoinRoom(socket: Socket, roomName: unknown): Promise<boolean> {
    if (typeof roomName !== 'string') return false;

    const match = COMMENT_ROOM_PATTERN.exec(roomName);
    if (!match) return false;

    const [, entityType, entityId] = match;
    if (entityType === 'job') {
      // Jobs are visible to every authenticated user
      return true;
    }

    const { CandidateAccessMiddleware } = await import('../routes/middleware/candidateAccess');
    const { user } = socket.data as SocketUserData;
    const access = await CandidateAccessMiddleware.getCandidateAccess(user, entityId);
    return access === 'allowed';
  }

  /**
   * Setup Socket.io event handlers
   */
  private setupEventHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', (socket: Socket) => {
      const { userId, displayName } = socket.data as SocketUserData;

      // Identity was verified in the handshake, so join the user's room immediately
      this.registerUserSocket(userId, socket.id);
      socket.join(`user:${userId}`);
      this.socketToUser.set(socket.id, userId);

      // Kept for older clients: the payload is ignored and the verified identity is confirmed
      socket.on('authenticate', () => {
        socket.emit('authenticated', { userId, socketId: socket.id });
      });
      socket.emit('authenticated', { userId, socketId: socket.id });

      // Handle comment room join
      socket.on('comment:room:join', async (data: { roomName?: string }) => {
        const roomName = data?.roomName;
        try {
          if (!(await this.canJoinRoom(socket, roomName))) {
            socket.emit('comment:room:error', { roomName, message: 'Access denied' });
            return;
          }
        } catch (error) {
          console.error('Error checking comment room access:', error);
          socket.emit('comment:room:error', { roomName, message: 'Access check failed' });
          return;
        }

        const room = roomName as string;
        socket.join(room);

        // Track room membership
        if (!this.socketRooms.has(socket.id)) {
          this.socketRooms.set(socket.id, new Set());
        }
        this.socketRooms.get(socket.id)!.add(room);

        // Broadcast presence join to room
        socket.to(room).emit('comment:presence:join', {
          userId,
          username: displayName,
          timestamp: new Date()
        });
      });

      // Handle comment room leave
      socket.on('comment:room:leave', (data: { roomName?: string }) => {
        const roomName = data?.roomName;
        if (typeof roomName !== 'string' || !this.socketRooms.get(socket.id)?.has(roomName)) {
          return;
        }

        socket.leave(roomName);
        this.socketRooms.get(socket.id)!.delete(roomName);

        // Broadcast presence leave to room
        socket.to(roomName).emit('comment:presence:leave', {
          userId,
          username: displayName,
          timestamp: new Date()
        });
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        // Clean up comment rooms (broadcast leave events)
        this.cleanupSocketRooms(socket);

        // Clean up user socket tracking
        this.unregisterSocket(socket.id);
      });

      // Notification read acknowledgment (no-op, kept for client compatibility)
      socket.on('notification:read', () => {});

      // Typing indicators always carry the verified sender identity
      socket.on('typing:start', (data: { targetId?: string }) => {
        if (typeof data?.targetId !== 'string') return;
        socket.broadcast.to(`user:${data.targetId}`).emit('typing:indicator', {
          userId,
          isTyping: true
        });
      });

      socket.on('typing:stop', (data: { targetId?: string }) => {
        if (typeof data?.targetId !== 'string') return;
        socket.broadcast.to(`user:${data.targetId}`).emit('typing:indicator', {
          userId,
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
