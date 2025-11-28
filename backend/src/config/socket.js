import { Server } from 'socket.io';
import { getRedisClient, isRedisAvailable } from './redis.js';

let io = null;
let redisSubscriber = null;
let redisPublisher = null;

export function initializeSocket(server) {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:5173",
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  // Autenticação via token JWT (opcional por enquanto)
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    // Por enquanto, permitir conexão mesmo sem token
    // Em produção, validar o token JWT aqui
    socket.userToken = token;
    next();
  });

  io.on('connection', (socket) => {
    console.log('✅ Cliente conectado:', socket.id);

    // Quando cliente se conecta, ele pode se juntar a uma sala baseada no userId
    socket.on('join-user-room', (userId) => {
      socket.join(`user:${userId}`);
      console.log(`👤 Usuário ${userId} entrou na sala`);
    });

    socket.on('disconnect', () => {
      console.log('❌ Cliente desconectado:', socket.id);
    });
  });

  // Configurar Redis pub/sub se disponível
  if (isRedisAvailable()) {
    const redis = getRedisClient();
    
    redisSubscriber = redis.duplicate();
    redisPublisher = redis.duplicate();

    // Escutar eventos do Redis
    redisSubscriber.subscribe('booking-updated', 'booking-created', 'booking-cancelled');
    
    redisSubscriber.on('message', (channel, message) => {
      try {
        const data = JSON.parse(message);
        console.log(`📢 Evento Redis: ${channel}`, data);
        
        // Emitir para os clientes interessados
        if (data.userId) {
          io.to(`user:${data.userId}`).emit(channel, data);
        }
        
        // Também emitir para todos os prestadores se for um evento de booking
        if (data.providerId) {
          io.to(`user:${data.providerId}`).emit(channel, data);
        }
        
        if (data.clientId) {
          io.to(`user:${data.clientId}`).emit(channel, data);
        }
      } catch (error) {
        console.error('Erro ao processar mensagem Redis:', error);
      }
    });

    console.log('✅ Redis pub/sub configurado para WebSocket');
  } else {
    console.log('⚠️ Redis não disponível - WebSocket funcionará sem pub/sub');
  }

  return io;
}

export function getIO() {
  if (!io) {
    throw new Error('Socket.IO não inicializado. Chame initializeSocket primeiro.');
  }
  return io;
}

export function publishToRedis(channel, data) {
  console.log(`📤 Publicando evento ${channel}:`, { 
    bookingId: data.bookingId, 
    providerId: data.providerId, 
    clientId: data.clientId 
  });
  
  if (redisPublisher && isRedisAvailable()) {
    try {
      redisPublisher.publish(channel, JSON.stringify(data));
      console.log(`✅ Evento ${channel} publicado no Redis`);
    } catch (error) {
      console.error('❌ Erro ao publicar no Redis:', error);
    }
  }
  
  // Sempre emitir diretamente também (fallback e para garantir)
  if (io) {
    const rooms = [];
    if (data.userId) {
      rooms.push(`user:${data.userId}`);
    }
    if (data.providerId) {
      rooms.push(`user:${data.providerId}`);
    }
    if (data.clientId) {
      rooms.push(`user:${data.clientId}`);
    }
    
    rooms.forEach(room => {
      io.to(room).emit(channel, data);
      console.log(`📡 Evento ${channel} emitido para sala ${room}`);
    });
  }
}

