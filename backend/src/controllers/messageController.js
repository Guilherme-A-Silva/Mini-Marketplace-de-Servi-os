import { Message, Booking, User, Service } from '../models/index.js';
import { validationResult } from 'express-validator';
import { Op } from 'sequelize';
import { publishToRedis } from '../config/socket.js';

export const getMessages = async (req, res) => {
  try {
    const { bookingId, otherUserId, limit = 100, offset = 0 } = req.query;
    
    const where = {};
    
    if (bookingId) {
      where.bookingId = parseInt(bookingId);
    } else if (otherUserId) {
      // Buscar mensagens entre o usuário logado e outro usuário
      where[Op.or] = [
        { senderId: req.user.id, receiverId: parseInt(otherUserId) },
        { senderId: parseInt(otherUserId), receiverId: req.user.id }
      ];
    } else {
      // Buscar todas as conversas do usuário
      where[Op.or] = [
        { senderId: req.user.id },
        { receiverId: req.user.id }
      ];
    }

    const messages = await Message.findAll({
      where,
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'name', 'role']
        },
        {
          model: User,
          as: 'receiver',
          attributes: ['id', 'name', 'role']
        },
        {
          model: Booking,
          as: 'booking',
          attributes: ['id', 'scheduledDate', 'scheduledTime']
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'ASC']]
    });

    res.json({ messages });
  } catch (error) {
    console.error('Erro ao buscar mensagens:', error);
    res.status(500).json({ error: 'Erro ao buscar mensagens' });
  }
};

