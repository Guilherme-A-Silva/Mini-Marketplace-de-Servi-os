import express from 'express';
import { body } from 'express-validator';
import { getReviews, createReview, updateReview, deleteReview } from '../controllers/reviewController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Rotas públicas
router.get('/', getReviews);

// Rotas protegidas (clientes)
router.post(
  '/',
  authenticate,
  [
    body('bookingId').isInt().withMessage('ID da contratação deve ser um número'),
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Avaliação deve ser entre 1 e 5'),
    body('comment').optional().isString().withMessage('Comentário deve ser texto')
  ],
  createReview
);

router.put(
  '/:id',
  authenticate,
  [
    body('rating').optional().isInt({ min: 1, max: 5 }).withMessage('Avaliação deve ser entre 1 e 5'),
    body('comment').optional().isString().withMessage('Comentário deve ser texto')
  ],
  updateReview
);

router.delete('/:id', authenticate, deleteReview);

export default router;

