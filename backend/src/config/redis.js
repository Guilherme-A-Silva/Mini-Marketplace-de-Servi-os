import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

let redisConnected = false;
let errorLogged = false;

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  retryStrategy: (times) => {
    // Limitar tentativas de reconexão
    if (times > 3) {
      if (!errorLogged) {
        console.log('⚠️  Redis não disponível - cache desabilitado (opcional)');
        errorLogged = true;
      }
      return null; // Para de tentar reconectar
    }
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false
});

redis.on('connect', () => {
  if (!redisConnected) {
    console.log('✅ Redis conectado');
    redisConnected = true;
    errorLogged = false;
  }
});

redis.on('error', (err) => {
  // Só loga o erro uma vez
  if (!errorLogged && !redisConnected) {
    console.log('⚠️  Redis não disponível - cache desabilitado (opcional)');
    errorLogged = true;
  }
});

redis.on('close', () => {
  redisConnected = false;
});

export function getRedisClient() {
  return redis;
}

export function isRedisAvailable() {
  return redisConnected;
}

export default redis;

