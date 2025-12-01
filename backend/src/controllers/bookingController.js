import { Booking, Service, ServiceVariation, User, Notification, Review } from '../models/index.js';
import { Op } from 'sequelize';
import { RedisService } from '../services/redisService.js';
import { DiscountService } from '../services/discountService.js';
import { validationResult } from 'express-validator';
import { publishToRedis } from '../config/socket.js';

// Função auxiliar para verificar sobreposição de horários
async function checkTimeOverlap(providerId, scheduledDate, scheduledTime, durationMinutes, bookingId = null) {
  const newStart = new Date(`${scheduledDate}T${scheduledTime}`);
  const newEnd = new Date(newStart.getTime() + durationMinutes * 60000);

  // Buscar todas as contratações ativas do prestador no mesmo dia
  const existingBookings = await Booking.findAll({
    where: {
      providerId,
      status: { [Op.in]: ['pending', 'confirmed'] },
      scheduledDate: scheduledDate,
      ...(bookingId ? { id: { [Op.ne]: bookingId } } : {})
    }
  });

  // Verificar sobreposição com cada contratação existente
  for (const booking of existingBookings) {
    const existingStart = new Date(`${booking.scheduledDate}T${booking.scheduledTime}`);

    // Se for serviço de múltiplos dias, usar endDate/endTime
    let existingEnd;
    if (booking.endDate && booking.endTime) {
      existingEnd = new Date(`${booking.endDate}T${booking.endTime}`);
    } else {
      // Buscar duração da variação
      const variation = await ServiceVariation.findByPk(booking.serviceVariationId);
      if (variation) {
        existingEnd = new Date(existingStart.getTime() + variation.durationMinutes * 60000);
      } else {
        existingEnd = existingStart; // Fallback
      }
    }

    // Verificar sobreposição: novo agendamento começa antes do existente terminar
    // e termina depois do existente começar
    if (newStart < existingEnd && newEnd > existingStart) {
      return true; // Há sobreposição
    }
  }

  // Verificar serviços de múltiplos dias que podem se sobrepor
  const multiDayBookings = await Booking.findAll({
    where: {
      providerId,
      status: { [Op.in]: ['pending', 'confirmed'] },
      endDate: { [Op.ne]: null },
      ...(bookingId ? { id: { [Op.ne]: bookingId } } : {})
    }
  });

  for (const booking of multiDayBookings) {
    const existingStart = new Date(`${booking.scheduledDate}T${booking.scheduledTime}`);
    const existingEnd = new Date(`${booking.endDate}T${booking.endTime}`);

    if (newStart < existingEnd && newEnd > existingStart) {
      return true; // Há sobreposição
    }
  }

  return false; // Não há sobreposição
}

