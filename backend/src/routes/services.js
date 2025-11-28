import express from 'express';
import {
  getServices,
  getServiceById,
  createService,
  updateService,
  deleteService
} from '../controllers/serviceController.js';
import { authenticate, requireProvider } from '../middleware/auth.js';
import { body } from 'express-validator';

const router = express.Router();

// Rotas públicas
router.get('/', getServices);
router.get('/:id', getServiceById);

// Rotas protegidas (prestador)
router.post('/',
  authenticate,
  requireProvider,
  [
    body('name').notEmpty().withMessage('Nome é obrigatório'),
    body('serviceTypeId').isInt().withMessage('Tipo de serviço é obrigatório'),
    body('variations').isArray({ min: 1 }).withMessage('Pelo menos uma variação é obrigatória'),
    body('variations.*.name').notEmpty().withMessage('Nome da variação é obrigatório'),
    body('variations.*.price').isFloat({ min: 0 }).withMessage('Preço deve ser um número positivo'),
    body('variations.*.durationMinutes').isInt({ min: 1 }).withMessage('Duração deve ser um número positivo')
  ],
  createService
);

router.put('/:id',
  authenticate,
  requireProvider,
  updateService
);

router.delete('/:id',
  authenticate,
  requireProvider,
  deleteService
);

export default router;

