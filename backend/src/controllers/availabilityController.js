import { AvailabilitySlot } from '../models/index.js';
import { RedisService } from '../services/redisService.js';
import { validationResult } from 'express-validator';

export const getAvailability = async (req, res) => {
  try {
    const { providerId } = req.query;
    const userId = providerId ? parseInt(providerId) : req.user.id;

    // Tentar buscar do cache
    const cached = await RedisService.getCachedAvailabilitySlots(userId);
    if (cached) {
      return res.json({ slots: cached });
    }

    const slots = await AvailabilitySlot.findAll({
      where: { providerId: userId, isActive: true },
      order: [['dayOfWeek', 'ASC'], ['startTime', 'ASC']]
    });

    // Cachear resultado
    await RedisService.cacheAvailabilitySlots(userId, slots);

    res.json({ slots });
  } catch (error) {
    console.error('Erro ao buscar disponibilidades:', error);
    res.status(500).json({ error: 'Erro ao buscar disponibilidades' });
  }
};

export const createAvailability = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { dayOfWeek, startTime, endTime } = req.body;

    const slot = await AvailabilitySlot.create({
      providerId: req.user.id,
      dayOfWeek: parseInt(dayOfWeek),
      startTime,
      endTime,
      isActive: true
    });

    // Invalidar cache
    await RedisService.invalidateCache(`availability:provider:${req.user.id}`);

    res.status(201).json({ slot });
  } catch (error) {
    console.error('Erro ao criar disponibilidade:', error);
    res.status(500).json({ error: 'Erro ao criar disponibilidade' });
  }
};

export const deleteAvailability = async (req, res) => {
  try {
    const { id } = req.params;

    const slot = await AvailabilitySlot.findByPk(id);
    if (!slot) {
      return res.status(404).json({ error: 'Disponibilidade não encontrada' });
    }

    if (slot.providerId !== req.user.id) {
      return res.status(403).json({ error: 'Você não tem permissão para deletar esta disponibilidade' });
    }

    await slot.destroy();

    // Invalidar cache
    await RedisService.invalidateCache(`availability:provider:${req.user.id}`);

    res.json({ message: 'Disponibilidade removida com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar disponibilidade:', error);
    res.status(500).json({ error: 'Erro ao deletar disponibilidade' });
  }
};