export const createBooking = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Dados inválidos',
        errors: errors.array()
      });
    }

    const { serviceId, serviceVariationId, scheduledDate, scheduledTime, endDate, endTime } = req.body;

    // Garantir que scheduledDate está no formato YYYY-MM-DD (sem hora/timezone)
    const normalizedScheduledDate = typeof scheduledDate === 'string' 
      ? scheduledDate.split('T')[0] 
      : scheduledDate;
    const normalizedEndDate = endDate 
      ? (typeof endDate === 'string' ? endDate.split('T')[0] : endDate)
      : null;

    // Buscar serviço e variação
    const service = await Service.findByPk(serviceId, {
      include: [{ model: User, as: 'provider' }]
    });

    if (!service) {
      return res.status(404).json({ error: 'Serviço não encontrado' });
    }

    const variation = await ServiceVariation.findByPk(serviceVariationId);
    if (!variation || variation.serviceId !== serviceId) {
      return res.status(404).json({ error: 'Variação não encontrada' });
    }

    // Verificar sobreposição apenas com contratações confirmadas (aviso, não bloqueia)
    let hasOverlap = false;
    let overlapWarning = null;

    if (normalizedEndDate && endTime) {
      const newStart = new Date(`${normalizedScheduledDate}T${scheduledTime}`);
      const newEnd = new Date(`${normalizedEndDate}T${endTime}`);

      const confirmedBookings = await Booking.findAll({
        where: {
          providerId: service.providerId,
          status: 'confirmed',
          [Op.or]: [
            {
              scheduledDate: { [Op.lte]: normalizedEndDate },
              endDate: { [Op.gte]: normalizedScheduledDate }
            },
            {
              scheduledDate: normalizedScheduledDate,
              endDate: null // Single day services
            }
          ]
        },
        include: [{ model: ServiceVariation, as: 'variation' }]
      });

      for (const existing of confirmedBookings) {
        const existingStart = new Date(`${existing.scheduledDate}T${existing.scheduledTime}`);
        let existingEnd;

        if (existing.endDate && existing.endTime) {
          existingEnd = new Date(`${existing.endDate}T${existing.endTime}`);
        } else if (existing.variation) {
          existingEnd = new Date(existingStart.getTime() + existing.variation.durationMinutes * 60000);
        } else {
          continue;
        }

        if (newStart < existingEnd && newEnd > existingStart) {
          hasOverlap = true;
          overlapWarning = 'Este período conflita com uma contratação confirmada. O prestador precisará avaliar.';
          break;
        }
      }
    } else {
      // Verificar apenas com confirmadas
      const confirmedBookings = await Booking.findAll({
        where: {
          providerId: service.providerId,
          status: 'confirmed',
          scheduledDate: normalizedScheduledDate
        },
        include: [{ model: ServiceVariation, as: 'variation' }]
      });

      const newStart = new Date(`${normalizedScheduledDate}T${scheduledTime}`);
      const newEnd = new Date(newStart.getTime() + variation.durationMinutes * 60000);

      for (const existing of confirmedBookings) {
        const existingStart = new Date(`${existing.scheduledDate}T${existing.scheduledTime}`);
        let existingEnd;

        if (existing.endDate && existing.endTime) {
          existingEnd = new Date(`${existing.endDate}T${existing.endTime}`);
        } else if (existing.variation) {
          existingEnd = new Date(existingStart.getTime() + existing.variation.durationMinutes * 60000);
        } else {
          continue;
        }

        if (newStart < existingEnd && newEnd > existingStart) {
          hasOverlap = true;
          overlapWarning = 'Este horário conflita com uma contratação confirmada. O prestador precisará avaliar.';
          break;
        }
      }
    }

    // Calcular preço com desconto
    const priceCalculation = await DiscountService.calculatePriceWithDiscount(
      serviceVariationId,
      normalizedScheduledDate,
      variation.price
    );

    // Criar contratação com status pendente
    const booking = await Booking.create({
      clientId: req.user.id,
      providerId: service.providerId,
      serviceId: parseInt(serviceId),
      serviceVariationId: parseInt(serviceVariationId),
      scheduledDate: normalizedScheduledDate,
      scheduledTime,
      endDate: normalizedEndDate,
      endTime: endTime || null,
      status: 'pending', // Status inicial: pendente
      totalPrice: priceCalculation.finalPrice
    });

    // Criar notificação para o prestador
    await Notification.create({
      userId: service.providerId,
      bookingId: booking.id,
      type: 'new_booking',
      message: `Nova solicitação de contratação: ${service.name} - ${variation.name} em ${scheduledDate} às ${scheduledTime}. Aguardando sua aprovação.`
    });

    // Invalidar cache de disponibilidades
    await RedisService.invalidateCache(`availability:provider:${service.providerId}`);

    const bookingWithRelations = await Booking.findByPk(booking.id, {
      include: [
        { model: Service, as: 'service', include: [{ model: User, as: 'provider' }] },
        { model: ServiceVariation, as: 'variation' },
        { model: User, as: 'client' }
      ]
    });

    // Emitir evento via WebSocket
    publishToRedis('booking-created', {
      bookingId: bookingWithRelations.id,
      status: 'pending',
      clientId: booking.clientId,
      providerId: service.providerId,
      booking: bookingWithRelations.get({ plain: true })
    });

    res.status(201).json({
      booking: bookingWithRelations.get({ plain: true }),
      message: 'Solicitação de contratação criada com sucesso. Aguardando aprovação do prestador.',
      warning: overlapWarning
    });
  } catch (error) {
    console.error('Erro ao criar contratação:', error);
    res.status(500).json({ error: 'Erro ao criar contratação' });
  }
};

