import { io } from 'socket.io-client';
import { get } from 'svelte/store';
import { authStore } from './stores/auth';

let socket = null;
let isConnected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

export function initSocket() {
  // Se já existe e está conectado, retornar
  if (socket && socket.connected) {
    return socket;
  }

  const token = localStorage.getItem('token');
  if (!token) {
    console.warn('⚠️ Token não encontrado - WebSocket não será conectado');
    return null;
  }

  // Extrair apenas o host e porta da URL da API
  let API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  
  // Remover /api se existir, pois o Socket.IO não usa esse path
  API_URL = API_URL.replace(/\/api\/?$/, '');
  
  // Se já existe mas não está conectado, desconectar primeiro
  if (socket) {
    socket.disconnect();
  }
  
  console.log('🔌 Iniciando conexão WebSocket para:', API_URL);
  socket = io(API_URL, {
    auth: {
      token: token
    },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
    path: '/socket.io/' // Path padrão do Socket.IO
  });

  socket.on('connect', () => {
    console.log('✅ WebSocket conectado:', socket.id);
    isConnected = true;
    reconnectAttempts = 0;
    
    // Entrar na sala do usuário
    const state = get(authStore);
    if (state.user?.id) {
      socket.emit('join-user-room', state.user.id);
      console.log(`👤 Entrando na sala do usuário: ${state.user.id}`);
    }
  });

  socket.on('disconnect', (reason) => {
    console.log('❌ WebSocket desconectado:', reason);
    isConnected = false;
    
    // Tentar reconectar se não foi desconexão manual
    if (reason === 'io server disconnect') {
      // Servidor desconectou, reconectar manualmente
      socket.connect();
    }
  });

  socket.on('connect_error', (error) => {
    reconnectAttempts++;
    console.error('❌ Erro na conexão WebSocket:', error.message);
    isConnected = false;
    
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error('❌ Máximo de tentativas de reconexão atingido');
    }
  });

  socket.on('reconnect', (attemptNumber) => {
    console.log(`✅ WebSocket reconectado após ${attemptNumber} tentativas`);
    isConnected = true;
    reconnectAttempts = 0;
    
    // Reentrar na sala
    const state = get(authStore);
    if (state.user?.id) {
      socket.emit('join-user-room', state.user.id);
    }
  });

  // Escutar mudanças no authStore para atualizar a sala
  authStore.subscribe((state) => {
    if (socket && socket.connected && state.user?.id) {
      socket.emit('join-user-room', state.user.id);
    }
  });

  return socket;
}

export function getSocket() {
  if (!socket) {
    return initSocket();
  }
  
  // Se não está conectado, tentar reconectar
  if (!socket.connected) {
    console.log('🔄 Socket desconectado, tentando reconectar...');
    socket.connect();
  }
  
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    console.log('🔌 Desconectando WebSocket...');
    socket.disconnect();
    socket = null;
    isConnected = false;
  }
}

// Função para garantir que o socket está na sala do usuário
export function ensureUserRoom(userId) {
  const sock = getSocket();
  if (sock && sock.connected && userId) {
    sock.emit('join-user-room', userId);
  }
}

