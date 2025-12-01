import express from 'express';
import { body } from 'express-validator';
import { getDiscounts, createDiscount, updateDiscount, deleteDiscount } from '../controllers/discountController.js';
import { authenticate, requireProvider } from '../middleware/auth.js';

const router = express.Router();

// Rotas públicas
router.get('/', getDiscounts);

// Rotas protegidas (apenas prestadores)
router.post(
  '/',
  authenticate,
  requireProvider,
  [
    body('serviceVariationId').isInt().withMessage('ID da variação deve ser um número'),
    body('dayOfWeek').isInt({ min: 0, max: 6 }).withMessage('Dia da semana deve ser entre 0 (Domingo) e 6 (Sábado)'),
    body('discountPercentage').isFloat({ min: 0, max: 100 }).withMessage('Percentual de desconto deve ser entre 0 e 100')
  ],
  createDiscount
);

router.put(
  '/:id',
  authenticate,
  requireProvider,
  [
    body('dayOfWeek').optional().isInt({ min: 0, max: 6 }).withMessage('Dia da semana deve ser entre 0 (Domingo) e 6 (Sábado)'),
    body('discountPercentage').optional().isFloat({ min: 0, max: 100 }).withMessage('Percentual de desconto deve ser entre 0 e 100')
  ],
  updateDiscount
);

router.delete('/:id', authenticate, requireProvider, deleteDiscount);

export default router;

