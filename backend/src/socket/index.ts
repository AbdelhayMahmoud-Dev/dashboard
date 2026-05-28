import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

let io: SocketServer;

export const initSocket = (httpServer: HttpServer): SocketServer => {
  io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication error'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string; role: string };
      (socket as Socket & { userId?: string; userRole?: string }).userId = decoded.id;
      (socket as Socket & { userId?: string; userRole?: string }).userRole = decoded.role;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = (socket as Socket & { userId?: string }).userId;
    console.log(`🔌 Socket connected: ${socket.id} (user: ${userId})`);

    if (userId) socket.join(`user:${userId}`);

    socket.on('join-room', (room: string) => {
      socket.join(room);
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = (): SocketServer => {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
};

export const emitToUser = (userId: string, event: string, data: unknown) => {
  getIO().to(`user:${userId}`).emit(event, data);
};

export const emitToAll = (event: string, data: unknown) => {
  getIO().emit(event, data);
};
