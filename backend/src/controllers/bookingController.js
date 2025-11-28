import { Booking, Service, ServiceVariation, User, Notification } from '../models/index.js';
import { Op } from 'sequelize';
import { RedisService } from '../services/redisService.js';
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
    
    if (endDate && endTime) {
      const newStart = new Date(`${scheduledDate}T${scheduledTime}`);
      const newEnd = new Date(`${endDate}T${endTime}`);
      
      const overlappingBookings = await Booking.findAll({
        where: {
          providerId: service.providerId,
          status: 'confirmed' // Apenas confirmadas bloqueiam
        },
        include: [{ model: ServiceVariation, as: 'variation' }]
      });

      for (const existing of overlappingBookings) {
        let existingStart = new Date(`${existing.scheduledDate}T${existing.scheduledTime}`);
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
    } else {
      // Verificar apenas com confirmadas
      const confirmedBookings = await Booking.findAll({
        where: {
          providerId: service.providerId,
          status: 'confirmed',
          scheduledDate: scheduledDate
        },
        include: [{ model: ServiceVariation, as: 'variation' }]
      });

      const newStart = new Date(`${scheduledDate}T${scheduledTime}`);
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

    // Criar contratação com status pendente
    const booking = await Booking.create({
      clientId: req.user.id,
      providerId: service.providerId,
      serviceId: parseInt(serviceId),
      serviceVariationId: parseInt(serviceVariationId),
      scheduledDate,
      scheduledTime,
      endDate: endDate || null,
      endTime: endTime || null,
      status: 'pending', // Status inicial: pendente
      totalPrice: variation.price
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
      booking: bookingWithRelations
    });

    res.status(201).json({ 
      booking: bookingWithRelations,
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
    const where = {};
    
    if (req.user.role === 'provider') {
      where.providerId = req.user.id;
    } else {
      where.clientId = req.user.id;
    }

    const bookings = await Booking.findAll({
      where,
      attributes: [
        'id', 'clientId', 'providerId', 'serviceId', 'serviceVariationId',
        'scheduledDate', 'scheduledTime', 'endDate', 'endTime',
        'status', 'totalPrice', 'createdAt', 'updatedAt',
        'rejectionReason', 'suggestedDate', 'suggestedTime', 'alternativeBookingId'
      ],
      include: [
        {
          model: Service,
          as: 'service',
          include: [
            { model: User, as: 'provider', attributes: ['id', 'name', 'phone'] }
          ]
        },
        {
          model: ServiceVariation,
          as: 'variation',
          attributes: ['id', 'name', 'price', 'durationMinutes']
        },
        {
          model: User,
          as: req.user.role === 'provider' ? 'client' : 'provider',
          attributes: ['id', 'name', 'phone', 'email']
        }
      ],
      order: [['scheduledDate', 'DESC'], ['scheduledTime', 'DESC']]
    });

    res.json({ bookings });
  } catch (error) {
    console.error('Erro ao buscar contratações:', error);
    res.status(500).json({ error: 'Erro ao buscar contratações' });
  }
};

export const approveBooking = async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await Booking.findByPk(id, {
      include: [{ model: Service, as: 'service' }, { model: ServiceVariation, as: 'variation' }]
    });

    if (!booking) {
      return res.status(404).json({ error: 'Contratação não encontrada' });
    }

    if (booking.providerId !== req.user.id) {
      return res.status(403).json({ error: 'Você não tem permissão para aprovar esta contratação' });
    }

    if (booking.status !== 'pending') {
      return res.status(400).json({ error: 'Apenas contratações pendentes podem ser aprovadas' });
    }

    // Verificar sobreposição com outras contratações confirmadas
    let hasOverlap = false;
    
    if (booking.endDate && booking.endTime) {
      const newStart = new Date(`${booking.scheduledDate}T${booking.scheduledTime}`);
      const newEnd = new Date(`${booking.endDate}T${booking.endTime}`);
      
      const overlappingBookings = await Booking.findAll({
        where: {
          providerId: booking.providerId,
          status: 'confirmed',
          id: { [Op.ne]: booking.id }
        },
        include: [{ model: ServiceVariation, as: 'variation' }]
      });

      for (const existing of overlappingBookings) {
        let existingStart = new Date(`${existing.scheduledDate}T${existing.scheduledTime}`);
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
          break;
        }
      }
    } else {
      const confirmedBookings = await Booking.findAll({
        where: {
          providerId: booking.providerId,
          status: 'confirmed',
          scheduledDate: booking.scheduledDate,
          id: { [Op.ne]: booking.id }
        },
        include: [{ model: ServiceVariation, as: 'variation' }]
      });

      const newStart = new Date(`${booking.scheduledDate}T${booking.scheduledTime}`);
      const newEnd = new Date(newStart.getTime() + booking.variation.durationMinutes * 60000);

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
          break;
        }
      }
    }

    if (hasOverlap) {
      return res.status(400).json({
        error: 'Não é possível aprovar: este horário conflita com uma contratação já confirmada.'
      });
    }

    // Aprovar contratação
    await booking.update({ status: 'confirmed' });

    // Criar notificação para o cliente
    await Notification.create({
      userId: booking.clientId,
      bookingId: booking.id,
      type: 'booking_updated',
      message: `Sua contratação foi aprovada: ${booking.service.name} - ${booking.variation.name} em ${booking.scheduledDate} às ${booking.scheduledTime}`
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

    // Converter para objeto plano para evitar problemas de serialização
    const bookingData = updatedBooking ? updatedBooking.get({ plain: true }) : null;

    // Emitir evento via WebSocket
    publishToRedis('booking-updated', {
      bookingId: updatedBooking.id,
      status: 'confirmed',
      clientId: booking.clientId,
      providerId: booking.providerId,
      booking: bookingData
    });

    res.json({ booking: bookingData, message: 'Contratação aprovada com sucesso' });
  } catch (error) {
    console.error('Erro ao aprovar contratação:', error);
    res.status(500).json({ error: 'Erro ao aprovar contratação' });
  }
};

