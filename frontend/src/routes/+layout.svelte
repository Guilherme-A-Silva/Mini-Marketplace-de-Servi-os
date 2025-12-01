<script>
  import '../app.css';
  import { onMount, onDestroy } from 'svelte';
  import { authStore } from '$lib/stores/auth';
  import Navbar from '$lib/components/Navbar.svelte';
  import { page } from '$app/stores';
  import { initSocket, disconnectSocket } from '$lib/socket.js';
  import NotificationContainer from '$lib/components/NotificationContainer.svelte';

  let user = null;
  let isAuthenticated = false;

  authStore.subscribe((state) => {
    user = state.user;
    isAuthenticated = state.isAuthenticated;
    
    // Inicializar WebSocket quando usuário fizer login
    if (state.isAuthenticated && state.user?.id) {
      const socket = initSocket();
      if (socket) {
        socket.emit('join-user-room', state.user.id);
      }
    } else if (!state.isAuthenticated) {
      // Desconectar quando fizer logout
      disconnectSocket();
    }
  });

  onMount(() => {
    // Inicializar socket se já estiver autenticado
    if (isAuthenticated && user?.id) {
      const socket = initSocket();
      if (socket) {
        socket.emit('join-user-room', user.id);
      }
    }
  });
</script>

<div class="min-h-screen bg-gray-50">
  <NotificationContainer />
  <Navbar {user} {isAuthenticated} />
  <main class="container mx-auto px-2 md:px-4 py-4 md:py-8 pt-20 md:pt-24">
    <slot />
  </main>
</div>

