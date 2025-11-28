import express from 'express';
import {
  getAvailability,
  createAvailability,
  deleteAvailability
} from '../controllers/availabilityController.js';
import { authenticate, requireProvider } from '../middleware/auth.js';
import { body } from 'express-validator';

const router = express.Router();

router.get('/', authenticate, getAvailability);

router.post('/',
  authenticate,
  requireProvider,
  [
    body('dayOfWeek').isInt({ min: 0, max: 6 }).withMessage('Dia da semana inválido (0-6)'),
    body('startTime').matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Horário de início inválido (HH:MM)'),
    body('endTime').matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Horário de fim inválido (HH:MM)')
  ],
  createAvailability
);

router.delete('/:id',
  authenticate,
  requireProvider,
  deleteAvailability
);

export default router;

