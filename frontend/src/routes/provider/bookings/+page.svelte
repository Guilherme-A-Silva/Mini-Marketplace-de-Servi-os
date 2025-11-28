<script>
  import { onMount, onDestroy } from 'svelte';
  import api from '$lib/api';
  import { initSocket, getSocket, disconnectSocket } from '$lib/socket.js';
  import { authStore } from '$lib/stores/auth';
  import { notificationStore } from '$lib/stores/notifications';
  import { shouldShowNotification } from '$lib/utils/notificationDeduplicator.js';

  let bookings = [];
  let loading = true;
  let filterStatus = 'all'; // all, pending, confirmed, cancelled
  let pollingInterval = null;
  let lastUpdate = null;

  let user = null;
  let socketInstance = null;
  let socketListenersRegistered = false;

  onMount(async () => {
    // Obter usuário do authStore
    authStore.subscribe((state) => {
      user = state.user;
      // Garantir que está na sala quando o usuário mudar
      if (socketInstance && state.user?.id) {
        socketInstance.emit('join-user-room', state.user.id);
      }
    });

    await loadBookings();
    
    // Inicializar WebSocket
    socketInstance = initSocket();
    
    if (socketInstance) {
      // Garantir que está na sala
      if (user?.id) {
        socketInstance.emit('join-user-room', user.id);
      }
      
      // Escutar eventos de atualização (apenas uma vez)
      if (!socketListenersRegistered) {
        socketListenersRegistered = true;
        
        // Remover listeners antigos se existirem
        socketInstance.off('booking-updated');
        socketInstance.off('booking-created');
        socketInstance.off('booking-cancelled');
        socketInstance.off('booking-suggestion-accepted');
        socketInstance.off('booking-suggestion-rejected');
        
        socketInstance.on('booking-updated', (data) => {
          console.log('📢 [Prestador] Evento booking-updated recebido:', data);
          const providerId = data.providerId || data.booking?.providerId;
          const bookingId = data.bookingId || data.booking?.id;
          const status = data.status || data.booking?.status;
          
          // Verificar duplicação usando deduplicador
          if (!shouldShowNotification(bookingId, status, 'booking-updated')) {
            return;
          }
          
          if (providerId === user?.id || String(providerId) === String(user?.id)) {
            console.log('🔄 Atualizando lista de bookings...');
            loadBookings(true);
            // Notificar sobre mudanças de status
            const serviceName = data.booking?.service?.name || data.booking?.Service?.name || 'Serviço';
            console.log('Status recebido:', status, 'Service name:', serviceName);
            
            if (status === 'confirmed') {
              notificationStore.info(`Contratação "${serviceName}" foi confirmada.`);
            }
            // Não mostrar notificação para 'rejected' - o prestador já vê a confirmação ao clicar em rejeitar
          }
        });

        socketInstance.on('booking-created', (data) => {
          console.log('📢 [Prestador] Evento booking-created recebido:', data);
          const providerId = data.providerId || data.booking?.providerId;
          const bookingId = data.bookingId || data.booking?.id;
          
          // Verificar duplicação
          if (!shouldShowNotification(bookingId, 'pending', 'booking-created')) {
            return;
          }
          
          if (providerId === user?.id || String(providerId) === String(user?.id)) {
            console.log('🔄 Nova contratação recebida, atualizando lista...');
            loadBookings(true);
            const serviceName = data.booking?.service?.name || data.booking?.Service?.name || 'Serviço';
            notificationStore.info(`Nova contratação recebida: "${serviceName}"`);
          }
        });

        socketInstance.on('booking-cancelled', (data) => {
          console.log('📢 [Prestador] Evento booking-cancelled recebido:', data);
          const providerId = data.providerId || data.booking?.providerId;
          const bookingId = data.bookingId || data.booking?.id;
          
          // Verificar duplicação
          if (!shouldShowNotification(bookingId, 'cancelled', 'booking-cancelled')) {
            return;
          }
          
          if (providerId === user?.id || String(providerId) === String(user?.id)) {
            console.log('🔄 Contratação cancelada, atualizando lista...');
            loadBookings(true);
            const serviceName = data.booking?.service?.name || data.booking?.Service?.name || 'Serviço';
            notificationStore.warning(`Contratação "${serviceName}" foi cancelada.`);
          }
        });

        socketInstance.on('booking-suggestion-accepted', (data) => {
          console.log('📢 [Prestador] Evento booking-suggestion-accepted recebido:', data);
          if (data.providerId === user?.id) {
            loadBookings(true);
            notificationStore.success(`O cliente aceitou sua sugestão de nova data para "${data.booking?.service?.name || 'Serviço'}"!`);
          }
        });

        socketInstance.on('booking-suggestion-rejected', (data) => {
          console.log('📢 [Prestador] Evento booking-suggestion-rejected recebido:', data);
          if (data.providerId === user?.id) {
            loadBookings(true);
            notificationStore.info(`O cliente rejeitou sua sugestão de nova data para "${data.booking?.service?.name || 'Serviço'}".`);
          }
        });
      }
    }
  });

  onDestroy(() => {
    stopPolling();
    // Remover listeners do socket para evitar duplicação
    if (socketInstance) {
      socketInstance.off('booking-updated');
      socketInstance.off('booking-created');
      socketInstance.off('booking-cancelled');
      socketInstance.off('booking-suggestion-accepted');
      socketInstance.off('booking-suggestion-rejected');
      socketListenersRegistered = false;
    }
  });

  function startPolling() {
    // Atualizar a cada 5 segundos
    pollingInterval = setInterval(async () => {
      await loadBookings(true); // true = atualização silenciosa
    }, 5000);
  }

  function stopPolling() {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
  }

  $: filteredBookings = (() => {
    if (filterStatus === 'all') {
      return bookings;
    }
    return bookings.filter(b => String(b.status) === filterStatus);
  })();

  $: pendingCount = bookings.filter(b => String(b.status) === 'pending').length;

  async function loadBookings(silent = false) {
    try {
      const response = await api.get('/bookings');
      const newBookings = response.data.bookings || [];
      
      // Sempre atualizar a lista
      bookings = newBookings;
      lastUpdate = new Date();
    } catch (error) {
      console.error('Erro ao carregar contratações:', error);
    } finally {
      loading = false;
    }
  }

  async function approveBooking(id) {
    if (!confirm('Tem certeza que deseja aprovar esta contratação?')) {
      return;
    }

    try {
      await api.put(`/bookings/${id}/approve`);
      // Recarregar imediatamente
      await loadBookings(false);
      notificationStore.success('Contratação aprovada com sucesso!');
      // Recarregar novamente após 1 segundo para garantir sincronização
      setTimeout(() => loadBookings(false), 1000);
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Erro ao aprovar contratação';
      notificationStore.error(errorMsg);
    }
  }

  let showRejectModal = false;
  let rejectBookingId = null;
  let rejectReason = '';
  let suggestedDate = '';
  let suggestedTime = '';

  function openRejectModal(id) {
    rejectBookingId = id;
    rejectReason = '';
    suggestedDate = '';
    suggestedTime = '';
    showRejectModal = true;
  }

  function closeRejectModal() {
    showRejectModal = false;
    rejectBookingId = null;
    rejectReason = '';
    suggestedDate = '';
    suggestedTime = '';
  }

  async function confirmReject() {
    if (!rejectBookingId) return;

    try {
      const data = {};
      if (rejectReason.trim()) {
        data.reason = rejectReason.trim();
      }
      if (suggestedDate && suggestedTime) {
        data.suggestedDate = suggestedDate;
        data.suggestedTime = suggestedTime;
      }

      await api.put(`/bookings/${rejectBookingId}/reject`, data);
      closeRejectModal();
      // Recarregar imediatamente
      await loadBookings(false);
      notificationStore.success('Contratação rejeitada com sucesso!');
      // Recarregar novamente após 1 segundo para garantir sincronização
      setTimeout(() => loadBookings(false), 1000);
    } catch (error) {
      notificationStore.error(error.response?.data?.error || 'Erro ao rejeitar contratação');
    }
  }

  async function cancelBooking(id) {
    if (!confirm('Tem certeza que deseja cancelar esta contratação?')) {
      return;
    }

    try {
      await api.put(`/bookings/${id}/cancel`);
      // Recarregar imediatamente
      await loadBookings(false);
      notificationStore.success('Contratação cancelada com sucesso!');
      // Recarregar novamente após 1 segundo para garantir sincronização
      setTimeout(() => loadBookings(false), 1000);
    } catch (error) {
      notificationStore.error(error.response?.data?.error || 'Erro ao cancelar contratação');
    }
  }

  function getStatusColor(status) {
    const colors = {
      confirmed: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      cancelled: 'bg-red-100 text-red-800',
      completed: 'bg-blue-100 text-blue-800',
      rejected: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  }

  function getStatusLabel(status) {
    const labels = {
      confirmed: 'Confirmada',
      pending: 'Pendente',
      cancelled: 'Cancelada',
      completed: 'Concluída',
      rejected: 'Rejeitada'
    };
    return labels[status] || status;
  }
</script>

<svelte:head>
  <title>Contratações - Marketplace</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-2 md:px-4">
  <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 md:mb-8">
    <div class="flex items-center gap-3">
      <h1 class="text-2xl md:text-3xl font-bold text-gray-900">
      Minhas Contratações
      {#if pendingCount > 0}
        <span class="ml-2 px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm">
          {pendingCount} pendente{pendingCount > 1 ? 's' : ''}
        </span>
      {/if}
      </h1>
      {#if lastUpdate}
        <span class="text-xs text-gray-500" title="Última atualização: {lastUpdate.toLocaleTimeString('pt-BR')}">
          🔄 Atualizando automaticamente
        </span>
      {/if}
    </div>
    <div class="flex gap-2">
      <button
        on:click={() => filterStatus = 'all'}
        class="px-3 py-1 rounded {filterStatus === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'} text-sm"
      >
        Todas
      </button>
      <button
        on:click={() => filterStatus = 'pending'}
        class="px-3 py-1 rounded {filterStatus === 'pending' ? 'bg-yellow-600 text-white' : 'bg-gray-200 text-gray-700'} text-sm"
      >
        Pendentes
      </button>
      <button
        on:click={() => filterStatus = 'confirmed'}
        class="px-3 py-1 rounded {filterStatus === 'confirmed' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'} text-sm"
      >
        Confirmadas
      </button>
    </div>
  </div>

  {#if loading}
    <div class="text-center py-12">
      <p class="text-gray-600">Carregando contratações...</p>
    </div>
  {:else if filteredBookings.length === 0}
    <div class="text-center py-12 bg-white rounded-lg shadow-md">
      <p class="text-gray-600">
        {filterStatus === 'all' ? 'Nenhuma contratação encontrada.' : `Nenhuma contratação ${filterStatus === 'pending' ? 'pendente' : filterStatus === 'confirmed' ? 'confirmada' : 'cancelada'} encontrada.`}
      </p>
    </div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
      {#each filteredBookings as booking}
        <div class="bg-white rounded-lg shadow-md p-4 md:p-6 {String(booking.status) === 'pending' ? 'border-l-4 border-yellow-500' : ''}">
          <!-- Cabeçalho do Card -->
          <div class="flex justify-between items-start mb-3">
            <h3 class="text-lg md:text-xl font-semibold text-gray-900 flex-1">
              {booking.service?.name}
            </h3>
            <span class="px-2 py-1 text-xs font-semibold rounded-full {getStatusColor(String(booking.status))} ml-2">
              {getStatusLabel(String(booking.status))}
            </span>
          </div>

          <!-- Informações do Cliente -->
          <div class="mb-3 pb-3 border-b border-gray-200">
            <p class="text-sm font-medium text-gray-700 mb-1">Cliente:</p>
            <p class="text-sm text-gray-900">{booking.client?.name}</p>
            {#if booking.client?.phone}
              <p class="text-xs text-gray-500">{booking.client.phone}</p>
            {/if}
          </div>

          <!-- Informações do Serviço -->
          <div class="mb-3 pb-3 border-b border-gray-200 space-y-2">
            <div>
              <p class="text-xs text-gray-500">Variação:</p>
              <p class="text-sm text-gray-900">{booking.variation?.name}</p>
            </div>
            <div>
              <p class="text-xs text-gray-500">Data e Horário:</p>
              <p class="text-sm text-gray-900">
                {new Date(booking.scheduledDate).toLocaleDateString('pt-BR')} às {booking.scheduledTime}
              </p>
            </div>
            {#if booking.endDate && booking.endTime}
              <div>
                <p class="text-xs text-gray-500">Até:</p>
                <p class="text-sm text-gray-900">
                  {new Date(booking.endDate).toLocaleDateString('pt-BR')} às {booking.endTime}
                </p>
              </div>
            {/if}
          </div>

          <!-- Valor -->
          <div class="mb-4">
            <p class="text-lg md:text-xl font-bold text-blue-600">
              R$ {parseFloat(booking.totalPrice).toFixed(2).replace('.', ',')}
            </p>
          </div>

          <!-- Ações -->
          <div class="flex flex-col gap-2">
            {#if String(booking.status) === 'pending'}
              <button
                on:click={() => approveBooking(booking.id)}
                class="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium text-sm"
              >
                ✓ Aprovar
              </button>
              <button
                on:click={() => openRejectModal(booking.id)}
                class="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium text-sm"
              >
                ✗ Rejeitar
              </button>
            {:else if String(booking.status) === 'confirmed'}
              <button
                on:click={() => cancelBooking(booking.id)}
                class="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium text-sm"
              >
                Cancelar
              </button>
            {:else if String(booking.status) === 'rejected' || String(booking.status) === 'cancelled'}
              <p class="text-xs text-gray-500 italic text-center py-2">Sem ações disponíveis</p>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Modal de Rejeição -->
  {#if showRejectModal}
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 class="text-xl font-bold mb-4">Rejeitar Contratação</h2>
        
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Motivo da rejeição (opcional)
          </label>
          <textarea
            bind:value={rejectReason}
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows="3"
            placeholder="Ex: Horário não disponível, conflito na agenda..."
          ></textarea>
        </div>

        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Sugerir nova data (opcional)
          </label>
          <input
            type="date"
            bind:value={suggestedDate}
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
          />
        </div>

        <div class="mb-6">
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Sugerir novo horário (opcional)
          </label>
          <input
            type="time"
            bind:value={suggestedTime}
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div class="flex gap-3 justify-end">
          <button
            on:click={closeRejectModal}
            class="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            Cancelar
          </button>
          <button
            on:click={confirmReject}
            class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Rejeitar
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