export const getBookings = async (req, res) => {
  try {
    const { clientId, providerId, status, serviceId } = req.query;
    const where = {};

    if (req.user.role === 'client') {
      where.clientId = req.user.id;
    } else if (req.user.role === 'provider') {
      where.providerId = req.user.id;
    }

    if (clientId && req.user.role === 'provider') { // Provider can filter by client
      where.clientId = parseInt(clientId);
    }
    if (providerId && req.user.role === 'client') { // Client can filter by provider
      where.providerId = parseInt(providerId);
    }
    if (status) {
      where.status = status;
    }
    if (serviceId) {
      where.serviceId = parseInt(serviceId);
    }

    const bookings = await Booking.findAll({
      where,
      include: [
        {
          model: Service,
          as: 'service',
          attributes: ['id', 'name'],
          include: [{ model: User, as: 'provider', attributes: ['id', 'name'] }]
        },
        {
          model: ServiceVariation,
          as: 'variation',
          attributes: ['id', 'name', 'price', 'durationMinutes']
        },
        {
          model: User,
          as: 'client',
          attributes: ['id', 'name', 'email']
        },
        {
          model: Review, // Include review to check if already reviewed
          as: 'review',
          attributes: ['id']
        }
      ],
      order: [['createdAt', 'DESC'], ['scheduledDate', 'DESC'], ['scheduledTime', 'DESC']]
    });

    res.json({ bookings: bookings.map(b => b.get({ plain: true })) });
  } catch (error) {
    console.error('Erro ao buscar contratações:', error);
    res.status(500).json({ error: 'Erro ao buscar contratações' });
  }
};

export const approveBooking = async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await Booking.findByPk(id, {
      include: [
        { model: Service, as: 'service' },
        { model: ServiceVariation, as: 'variation' },
        { model: User, as: 'client' }
      ]
    });

    if (!booking) {
      return res.status(404).json({ error: 'Contratação não encontrada' });
    }

    if (booking.providerId !== req.user.id) {
      return res.status(403).json({ error: 'Você não tem permissão para aprovar esta contratação' });
    }

    if (booking.status !== 'pending') {
      return res.status(400).json({ error: 'A contratação não está pendente de aprovação' });
    }

    // Verificar sobreposição de horários antes de confirmar
    const hasOverlap = await checkTimeOverlap(
      booking.providerId,
      booking.scheduledDate,
      booking.scheduledTime,
      booking.variation.durationMinutes,
      booking.id // Excluir a própria contratação da verificação
    );

    if (hasOverlap) {
      return res.status(400).json({ error: 'Este horário conflita com outro agendamento confirmado do prestador.' });
    }

    await booking.update({ status: 'confirmed' });

    // Criar notificação para o cliente
    await Notification.create({
      userId: booking.clientId,
      bookingId: booking.id,
      type: 'booking_confirmed',
      message: `Sua contratação de "${booking.service.name} - ${booking.variation.name}" para ${booking.scheduledDate} às ${booking.scheduledTime} foi CONFIRMADA!`
    });

    // Invalidar cache de disponibilidades
    await RedisService.invalidateCache(`availability:provider:${booking.providerId}`);

    // Emitir evento via WebSocket
    publishToRedis('booking-updated', {
      bookingId: booking.id,
      status: 'confirmed',
      clientId: booking.clientId,
      providerId: booking.providerId,
      booking: booking.get({ plain: true })
    });

    res.json({ message: 'Contratação aprovada com sucesso', booking: booking.get({ plain: true }) });
  } catch (error) {
    console.error('Erro ao aprovar contratação:', error);
    res.status(500).json({ error: 'Erro ao aprovar contratação' });
  }
};

