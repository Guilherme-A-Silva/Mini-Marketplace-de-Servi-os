// Sistema de deduplicação de notificações
// Armazena notificações recentes para evitar duplicatas

const notificationCache = new Map();
const CACHE_DURATION = 5000; // 5 segundos

export function shouldShowNotification(bookingId, status, type = 'default') {
  const key = `${bookingId}-${status}-${type}`;
  const now = Date.now();
  
  // Verificar se já mostramos esta notificação recentemente
  const cached = notificationCache.get(key);
  if (cached && (now - cached) < CACHE_DURATION) {
    console.log(`🚫 Notificação duplicada ignorada: ${key}`);
    return false;
  }
  
  // Armazenar timestamp
  notificationCache.set(key, now);
  
  // Limpar cache antigo periodicamente
  if (notificationCache.size > 100) {
    const cutoff = now - CACHE_DURATION;
    for (const [k, v] of notificationCache.entries()) {
      if (v < cutoff) {
        notificationCache.delete(k);
      }
    }
  }
  
  return true;
}

export function clearNotificationCache() {
  notificationCache.clear();
}

