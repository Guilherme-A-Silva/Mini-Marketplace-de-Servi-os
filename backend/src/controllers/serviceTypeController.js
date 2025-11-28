import { ServiceType } from '../models/index.js';
import { RedisService } from '../services/redisService.js';

export const getServiceTypes = async (req, res) => {
  try {
    // Tentar buscar do cache
    const cached = await RedisService.cacheServiceTypes();
    if (cached) {
      return res.json({ serviceTypes: cached });
    }

    const serviceTypes = await ServiceType.findAll({
      order: [['name', 'ASC']]
    });

    // Cachear resultado
    await RedisService.setServiceTypes(serviceTypes);

    res.json({ serviceTypes });
  } catch (error) {
    console.error('Erro ao buscar tipos de serviços:', error);
    res.status(500).json({ error: 'Erro ao buscar tipos de serviços' });
  }
};

