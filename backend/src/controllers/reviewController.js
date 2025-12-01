import { Review, Booking, Service, User } from '../models/index.js';
import { validationResult } from 'express-validator';
import { fn, col } from 'sequelize';

export const getReviews = async (req, res) => {
  try {
    const { serviceId, providerId, limit = 50, offset = 0 } = req.query;
    
    const where = {};
    if (serviceId) {
      where.serviceId = parseInt(serviceId);
    }
    if (providerId) {
      where.providerId = parseInt(providerId);
    }

    const reviews = await Review.findAll({
      where,
      include: [
        {
          model: User,
          as: 'client',
          attributes: ['id', 'name']
        },
        {
          model: Service,
          as: 'service',
          attributes: ['id', 'name']
        },
        {
          model: Booking,
          as: 'booking',
          attributes: ['id', 'scheduledDate', 'scheduledTime']
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    // Calcular média de avaliações
    const whereClause = {};
    if (serviceId) whereClause.serviceId = parseInt(serviceId);
    if (providerId) whereClause.providerId = parseInt(providerId);
    
    const averageRating = await Review.findOne({
      where: whereClause,
      attributes: [
        [fn('AVG', col('rating')), 'avgRating'],
        [fn('COUNT', col('id')), 'totalReviews']
      ],
      raw: true
    });

    res.json({ 
      reviews,
      averageRating: averageRating ? parseFloat(averageRating.avgRating || 0).toFixed(2) : '0.00',
      totalReviews: averageRating ? parseInt(averageRating.totalReviews) : 0
    });
  } catch (error) {
    console.error('Erro ao buscar avaliações:', error);
    res.status(500).json({ error: 'Erro ao buscar avaliações' });
  }
};

export const createReview = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { bookingId, rating, comment } = req.body;

    // Verificar se a contratação existe e pertence ao cliente logado
    const booking = await Booking.findByPk(bookingId, {
      include: [
        { model: Service, as: 'service' }
      ]
    });

    if (!booking) {
      return res.status(404).json({ error: 'Contratação não encontrada' });
    }

    if (booking.clientId !== req.user.id) {
      return res.status(403).json({ error: 'Você só pode avaliar suas próprias contratações' });
    }

    if (booking.status !== 'completed') {
      return res.status(400).json({ error: 'Só é possível avaliar contratações concluídas' });
    }

    // Verificar se já existe avaliação para esta contratação
    const existingReview = await Review.findOne({ where: { bookingId } });
    if (existingReview) {
      return res.status(400).json({ error: 'Esta contratação já foi avaliada' });
    }

    const review = await Review.create({
      bookingId: parseInt(bookingId),
      serviceId: booking.serviceId,
      providerId: booking.providerId,
      clientId: req.user.id,
      rating: parseInt(rating),
      comment: comment || null
    });

    const reviewWithRelations = await Review.findByPk(review.id, {
      include: [
        {
          model: User,
          as: 'client',
          attributes: ['id', 'name']
        },
        {
          model: Service,
          as: 'service',
          attributes: ['id', 'name']
        }
      ]
    });

    res.status(201).json({ review: reviewWithRelations });
  } catch (error) {
    console.error('Erro ao criar avaliação:', error);
    res.status(500).json({ error: 'Erro ao criar avaliação' });
  }
};

export const updateReview = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { rating, comment } = req.body;

    const review = await Review.findByPk(id);

    if (!review) {
      return res.status(404).json({ error: 'Avaliação não encontrada' });
    }

    if (review.clientId !== req.user.id) {
      return res.status(403).json({ error: 'Você não tem permissão para editar esta avaliação' });
    }

    await review.update({
      ...(rating !== undefined && { rating: parseInt(rating) }),
      ...(comment !== undefined && { comment })
    });

    const updatedReview = await Review.findByPk(id, {
      include: [
        {
          model: User,
          as: 'client',
          attributes: ['id', 'name']
        },
        {
          model: Service,
          as: 'service',
          attributes: ['id', 'name']
        }
      ]
    });

    res.json({ review: updatedReview });
  } catch (error) {
    console.error('Erro ao atualizar avaliação:', error);
    res.status(500).json({ error: 'Erro ao atualizar avaliação' });
  }
};

export const deleteReview = async (req, res) => {
  try {
    const { id } = req.params;

    const review = await Review.findByPk(id);

    if (!review) {
      return res.status(404).json({ error: 'Avaliação não encontrada' });
    }

    if (review.clientId !== req.user.id) {
      return res.status(403).json({ error: 'Você não tem permissão para deletar esta avaliação' });
    }

    await review.destroy();

    res.json({ message: 'Avaliação removida com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar avaliação:', error);
    res.status(500).json({ error: 'Erro ao deletar avaliação' });
  }
};

