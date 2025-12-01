import express from 'express';
import { body } from 'express-validator';
import { getMessages, getConversations, createMessage, markAsRead, markConversationAsRead } from '../controllers/messageController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Todas as rotas requerem autenticação
router.get('/conversations', authenticate, getConversations);
router.get('/', authenticate, getMessages);
router.post(
  '/',
  authenticate,
  [
    body('content').notEmpty().withMessage('Conteúdo da mensagem é obrigatório'),
    body('bookingId').optional().isInt().withMessage('ID da contratação deve ser um número'),
    body('receiverId').optional().isInt().withMessage('ID do destinatário deve ser um número')
  ],
  createMessage
);
router.put('/:id/read', authenticate, markAsRead);
router.put('/read/conversation', authenticate, markConversationAsRead);

export default router;