export const rejectBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, suggestedDate, suggestedTime } = req.body;

    const booking = await Booking.findByPk(id, {
      include: [{ model: Service, as: 'service' }]
    });

    if (!booking) {
      return res.status(404).json({ error: 'Contratação não encontrada' });
    }

    if (booking.providerId !== req.user.id) {
      return res.status(403).json({ error: 'Você não tem permissão para rejeitar esta contratação' });
    }

    if (booking.status !== 'pending') {
      return res.status(400).json({ error: 'Apenas contratações pendentes podem ser rejeitadas' });
    }

    // Atualizar contratação com motivo e sugestão (se houver)
    const updateData = {
      status: 'rejected',
      rejectionReason: reason || null
    };

    if (suggestedDate && suggestedTime) {
      // Validar formato da data (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(suggestedDate)) {
        return res.status(400).json({ error: 'Data sugerida deve estar no formato YYYY-MM-DD' });
      }
      
      // Validar formato do horário (HH:MM)
      const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(suggestedTime)) {
        return res.status(400).json({ error: 'Horário sugerido deve estar no formato HH:MM' });
      }

      updateData.suggestedDate = suggestedDate;
      updateData.suggestedTime = suggestedTime;
    } else {
      // Se não forneceu ambos, garantir que ambos sejam null
      updateData.suggestedDate = null;
      updateData.suggestedTime = null;
    }

    try {
      await booking.update(updateData);
    } catch (updateError) {
      console.error('Erro ao atualizar booking:', updateError);
      // Se o erro for sobre coluna não encontrada, informar que precisa rodar migração
      if (updateError.message && updateError.message.includes('column')) {
        return res.status(500).json({ 
          error: 'Erro: Campos de sugestão não encontrados. Execute a migração do banco de dados (npm run migrate).',
          details: updateError.message
        });
      }
      throw updateError;
    }

    // Criar notificação para o cliente
    try {
      let notificationMessage = `Sua solicitação foi rejeitada: ${booking.service?.name || 'Serviço'}`;
      if (reason) {
        notificationMessage += `. Motivo: ${reason}`;
      }
      if (suggestedDate && suggestedTime) {
        notificationMessage += `. Sugestão de nova data: ${suggestedDate} às ${suggestedTime}`;
      }

      await Notification.create({
        userId: booking.clientId,
        bookingId: booking.id,
        type: 'booking_rejected',
        message: notificationMessage
      });
    } catch (notificationError) {
      console.error('Erro ao criar notificação (continuando mesmo assim):', notificationError);
      // Não falhar a operação se a notificação falhar
    }

    // Buscar booking atualizado
    let updatedBooking;
    let bookingData;
    
    try {
      updatedBooking = await Booking.findByPk(id, {
        include: [
          { model: Service, as: 'service', include: [{ model: User, as: 'provider' }] },
          { model: ServiceVariation, as: 'variation' },
          { model: User, as: 'client' }
        ]
      });
      
      if (!updatedBooking) {
        console.error('Booking não encontrado após atualização, ID:', id);
        // Tentar buscar sem relacionamentos
        updatedBooking = await Booking.findByPk(id);
      }
      
      if (!updatedBooking) {
        return res.status(500).json({ 
          error: 'Erro ao buscar contratação atualizada após rejeição' 
        });
      }

      // Converter para objeto plano para evitar problemas de serialização
      try {
        bookingData = updatedBooking.get({ plain: true });
      } catch (serializeError) {
        console.error('Erro ao serializar booking:', serializeError);
        // Se falhar, usar toJSON como fallback
        bookingData = updatedBooking.toJSON ? updatedBooking.toJSON() : {
          id: updatedBooking.id,
          status: updatedBooking.status,
          rejectionReason: updatedBooking.rejectionReason,
          suggestedDate: updatedBooking.suggestedDate,
          suggestedTime: updatedBooking.suggestedTime
        };
      }
    } catch (findError) {
      console.error('Erro ao buscar booking atualizado:', findError);
      // Se falhar completamente, retornar dados básicos do booking original
      bookingData = {
        id: booking.id,
        status: 'rejected',
        rejectionReason: reason || null,
        suggestedDate: suggestedDate || null,
        suggestedTime: suggestedTime || null,
        clientId: booking.clientId,
        providerId: booking.providerId
      };
    }

    // Emitir evento via WebSocket (não bloquear se falhar)
    try {
      if (updatedBooking) {
        publishToRedis('booking-updated', {
          bookingId: updatedBooking.id || booking.id,
          status: 'rejected',
          clientId: booking.clientId,
          providerId: booking.providerId,
          booking: bookingData
        });
      }
    } catch (redisError) {
      console.error('Erro ao publicar evento Redis (continuando mesmo assim):', redisError);
    }

    res.json({ 
      message: 'Contratação rejeitada com sucesso', 
      booking: bookingData 
    });
  } catch (error) {
    console.error('Erro ao rejeitar contratação:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ 
      error: 'Erro ao rejeitar contratação',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await Booking.findByPk(id, {
      include: [{ model: Service, as: 'service' }]
    });

    if (!booking) {
      return res.status(404).json({ error: 'Contratação não encontrada' });
    }

    // Verificar permissão
    if (req.user.role === 'client' && booking.clientId !== req.user.id) {
      return res.status(403).json({ error: 'Você não tem permissão para cancelar esta contratação' });
    }
    if (req.user.role === 'provider' && booking.providerId !== req.user.id) {
      return res.status(403).json({ error: 'Você não tem permissão para cancelar esta contratação' });
    }

    if (booking.status === 'cancelled' || booking.status === 'rejected') {
      return res.status(400).json({ error: 'Contratação já está cancelada ou rejeitada' });
    }

    // Não permitir cancelar se já foi completada
    if (booking.status === 'completed') {
      return res.status(400).json({ error: 'Não é possível cancelar uma contratação já completada' });
    }

    await booking.update({ status: 'cancelled' });

    // Criar notificação
    const notifyUserId = req.user.role === 'client' ? booking.providerId : booking.clientId;
    await Notification.create({
      userId: notifyUserId,
      bookingId: booking.id,
      type: 'booking_cancelled',
      message: `Contratação cancelada: ${booking.service.name} em ${booking.scheduledDate}`
    });

    // Invalidar cache
    await RedisService.invalidateCache(`availability:provider:${booking.providerId}`);

    // Buscar booking atualizado com relacionamentos
    const updatedBooking = await Booking.findByPk(booking.id, {
      include: [
        { model: Service, as: 'service', include: [{ model: User, as: 'provider' }] },
        { model: ServiceVariation, as: 'variation' },
        { model: User, as: 'client' }
      ]
    });

    // Converter para objeto plano para evitar problemas de serialização
    const bookingData = updatedBooking ? updatedBooking.get({ plain: true }) : null;

    // Emitir evento via WebSocket
    publishToRedis('booking-cancelled', {
      bookingId: booking.id,
      status: 'cancelled',
      clientId: booking.clientId,
      providerId: booking.providerId,
      booking: bookingData
    });

    res.json({ message: 'Contratação cancelada com sucesso', booking: bookingData });
  } catch (error) {
    console.error('Erro ao cancelar contratação:', error);
    res.status(500).json({ error: 'Erro ao cancelar contratação' });
  }
};