export const rejectBooking = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Dados inválidos',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { reason, suggestedDate, suggestedTime } = req.body;

    // Normalizar suggestedDate para formato YYYY-MM-DD (sem hora/timezone)
    const normalizedSuggestedDate = suggestedDate 
      ? (typeof suggestedDate === 'string' ? suggestedDate.split('T')[0] : suggestedDate)
      : null;

    const booking = await Booking.findByPk(id, {
      include: [
        { model: Service, as: 'service' },
        { model: ServiceVariation, as: 'variation' },
        { model: User, as: 'client' }
      ]
    });

    if (!booking) {
      return res.status(404).json({ error: 'Contratação não encontrada' });
    }

    if (booking.providerId !== req.user.id) {
      return res.status(403).json({ error: 'Você não tem permissão para rejeitar esta contratação' });
    }

    if (booking.status !== 'pending') {
      return res.status(400).json({ error: 'A contratação não está pendente de aprovação' });
    }

    await booking.update({
      status: 'rejected',
      rejectionReason: reason || null,
      suggestedDate: normalizedSuggestedDate,
      suggestedTime: suggestedTime || null
    });

    let messageToClient = `Sua contratação de "${booking.service.name} - ${booking.variation.name}" para ${booking.scheduledDate} às ${booking.scheduledTime} foi REJEITADA.`;
    if (reason) {
      messageToClient += ` Motivo: ${reason}.`;
    }
    if (normalizedSuggestedDate && suggestedTime) {
      messageToClient += ` O prestador sugeriu uma nova data: ${normalizedSuggestedDate} às ${suggestedTime}.`;
    }

    // Criar notificação para o cliente
    await Notification.create({
      userId: booking.clientId,
      bookingId: booking.id,
      type: 'booking_rejected',
      message: messageToClient
    });

    // Invalidar cache de disponibilidades
    await RedisService.invalidateCache(`availability:provider:${booking.providerId}`);

    // Emitir evento via WebSocket
    publishToRedis('booking-updated', {
      bookingId: booking.id,
      status: 'rejected',
      clientId: booking.clientId,
      providerId: booking.providerId,
      booking: booking.get({ plain: true })
    });

    res.json({ message: 'Contratação rejeitada com sucesso', booking: booking.get({ plain: true }) });
  } catch (error) {
    console.error('Erro ao rejeitar contratação:', error);
    res.status(500).json({ error: 'Erro ao rejeitar contratação' });
  }
};

export const cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await Booking.findByPk(id, {
      include: [
        { model: Service, as: 'service' },
        { model: ServiceVariation, as: 'variation' },
        { model: User, as: 'client' },
        { model: User, as: 'provider' }
      ]
    });

    if (!booking) {
      return res.status(404).json({ error: 'Contratação não encontrada' });
    }

    // Apenas o cliente que criou ou o prestador do serviço podem cancelar
    if (booking.clientId !== req.user.id && booking.providerId !== req.user.id) {
      return res.status(403).json({ error: 'Você não tem permissão para cancelar esta contratação' });
    }

    if (booking.status === 'cancelled' || booking.status === 'completed') {
      return res.status(400).json({ error: 'A contratação já foi cancelada ou concluída.' });
    }

    await booking.update({ status: 'cancelled' });

    // Notificar a outra parte
    const otherUserId = req.user.id === booking.clientId ? booking.providerId : booking.clientId;
    const notificationMessage = `A contratação de "${booking.service.name} - ${booking.variation.name}" para ${booking.scheduledDate} às ${booking.scheduledTime} foi CANCELADA por ${req.user.name}.`;

    await Notification.create({
      userId: otherUserId,
      bookingId: booking.id,
      type: 'booking_cancelled',
      message: notificationMessage
    });

    // Invalidar cache de disponibilidades
    await RedisService.invalidateCache(`availability:provider:${booking.providerId}`);

    // Emitir evento via WebSocket
    publishToRedis('booking-cancelled', {
      bookingId: booking.id,
      status: 'cancelled',
      clientId: booking.clientId,
      providerId: booking.providerId,
      booking: booking.get({ plain: true })
    });

    res.json({ message: 'Contratação cancelada com sucesso', booking: booking.get({ plain: true }) });
  } catch (error) {
    console.error('Erro ao cancelar contratação:', error);
    res.status(500).json({ error: 'Erro ao cancelar contratação' });
  }
};

