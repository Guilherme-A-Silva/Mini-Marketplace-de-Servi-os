<script>
  import { onMount } from 'svelte';
  import api from '$lib/api';
  import { authStore } from '$lib/stores/auth';
  import { goto } from '$app/navigation';

  let services = [];
  let bookings = [];
  let unreadNotifications = 0;
  let loading = true;
  let user = null;

  authStore.subscribe((state) => {
    user = state.user;
  });

  onMount(async () => {
    await Promise.all([loadServices(), loadBookings(), loadUnreadCount()]);
    loading = false;
  });

  async function loadServices() {
    try {
      const response = await api.get('/services');
      // Filtrar apenas serviços do prestador logado
      services = response.data.services.filter(s => s.providerId === user?.id);
    } catch (error) {
      console.error('Erro ao carregar serviços:', error);
    }
  }

  async function loadBookings() {
    try {
      const response = await api.get('/bookings');
      bookings = response.data.bookings.slice(0, 5); // Últimas 5
    } catch (error) {
      console.error('Erro ao carregar contratações:', error);
    }
  }

  async function loadUnreadCount() {
    try {
      const response = await api.get('/notifications/unread-count');
      unreadNotifications = response.data.count;
    } catch (error) {
      console.error('Erro ao carregar notificações:', error);
    }
  }

  function formatBookingDate(dateString) {
    if (!dateString) return '';
    // Se já está no formato YYYY-MM-DD, usar diretamente para evitar conversão de timezone
    if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateString)) {
      const [year, month, day] = dateString.split('T')[0].split('-');
      return `${day}/${month}/${year}`;
    }
    // Caso contrário, converter
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  }
</script>

<svelte:head>
  <title>Painel do Prestador - Marketplace</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-2 md:px-4">
  <h1 class="text-2xl md:text-3xl font-bold text-gray-900 mb-6 md:mb-8">Painel do Prestador</h1>

  <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
    <div class="bg-white rounded-lg shadow-md p-6">
      <h3 class="text-lg font-semibold text-gray-700 mb-2">Meus Serviços</h3>
      <p class="text-3xl font-bold text-blue-600">{services.length}</p>
    </div>
    <div class="bg-white rounded-lg shadow-md p-6">
      <h3 class="text-lg font-semibold text-gray-700 mb-2">Contratações</h3>
      <p class="text-3xl font-bold text-green-600">{bookings.length}</p>
    </div>
    <div class="bg-white rounded-lg shadow-md p-6">
      <h3 class="text-lg font-semibold text-gray-700 mb-2">Notificações</h3>
      <p class="text-3xl font-bold text-yellow-600">{unreadNotifications}</p>
    </div>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
    <div class="bg-white rounded-lg shadow-md p-6">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-semibold">Meus Serviços</h2>
        <a
          href="/provider/services/new"
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Novo Serviço
        </a>
      </div>
      {#if services.length === 0}
        <p class="text-gray-600">Você ainda não tem serviços cadastrados.</p>
      {:else}
        <div class="space-y-4">
          {#each services.slice(0, 5) as service}
            <div class="border-b pb-4">
              <h3 class="font-semibold">{service.name}</h3>
              <p class="text-sm text-gray-600">{service.variations?.length || 0} variações</p>
              <a
                href="/provider/services/{service.id}"
                class="text-blue-600 hover:underline text-sm"
              >
                Ver detalhes →
              </a>
            </div>
          {/each}
        </div>
        <a href="/provider/services" class="block mt-4 text-blue-600 hover:underline">
          Ver todos os serviços →
        </a>
      {/if}
    </div>

    <div class="bg-white rounded-lg shadow-md p-6">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-semibold">Últimas Contratações</h2>
        <a href="/provider/bookings" class="text-blue-600 hover:underline text-sm">
          Ver todas →
        </a>
      </div>
      {#if bookings.length === 0}
        <p class="text-gray-600">Nenhuma contratação ainda.</p>
      {:else}
        <div class="space-y-4">
          {#each bookings as booking}
            <div class="border-b pb-4">
              <h3 class="font-semibold">{booking.service?.name}</h3>
              <p class="text-sm text-gray-600">
                Cliente: {booking.client?.name}
              </p>
              <p class="text-sm text-gray-600">
                {formatBookingDate(booking.scheduledDate)} às {booking.scheduledTime}
              </p>
              <span class="inline-block mt-2 px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                {booking.status}
              </span>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <div class="mt-6">
    <a
      href="/provider/availability"
      class="inline-block px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
    >
      Gerenciar Disponibilidades
    </a>
  </div>
</div>

