import { writable } from 'svelte/store';

function createNotificationStore() {
  const { subscribe, update } = writable([]);

  const add = (message, type = 'info', duration = 5000) => {
    const id = Date.now() + Math.random();
    const notification = { id, message, type, duration };
    
    update(notifications => [...notifications, notification]);
    
    // Remover automaticamente após a duração
    if (duration > 0) {
      setTimeout(() => {
        remove(id);
      }, duration);
    }
    
    return id;
  };

  const remove = (id) => {
    update(notifications => notifications.filter(n => n.id !== id));
  };

  return {
    subscribe,
    add,
    remove,
    success: (message, duration = 5000) => {
      return add(message, 'success', duration);
    },
    error: (message, duration = 5000) => {
      return add(message, 'error', duration);
    },
    warning: (message, duration = 5000) => {
      return add(message, 'warning', duration);
    },
    info: (message, duration = 5000) => {
      return add(message, 'info', duration);
    }
  };
}

export const notificationStore = createNotificationStore();