export const acceptSuggestion = async (req, res) => {
  try {
    const { id } = req.params; // ID da contratação original rejeitada
    const { scheduledDate, scheduledTime } = req.body;

    const originalBooking = await Booking.findByPk(id, {
      include: [
        { model: Service, as: 'service' },
        { model: ServiceVariation, as: 'variation' },
        { model: User, as: 'provider' },
        { model: User, as: 'client' }
      ]
    });

    if (!originalBooking) {
      return res.status(404).json({ error: 'Contratação original não encontrada' });
    }

    if (originalBooking.clientId !== req.user.id) {
      return res.status(403).json({ error: 'Você não tem permissão para aceitar esta sugestão' });
    }

    if (originalBooking.status !== 'rejected' || !originalBooking.suggestedDate || !originalBooking.suggestedTime) {
      return res.status(400).json({ error: 'A contratação não foi rejeitada com uma sugestão válida.' });
    }

    // Usar a data e hora sugeridas ou as do corpo da requisição se fornecidas
    let finalScheduledDate = scheduledDate || originalBooking.suggestedDate;
    const finalScheduledTime = scheduledTime || originalBooking.suggestedTime;

    // Normalizar a data para formato YYYY-MM-DD
    if (finalScheduledDate) {
      finalScheduledDate = typeof finalScheduledDate === 'string' 
        ? finalScheduledDate.split('T')[0] 
        : finalScheduledDate;
    }

    if (!finalScheduledDate || !finalScheduledTime) {
      return res.status(400).json({ error: 'Data e hora sugeridas são necessárias.' });
    }

    // Verificar sobreposição de horários para a nova data/hora
    const hasOverlap = await checkTimeOverlap(
      originalBooking.providerId,
      finalScheduledDate,
      finalScheduledTime,
      originalBooking.variation.durationMinutes
    );

    if (hasOverlap) {
      return res.status(400).json({ error: 'O horário sugerido conflita com outro agendamento confirmado do prestador.' });
    }

    // Calcular preço com desconto para a nova data
    const priceCalculation = await DiscountService.calculatePriceWithDiscount(
      originalBooking.serviceVariationId,
      finalScheduledDate,
      originalBooking.variation.price
    );

    // Criar uma nova contratação com status 'pending'
    const newBooking = await Booking.create({
      clientId: originalBooking.clientId,
      providerId: originalBooking.providerId,
      serviceId: originalBooking.serviceId,
      serviceVariationId: originalBooking.serviceVariationId,
      scheduledDate: finalScheduledDate,
      scheduledTime: finalScheduledTime,
      endDate: originalBooking.endDate, // Manter se for serviço de múltiplos dias
      endTime: originalBooking.endTime, // Manter se for serviço de múltiplos dias
      status: 'pending',
      totalPrice: priceCalculation.finalPrice
    });

    // Atualizar a contratação original para referenciar a nova
    await originalBooking.update({ alternativeBookingId: newBooking.id });

    // Criar notificação para o prestador
    await Notification.create({
      userId: originalBooking.providerId,
      bookingId: newBooking.id,
      type: 'new_booking',
      message: `O cliente ${originalBooking.client.name} aceitou sua sugestão para "${originalBooking.service.name} - ${originalBooking.variation.name}" para ${finalScheduledDate} às ${finalScheduledTime}. Nova solicitação criada.`
    });

    // Invalidar cache de disponibilidades
    await RedisService.invalidateCache(`availability:provider:${originalBooking.providerId}`);

    const newBookingWithRelations = await Booking.findByPk(newBooking.id, {
      include: [
        { model: Service, as: 'service', include: [{ model: User, as: 'provider' }] },
        { model: ServiceVariation, as: 'variation' },
        { model: User, as: 'client' }
      ]
    });

    // Emitir evento via WebSocket
    publishToRedis('booking-suggestion-accepted', {
      bookingId: newBookingWithRelations.id,
      originalBookingId: originalBooking.id,
      status: 'pending',
      clientId: originalBooking.clientId,
      providerId: originalBooking.providerId,
      booking: newBookingWithRelations.get({ plain: true })
    });

    res.json({ message: 'Sugestão aceita e nova contratação criada!', booking: newBookingWithRelations.get({ plain: true }) });
  } catch (error) {
    console.error('Erro ao aceitar sugestão:', error);
    res.status(500).json({ error: 'Erro ao aceitar sugestão' });
  }
};