// Aceitar sugestão de nova data/horário
export const acceptSuggestion = async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await Booking.findByPk(id, {
      include: [
        { model: Service, as: 'service' },
        { model: ServiceVariation, as: 'variation' }
      ]
    });

    if (!booking) {
      return res.status(404).json({ error: 'Contratação não encontrada' });
    }

    if (booking.clientId !== req.user.id) {
      return res.status(403).json({ error: 'Você não tem permissão para aceitar esta sugestão' });
    }

    if (booking.status !== 'rejected') {
      return res.status(400).json({ error: 'Esta contratação não foi rejeitada ou não possui sugestão' });
    }

    if (!booking.suggestedDate || !booking.suggestedTime) {
      return res.status(400).json({ error: 'Esta contratação não possui sugestão de nova data/horário' });
    }

    // Verificar se já existe uma contratação alternativa criada
    if (booking.alternativeBookingId) {
      const alternative = await Booking.findByPk(booking.alternativeBookingId);
      if (alternative && alternative.status === 'pending') {
        return res.status(400).json({ 
          error: 'Você já aceitou esta sugestão. Verifique suas contratações pendentes.' 
        });
      }
    }

    // Criar nova contratação com a data/horário sugeridos
    const newBooking = await Booking.create({
      clientId: booking.clientId,
      providerId: booking.providerId,
      serviceId: booking.serviceId,
      serviceVariationId: booking.serviceVariationId,
      scheduledDate: booking.suggestedDate,
      scheduledTime: booking.suggestedTime,
      endDate: booking.endDate,
      endTime: booking.endTime,
      status: 'pending',
      totalPrice: booking.totalPrice
    });

    // Atualizar booking original com referência à nova contratação
    await booking.update({ alternativeBookingId: newBooking.id });

    // Criar notificação para o prestador
    await Notification.create({
      userId: booking.providerId,
      bookingId: newBooking.id,
      type: 'new_booking',
      message: `Cliente aceitou sua sugestão e criou nova solicitação: ${booking.service.name} em ${booking.suggestedDate} às ${booking.suggestedTime}`
    });

    // Invalidar cache
    await RedisService.invalidateCache(`availability:provider:${booking.providerId}`);

    const bookingWithRelations = await Booking.findByPk(newBooking.id, {
      include: [
        { model: Service, as: 'service', include: [{ model: User, as: 'provider' }] },
        { model: ServiceVariation, as: 'variation' },
        { model: User, as: 'client' }
      ]
    });

    res.json({ 
      message: 'Sugestão aceita! Nova contratação criada e aguardando aprovação do prestador.',
      booking: bookingWithRelations
    });
  } catch (error) {
    console.error('Erro ao aceitar sugestão:', error);
    res.status(500).json({ error: 'Erro ao aceitar sugestão' });
  }
};

// Rejeitar sugestão de nova data/horário
export const rejectSuggestion = async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await Booking.findByPk(id);

    if (!booking) {
      return res.status(404).json({ error: 'Contratação não encontrada' });
    }

    if (booking.clientId !== req.user.id) {
      return res.status(403).json({ error: 'Você não tem permissão para rejeitar esta sugestão' });
    }

    if (booking.status !== 'rejected') {
      return res.status(400).json({ error: 'Esta contratação não foi rejeitada' });
    }

    // Criar notificação para o prestador informando que o cliente rejeitou a sugestão
    await Notification.create({
      userId: booking.providerId,
      bookingId: booking.id,
      type: 'booking_updated',
      message: `Cliente rejeitou sua sugestão de nova data para: ${booking.service?.name || 'Serviço'}`
    });

    res.json({ message: 'Sugestão rejeitada. O prestador foi notificado.' });
  } catch (error) {
    console.error('Erro ao rejeitar sugestão:', error);
    res.status(500).json({ error: 'Erro ao rejeitar sugestão' });
  }
};

