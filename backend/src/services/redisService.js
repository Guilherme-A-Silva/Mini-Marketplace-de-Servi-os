import redis from '../config/redis.js';

export class RedisService {
  static async cacheServiceTypes() {
    try {
      const cacheKey = 'service_types:all';
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
      return null;
    } catch (error) {
      // Redis não disponível - silenciar erro
      return null;
    }
  }

  static async setServiceTypes(types) {
    try {
      const cacheKey = 'service_types:all';
      await redis.setex(cacheKey, 3600, JSON.stringify(types)); // 1 hora
    } catch (error) {
      // Redis não disponível - silenciar erro
    }
  }

  static async cacheSearchResults(query, filters, results) {
    try {
      const cacheKey = `search:${JSON.stringify({ query, filters })}`;
      await redis.setex(cacheKey, 300, JSON.stringify(results)); // 5 minutos
    } catch (error) {
      // Redis não disponível - silenciar erro
    }
  }

  static async getCachedSearch(query, filters) {
    try {
      const cacheKey = `search:${JSON.stringify({ query, filters })}`;
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
      return null;
    } catch (error) {
      // Redis não disponível - silenciar erro
      return null;
    }
  }

  static async cacheAvailabilitySlots(providerId, slots) {
    try {
      const cacheKey = `availability:provider:${providerId}`;
      await redis.setex(cacheKey, 300, JSON.stringify(slots)); // 5 minutos
    } catch (error) {
      // Redis não disponível - silenciar erro
    }
  }

  static async getCachedAvailabilitySlots(providerId) {
    try {
      const cacheKey = `availability:provider:${providerId}`;
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
      return null;
    } catch (error) {
      // Redis não disponível - silenciar erro
      return null;
    }
  }

  static async invalidateCache(pattern) {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      // Redis não disponível - silenciar erro
    }
  }
}

