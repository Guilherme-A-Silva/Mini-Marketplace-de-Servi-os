import express from 'express';
import {
  createBooking,
  getBookings,
  approveBooking,
  rejectBooking,
  cancelBooking,
  acceptSuggestion,
  rejectSuggestion,
  completeBooking
} from '../controllers/bookingController.js';
import { authenticate, requireProvider } from '../middleware/auth.js';
import { body } from 'express-validator';

const router = express.Router();

router.post('/',
  authenticate,
  [
    body('serviceId').isInt({ min: 1 }).withMessage('ID do serviço é obrigatório e deve ser um número'),
    body('serviceVariationId').isInt({ min: 1 }).withMessage('ID da variação é obrigatório e deve ser um número'),
    body('scheduledDate').notEmpty().withMessage('Data é obrigatória').custom((value) => {
      // Aceitar formato YYYY-MM-DD
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(value)) {
        throw new Error('Data deve estar no formato YYYY-MM-DD');
      }
      return true;
    }),
    body('scheduledTime').matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Horário inválido (formato: HH:MM)'),
    body('endDate').optional().custom((value) => {
      if (value) {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(value)) {
          throw new Error('Data de fim deve estar no formato YYYY-MM-DD');
        }
      }
      return true;
    }),
    body('endTime').optional().matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Horário de fim inválido (formato: HH:MM)')
  ],
  createBooking
);

router.get('/', authenticate, getBookings);

// Rotas para prestador aprovar/rejeitar
router.put('/:id/approve', authenticate, requireProvider, approveBooking);
router.put('/:id/reject', 
  authenticate, 
  requireProvider,
  [
    body('reason').optional().isString().withMessage('Motivo deve ser uma string'),
    body('suggestedDate').optional().custom((value) => {
      if (value) {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(value)) {
          throw new Error('Data sugerida deve estar no formato YYYY-MM-DD');
        }
      }
      return true;
    }),
    body('suggestedTime').optional().matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Horário sugerido inválido (formato: HH:MM)')
  ],
  rejectBooking
);

router.put('/:id/cancel', authenticate, cancelBooking);

// Rota para prestador finalizar pedido
router.put('/:id/complete', authenticate, requireProvider, completeBooking);

// Rotas para cliente aceitar/rejeitar sugestão
router.put('/:id/accept-suggestion', authenticate, acceptSuggestion);
router.put('/:id/reject-suggestion', authenticate, rejectSuggestion);

export default router;

