import { Discount, ServiceVariation, Service } from '../models/index.js';
import { validationResult } from 'express-validator';
import { Op } from 'sequelize';

export const getDiscounts = async (req, res) => {
  try {
    const { serviceVariationId } = req.query;
    
    const where = {};
    if (serviceVariationId) {
      where.serviceVariationId = parseInt(serviceVariationId);
    }

    const discounts = await Discount.findAll({
      where,
      include: [
        {
          model: ServiceVariation,
          as: 'variation',
          attributes: ['id', 'name', 'price']
        }
      ],
      order: [['dayOfWeek', 'ASC'], ['discountPercentage', 'DESC']]
    });

    res.json({ discounts });
  } catch (error) {
    console.error('Erro ao buscar descontos:', error);
    res.status(500).json({ error: 'Erro ao buscar descontos' });
  }
};

export const createDiscount = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { serviceVariationId, dayOfWeek, discountPercentage, startDate, endDate, isActive = true } = req.body;

    // Verificar se a variação existe e pertence ao prestador logado
    const variation = await ServiceVariation.findByPk(serviceVariationId, {
      include: [{ model: Service, as: 'service' }]
    });

    if (!variation) {
      return res.status(404).json({ error: 'Variação não encontrada' });
    }

    if (variation.service.providerId !== req.user.id) {
      return res.status(403).json({ error: 'Você não tem permissão para criar descontos neste serviço' });
    }

    const discount = await Discount.create({
      serviceVariationId: parseInt(serviceVariationId),
      dayOfWeek: parseInt(dayOfWeek),
      discountPercentage: parseFloat(discountPercentage),
      startDate: startDate || null,
      endDate: endDate || null,
      isActive: isActive !== undefined ? isActive : true
    });

    const discountWithRelations = await Discount.findByPk(discount.id, {
      include: [
        {
          model: ServiceVariation,
          as: 'variation',
          attributes: ['id', 'name', 'price']
        }
      ]
    });

    res.status(201).json({ discount: discountWithRelations });
  } catch (error) {
    console.error('Erro ao criar desconto:', error);
    res.status(500).json({ error: 'Erro ao criar desconto' });
  }
};

export const updateDiscount = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { dayOfWeek, discountPercentage, startDate, endDate, isActive } = req.body;

    const discount = await Discount.findByPk(id, {
      include: [
        {
          model: ServiceVariation,
          as: 'variation',
          include: [{ model: Service, as: 'service' }]
        }
      ]
    });

    if (!discount) {
      return res.status(404).json({ error: 'Desconto não encontrado' });
    }

    if (discount.variation.service.providerId !== req.user.id) {
      return res.status(403).json({ error: 'Você não tem permissão para editar este desconto' });
    }

    await discount.update({
      ...(dayOfWeek !== undefined && { dayOfWeek: parseInt(dayOfWeek) }),
      ...(discountPercentage !== undefined && { discountPercentage: parseFloat(discountPercentage) }),
      ...(startDate !== undefined && { startDate: startDate || null }),
      ...(endDate !== undefined && { endDate: endDate || null }),
      ...(isActive !== undefined && { isActive })
    });

    const updatedDiscount = await Discount.findByPk(id, {
      include: [
        {
          model: ServiceVariation,
          as: 'variation',
          attributes: ['id', 'name', 'price']
        }
      ]
    });

    res.json({ discount: updatedDiscount });
  } catch (error) {
    console.error('Erro ao atualizar desconto:', error);
    res.status(500).json({ error: 'Erro ao atualizar desconto' });
  }
};

export const deleteDiscount = async (req, res) => {
  try {
    const { id } = req.params;

    const discount = await Discount.findByPk(id, {
      include: [
        {
          model: ServiceVariation,
          as: 'variation',
          include: [{ model: Service, as: 'service' }]
        }
      ]
    });

    if (!discount) {
      return res.status(404).json({ error: 'Desconto não encontrado' });
    }

    if (discount.variation.service.providerId !== req.user.id) {
      return res.status(403).json({ error: 'Você não tem permissão para deletar este desconto' });
    }

    await discount.destroy();

    res.json({ message: 'Desconto removido com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar desconto:', error);
    res.status(500).json({ error: 'Erro ao deletar desconto' });
  }
};