export const rejectSuggestion = async (req, res) => {
  try {
    const { id } = req.params; // ID da contratação original rejeitada

    const originalBooking = await Booking.findByPk(id, {
      include: [
        { model: Service, as: 'service' },
        { model: ServiceVariation, as: 'variation' },
        { model: User, as: 'provider' },
        { model: User, as: 'client' }
      ]
    });

    if (!originalBooking) {
      return res.status(404).json({ error: 'Contratação original não encontrada' });
    }

    if (originalBooking.clientId !== req.user.id) {
      return res.status(403).json({ error: 'Você não tem permissão para rejeitar esta sugestão' });
    }

    if (originalBooking.status !== 'rejected' || !originalBooking.suggestedDate || !originalBooking.suggestedTime) {
      return res.status(400).json({ error: 'A contratação não foi rejeitada com uma sugestão válida.' });
    }

    // Verificar se a sugestão já foi rejeitada anteriormente
    if (originalBooking.suggestionRejectedAt) {
      return res.status(400).json({ error: 'Esta sugestão já foi rejeitada anteriormente.' });
    }

    // Marcar que a sugestão foi rejeitada e criar notificação para o prestador
    await originalBooking.update({
      suggestionRejectedAt: new Date()
    });

    await Notification.create({
      userId: originalBooking.providerId,
      bookingId: originalBooking.id,
      type: 'suggestion_rejected',
      message: `O cliente ${originalBooking.client.name} REJEITOU sua sugestão para "${originalBooking.service.name} - ${originalBooking.variation.name}".`
    });

    // Emitir evento via WebSocket
    publishToRedis('booking-suggestion-rejected', {
      bookingId: originalBooking.id,
      status: 'rejected', // Permanece rejected
      clientId: originalBooking.clientId,
      providerId: originalBooking.providerId,
      booking: originalBooking.get({ plain: true })
    });

    res.json({ message: 'Sugestão rejeitada com sucesso.' });
  } catch (error) {
    console.error('Erro ao rejeitar sugestão:', error);
    res.status(500).json({ error: 'Erro ao rejeitar sugestão' });
  }
};

export const completeBooking = async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await Booking.findByPk(id, {
      include: [{ model: Service, as: 'service' }, { model: ServiceVariation, as: 'variation' }]
    });

    if (!booking) {
      return res.status(404).json({ error: 'Contratação não encontrada' });
    }

    // Apenas prestador pode marcar como concluído
    if (booking.providerId !== req.user.id) {
      return res.status(403).json({ error: 'Apenas o prestador pode marcar a contratação como concluída' });
    }

    if (booking.status !== 'confirmed') {
      return res.status(400).json({ error: 'Apenas contratações confirmadas podem ser marcadas como concluídas' });
    }

    await booking.update({ status: 'completed' });

    // Criar notificação para o cliente
    await Notification.create({
      userId: booking.clientId,
      bookingId: booking.id,
      type: 'booking_updated',
      message: `Contratação concluída: ${booking.service.name} - ${booking.variation.name}. Você pode avaliar o serviço agora.`
    });

    // Invalidar cache
    await RedisService.invalidateCache(`availability:provider:${booking.providerId}`);

    const updatedBooking = await Booking.findByPk(id, {
      include: [
        { model: Service, as: 'service', include: [{ model: User, as: 'provider' }] },
        { model: ServiceVariation, as: 'variation' },
        { model: User, as: 'client' }
      ]
    });

    const bookingData = updatedBooking ? updatedBooking.get({ plain: true }) : null;

    // Emitir evento via WebSocket
    publishToRedis('booking-updated', {
      bookingId: updatedBooking.id,
      status: 'completed',
      clientId: booking.clientId,
      providerId: booking.providerId,
      booking: bookingData
    });

    res.json({
      message: 'Contratação marcada como concluída com sucesso',
      booking: bookingData
    });
  } catch (error) {
    console.error('Erro ao marcar contratação como concluída:', error);
    res.status(500).json({ error: 'Erro ao marcar contratação como concluída' });
  }
};
