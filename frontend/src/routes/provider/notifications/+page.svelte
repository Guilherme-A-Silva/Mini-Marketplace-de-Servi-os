<script>
  import { onMount } from 'svelte';
  import api from '$lib/api';

  let notifications = [];
  let loading = true;

  onMount(async () => {
    await loadNotifications();
  });

  async function loadNotifications() {
    try {
      const response = await api.get('/notifications');
      notifications = response.data.notifications;
    } catch (error) {
      console.error('Erro ao carregar notificações:', error);
    } finally {
      loading = false;
    }
  }

  async function markAsRead(id) {
    try {
      await api.put(`/notifications/${id}/read`);
      await loadNotifications();
    } catch (error) {
      console.error('Erro ao marcar como lida:', error);
    }
  }
</script>

<svelte:head>
  <title>Notificações - Marketplace</title>
</svelte:head>

<div class="max-w-4xl mx-auto px-2 md:px-4">
  <h1 class="text-2xl md:text-3xl font-bold text-gray-900 mb-6 md:mb-8">Notificações</h1>

  {#if loading}
    <div class="text-center py-12">
      <p class="text-gray-600">Carregando notificações...</p>
    </div>
  {:else if notifications.length === 0}
    <div class="text-center py-12 bg-white rounded-lg shadow-md">
      <p class="text-gray-600">Nenhuma notificação.</p>
    </div>
  {:else}
    <div class="space-y-4">
      {#each notifications as notification}
        <div
          class="bg-white rounded-lg shadow-md p-6 {notification.isRead ? 'opacity-75' : 'border-l-4 border-blue-500'}"
        >
          <div class="flex justify-between items-start">
            <div class="flex-1">
              <p class="font-semibold text-gray-900">{notification.message}</p>
              <p class="text-sm text-gray-500 mt-1">
                {new Date(notification.createdAt).toLocaleString('pt-BR')}
              </p>
            </div>
            {#if !notification.isRead}
              <button
                on:click={() => markAsRead(notification.id)}
                class="ml-4 px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                Marcar como lida
              </button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

