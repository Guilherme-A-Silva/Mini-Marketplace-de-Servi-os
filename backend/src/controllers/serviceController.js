import { Service, ServiceVariation, ServiceType, User } from '../models/index.js';
import { ElasticsearchService } from '../services/elasticsearchService.js';
import { RedisService } from '../services/redisService.js';
import { validationResult } from 'express-validator';

export const getServices = async (req, res) => {
  try {
    const { search, serviceTypeId, limit = 50, offset = 0 } = req.query;
    
    let serviceIds = null;

    // Se houver busca, usar Elasticsearch
    if (search) {
      const cached = await RedisService.getCachedSearch(search, { serviceTypeId });
      if (cached) {
        serviceIds = cached.map(item => item.id);
      } else {
        const results = await ElasticsearchService.searchServices(search, {
          serviceTypeId: serviceTypeId ? parseInt(serviceTypeId) : undefined,
          limit: parseInt(limit),
          offset: parseInt(offset)
        });
        serviceIds = results.map(item => item.id);
        await RedisService.cacheSearchResults(search, { serviceTypeId }, results);
      }
    }

    const where = {};
    if (serviceTypeId) {
      where.serviceTypeId = parseInt(serviceTypeId);
    }
    if (serviceIds) {
      where.id = serviceIds.length > 0 ? serviceIds : [-1]; // Se não encontrar nada, retorna vazio
    }

    const services = await Service.findAll({
      where,
      include: [
        {
          model: ServiceType,
          as: 'serviceType',
          attributes: ['id', 'name']
        },
        {
          model: User,
          as: 'provider',
          attributes: ['id', 'name', 'city', 'neighborhood']
        },
        {
          model: ServiceVariation,
          as: 'variations',
          attributes: ['id', 'name', 'price', 'durationMinutes']
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    res.json({ services });
  } catch (error) {
    console.error('Erro ao buscar serviços:', error);
    res.status(500).json({ error: 'Erro ao buscar serviços' });
  }
};

export const getServiceById = async (req, res) => {
  try {
    const { id } = req.params;

    const service = await Service.findByPk(id, {
      include: [
        {
          model: ServiceType,
          as: 'serviceType',
          attributes: ['id', 'name', 'description']
        },
        {
          model: User,
          as: 'provider',
          attributes: ['id', 'name', 'email', 'phone', 'city', 'neighborhood']
        },
        {
          model: ServiceVariation,
          as: 'variations',
          attributes: ['id', 'name', 'price', 'durationMinutes']
        }
      ]
    });

    if (!service) {
      return res.status(404).json({ error: 'Serviço não encontrado' });
    }

    res.json({ service });
  } catch (error) {
    console.error('Erro ao buscar serviço:', error);
    res.status(500).json({ error: 'Erro ao buscar serviço' });
  }
};

export const createService = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, photos, serviceTypeId, variations } = req.body;

    const service = await Service.create({
      name,
      description,
      photos: photos || [],
      serviceTypeId: parseInt(serviceTypeId),
      providerId: req.user.id
    });

    // Criar variações
    if (variations && variations.length > 0) {
      await Promise.all(
        variations.map(variation =>
          ServiceVariation.create({
            name: variation.name,
            price: parseFloat(variation.price),
            durationMinutes: parseInt(variation.durationMinutes),
            serviceId: service.id
          })
        )
      );
    }

    // Indexar no Elasticsearch
    await ElasticsearchService.indexService(service);

    // Invalidar cache
    await RedisService.invalidateCache('search:*');
    await RedisService.invalidateCache('service_types:*');

    const serviceWithRelations = await Service.findByPk(service.id, {
      include: [
        { model: ServiceType, as: 'serviceType' },
        { model: ServiceVariation, as: 'variations' }
      ]
    });

    res.status(201).json({ service: serviceWithRelations });
  } catch (error) {
    console.error('Erro ao criar serviço:', error);
    res.status(500).json({ error: 'Erro ao criar serviço' });
  }
};

export const updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, photos, serviceTypeId, variations } = req.body;

    const service = await Service.findByPk(id);
    if (!service) {
      return res.status(404).json({ error: 'Serviço não encontrado' });
    }

    if (service.providerId !== req.user.id) {
      return res.status(403).json({ error: 'Você não tem permissão para editar este serviço' });
    }

    await service.update({
      name,
      description,
      photos: photos || service.photos,
      serviceTypeId: serviceTypeId ? parseInt(serviceTypeId) : service.serviceTypeId
    });

    // Atualizar variações se fornecidas
    if (variations) {
      // Deletar variações antigas
      await ServiceVariation.destroy({ where: { serviceId: service.id } });
      
      // Criar novas variações
      if (variations.length > 0) {
        await Promise.all(
          variations.map(variation =>
            ServiceVariation.create({
              name: variation.name,
              price: parseFloat(variation.price),
              durationMinutes: parseInt(variation.durationMinutes),
              serviceId: service.id
            })
          )
        );
      }
    }

    // Atualizar no Elasticsearch
    await ElasticsearchService.updateService(service);

    // Invalidar cache
    await RedisService.invalidateCache('search:*');

    const updatedService = await Service.findByPk(id, {
      include: [
        { model: ServiceType, as: 'serviceType' },
        { model: ServiceVariation, as: 'variations' }
      ]
    });

    res.json({ service: updatedService });
  } catch (error) {
    console.error('Erro ao atualizar serviço:', error);
    res.status(500).json({ error: 'Erro ao atualizar serviço' });
  }
};

export const deleteService = async (req, res) => {
  try {
    const { id } = req.params;

    const service = await Service.findByPk(id);
    if (!service) {
      return res.status(404).json({ error: 'Serviço não encontrado' });
    }

    if (service.providerId !== req.user.id) {
      return res.status(403).json({ error: 'Você não tem permissão para deletar este serviço' });
    }

    await service.destroy();

    // Remover do Elasticsearch
    await ElasticsearchService.deleteService(id);

    // Invalidar cache
    await RedisService.invalidateCache('search:*');

    res.json({ message: 'Serviço deletado com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar serviço:', error);
    res.status(500).json({ error: 'Erro ao deletar serviço' });
  }
};

