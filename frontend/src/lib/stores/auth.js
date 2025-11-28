import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const createAuthStore = () => {
  const { subscribe, set, update } = writable({
    user: null,
    token: null,
    isAuthenticated: false
  });

  if (browser) {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    if (storedToken && storedUser) {
      set({
        user: JSON.parse(storedUser),
        token: storedToken,
        isAuthenticated: true
      });
    }
  }

  return {
    subscribe,
    login: (user, token) => {
      if (browser) {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
      }
      set({
        user,
        token,
        isAuthenticated: true
      });
    },
    logout: () => {
      if (browser) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
      set({
        user: null,
        token: null,
        isAuthenticated: false
      });
    },
    updateUser: (user) => {
      if (browser) {
        localStorage.setItem('user', JSON.stringify(user));
      }
      update((state) => ({
        ...state,
        user
      }));
    }
  };
};

export const authStore = createAuthStore();