export const getConversations = async (req, res) => {
  try {
    // Buscar todas as conversas do usuário (última mensagem de cada conversa)
    const messages = await Message.findAll({
      where: {
        [Op.or]: [
          { senderId: req.user.id },
          { receiverId: req.user.id }
        ]
      },
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'name', 'role']
        },
        {
          model: User,
          as: 'receiver',
          attributes: ['id', 'name', 'role']
        },
        {
          model: Booking,
          as: 'booking',
          attributes: ['id', 'scheduledDate', 'scheduledTime', 'status']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    // Agrupar por conversa (bookingId ou par de usuários)
    // Filtrar apenas bookings confirmados (não concluídos)
    const conversationMap = new Map();
    
    for (const message of messages) {
      // Se for mensagem de booking, verificar se está confirmado e não concluído
      if (message.bookingId && message.booking) {
        if (message.booking.status !== 'confirmed') {
          continue; // Pular bookings não confirmados ou concluídos
        }
      }
      
      const otherUserId = message.senderId === req.user.id ? message.receiverId : message.senderId;
      const key = message.bookingId ? `booking:${message.bookingId}` : `user:${otherUserId}`;
      
      if (!conversationMap.has(key)) {
        conversationMap.set(key, {
          id: key,
          bookingId: message.bookingId,
          bookingStatus: message.booking?.status || null,
          otherUser: message.senderId === req.user.id ? message.receiver : message.sender,
          lastMessage: message,
          unreadCount: 0
        });
      }
    }

    // Adicionar bookings confirmados que ainda não têm mensagens
    const confirmedBookings = await Booking.findAll({
      where: {
        status: 'confirmed',
        [Op.or]: [
          { clientId: req.user.id },
          { providerId: req.user.id }
        ]
      },
      include: [
        {
          model: User,
          as: 'client',
          attributes: ['id', 'name', 'role']
        },
        {
          model: User,
          as: 'provider',
          attributes: ['id', 'name', 'role']
        },
        {
          model: Service,
          as: 'service',
          attributes: ['id', 'name']
        }
      ]
    });

    for (const booking of confirmedBookings) {
      const key = `booking:${booking.id}`;
      if (!conversationMap.has(key)) {
        const otherUser = booking.clientId === req.user.id ? booking.provider : booking.client;
        conversationMap.set(key, {
          id: key,
          bookingId: booking.id,
          bookingStatus: booking.status,
          otherUser: otherUser,
          lastMessage: null,
          unreadCount: 0
        });
      }
    }

    // Contar mensagens não lidas
    for (const [key, conv] of conversationMap.entries()) {
      const where = {
        receiverId: req.user.id,
        isRead: false
      };
      
      if (conv.bookingId) {
        where.bookingId = conv.bookingId;
      } else {
        where.senderId = conv.otherUser.id;
      }

      const unread = await Message.count({ where });
      conv.unreadCount = unread;
    }

    res.json({ conversations: Array.from(conversationMap.values()) });
  } catch (error) {
    console.error('Erro ao buscar conversas:', error);
    res.status(500).json({ error: 'Erro ao buscar conversas' });
  }
};

export const createMessage = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { bookingId, receiverId, content } = req.body;

    // Verificar se bookingId foi fornecido e se o usuário tem acesso
    if (bookingId) {
      const booking = await Booking.findByPk(bookingId);
      if (!booking) {
        return res.status(404).json({ error: 'Contratação não encontrada' });
      }
      
      if (booking.clientId !== req.user.id && booking.providerId !== req.user.id) {
        return res.status(403).json({ error: 'Você não tem acesso a esta contratação' });
      }

      // Verificar se o booking está confirmado (chat só funciona para confirmados)
      // Chat é encerrado quando booking é concluído ou cancelado
      if (booking.status !== 'confirmed') {
        if (booking.status === 'completed') {
          return res.status(400).json({ error: 'O chat foi encerrado pois a contratação foi concluída' });
        }
        return res.status(400).json({ error: 'O chat só está disponível para contratações confirmadas' });
      }

      // Definir receiverId automaticamente baseado na contratação
      const actualReceiverId = booking.clientId === req.user.id ? booking.providerId : booking.clientId;
      
      const message = await Message.create({
        bookingId: parseInt(bookingId),
        senderId: req.user.id,
        receiverId: actualReceiverId,
        content
      });

      const messageWithRelations = await Message.findByPk(message.id, {
        include: [
          {
            model: User,
            as: 'sender',
            attributes: ['id', 'name', 'role']
          },
          {
            model: User,
            as: 'receiver',
            attributes: ['id', 'name', 'role']
          },
          {
            model: Booking,
            as: 'booking',
            attributes: ['id', 'scheduledDate', 'scheduledTime', 'status']
          }
        ]
      });

      // Emitir evento via WebSocket
      publishToRedis('message-created', {
        messageId: message.id,
        bookingId: message.bookingId,
        senderId: message.senderId,
        receiverId: message.receiverId,
        message: messageWithRelations
      });

      res.status(201).json({ message: messageWithRelations });
    } else if (receiverId) {
      // Mensagem direta sem contratação
      const message = await Message.create({
        senderId: req.user.id,
        receiverId: parseInt(receiverId),
        content
      });

      const messageWithRelations = await Message.findByPk(message.id, {
        include: [
          {
            model: User,
            as: 'sender',
            attributes: ['id', 'name', 'role']
          },
          {
            model: User,
            as: 'receiver',
            attributes: ['id', 'name', 'role']
          }
        ]
      });

      // Emitir evento via WebSocket
      publishToRedis('message-created', {
        messageId: message.id,
        senderId: message.senderId,
        receiverId: message.receiverId,
        message: messageWithRelations
      });

      res.status(201).json({ message: messageWithRelations });
    } else {
      return res.status(400).json({ error: 'É necessário fornecer bookingId ou receiverId' });
    }
  } catch (error) {
    console.error('Erro ao criar mensagem:', error);
    res.status(500).json({ error: 'Erro ao criar mensagem' });
  }
};

export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const message = await Message.findByPk(id);

    if (!message) {
      return res.status(404).json({ error: 'Mensagem não encontrada' });
    }

    if (message.receiverId !== req.user.id) {
      return res.status(403).json({ error: 'Você não pode marcar esta mensagem como lida' });
    }

    await message.update({
      isRead: true,
      readAt: new Date()
    });

    res.json({ message: 'Mensagem marcada como lida' });
  } catch (error) {
    console.error('Erro ao marcar mensagem como lida:', error);
    res.status(500).json({ error: 'Erro ao marcar mensagem como lida' });
  }
};

export const markConversationAsRead = async (req, res) => {
  try {
    const { bookingId, otherUserId } = req.query;

    const where = {
      receiverId: req.user.id,
      isRead: false
    };

    if (bookingId) {
      where.bookingId = parseInt(bookingId);
    } else if (otherUserId) {
      where.senderId = parseInt(otherUserId);
    } else {
      return res.status(400).json({ error: 'É necessário fornecer bookingId ou otherUserId' });
    }

    await Message.update(
      {
        isRead: true,
        readAt: new Date()
      },
      { where }
    );

    res.json({ message: 'Conversa marcada como lida' });
  } catch (error) {
    console.error('Erro ao marcar conversa como lida:', error);
    res.status(500).json({ error: 'Erro ao marcar conversa como lida' });
  }
};

