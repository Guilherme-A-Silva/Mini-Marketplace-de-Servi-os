<script>
  import { onMount, onDestroy } from 'svelte';
  import api from '$lib/api';
  import { authStore } from '$lib/stores/auth';
  import { goto } from '$app/navigation';
  import { initSocket, getSocket } from '$lib/socket.js';
  import { notificationStore } from '$lib/stores/notifications';
  import { shouldShowNotification } from '$lib/utils/notificationDeduplicator.js';

  let bookings = [];
  let loading = true;
  let user = null;
  let pollingInterval = null;
  let lastUpdate = null;
  let socketListenersRegistered = false;
  let socketInstance = null;

  authStore.subscribe((state) => {
    user = state.user;
    if (!state.isAuthenticated) {
      goto('/login');
    } else if (state.user?.role === 'provider') {
      // Redirecionar prestadores para a página correta
      goto('/provider/bookings');
    }
  });

  onMount(async () => {
    if (user && user.role !== 'provider') {
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
          socketInstance.off('booking-cancelled');
          socketInstance.off('booking-suggestion-accepted');
          socketInstance.off('booking-suggestion-rejected');
          
          socketInstance.on('booking-updated', (data) => {
            console.log('📢 [Cliente] Evento booking-updated recebido:', data);
            const clientId = data.clientId || data.booking?.clientId;
            const bookingId = data.bookingId || data.booking?.id;
            const status = data.status || data.booking?.status;
            
            // Verificar duplicação usando deduplicador
            if (!shouldShowNotification(bookingId, status, 'booking-updated')) {
              return;
            }
            
            if (clientId === user?.id || String(clientId) === String(user?.id)) {
              console.log('🔄 Atualizando lista de bookings...');
              loadBookings(true);
              
              // Mostrar notificação baseado no status
              const serviceName = data.booking?.service?.name || data.booking?.Service?.name || 'Serviço';
              console.log('Status recebido:', status, 'Service name:', serviceName);
              
              if (status === 'confirmed') {
                notificationStore.success(`Sua contratação "${serviceName}" foi APROVADA pelo prestador!`);
              } else if (status === 'rejected') {
                notificationStore.error(`Sua contratação "${serviceName}" foi REJEITADA pelo prestador.`);
              }
            }
          });

          socketInstance.on('booking-cancelled', (data) => {
            console.log('📢 [Cliente] Evento booking-cancelled recebido:', data);
            const bookingId = data.bookingId || data.booking?.id;
            
            // Verificar duplicação
            if (!shouldShowNotification(bookingId, 'cancelled', 'booking-cancelled')) {
              return;
            }
            
            if (data.clientId === user?.id || String(data.clientId) === String(user?.id)) {
              console.log('🔄 Contratação cancelada, atualizando lista...');
              loadBookings(true);
              const serviceName = data.booking?.service?.name || data.booking?.Service?.name || 'Serviço';
              notificationStore.warning(`Sua contratação "${serviceName}" foi CANCELADA.`);
            }
          });

          socketInstance.on('booking-suggestion-accepted', (data) => {
            console.log('📢 [Cliente] Evento booking-suggestion-accepted recebido:', data);
            if (data.clientId === user?.id) {
              loadBookings(true);
              notificationStore.success(`Sua sugestão de nova data foi aceita pelo prestador!`);
            }
          });

          socketInstance.on('booking-suggestion-rejected', (data) => {
            console.log('📢 [Cliente] Evento booking-suggestion-rejected recebido:', data);
            if (data.clientId === user?.id) {
              loadBookings(true);
              //notificationStore.info(`Sua sugestão de nova data foi rejeitada pelo prestador.`);
            }
          });
        }
      }
    }
  });

  onDestroy(() => {
    stopPolling();
    // Remover listeners do socket para evitar duplicação
    if (socketInstance) {
      socketInstance.off('booking-updated');
      socketInstance.off('booking-cancelled');
      socketInstance.off('booking-suggestion-accepted');
      socketInstance.off('booking-suggestion-rejected');
      socketListenersRegistered = false;
    }
  });

  function startPolling() {
    // Atualizar a cada 5 segundos
    pollingInterval = setInterval(async () => {
      if (user && user.role !== 'provider') {
        await loadBookings(true); // true = atualização silenciosa
      }
    }, 5000);
  }

  function stopPolling() {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
  }

  async function loadBookings(silent = false) {
    try {
      const response = await api.get('/bookings');
      const newBookings = response.data.bookings || [];
      
      // Ordenar por data de criação (mais recentes primeiro)
      newBookings.sort((a, b) => {
        const dateA = new Date(a.createdAt || a.scheduledDate);
        const dateB = new Date(b.createdAt || b.scheduledDate);
        return dateB - dateA; // DESC - mais recente primeiro
      });
      
      // Verificar se houve mudanças importantes (status)
      const hadChanges = !silent && bookings.length > 0 && checkForImportantChanges(newBookings);
      
      // Sempre atualizar a lista
      bookings = newBookings;
      lastUpdate = new Date();
      
      // Se não foi silencioso e houve mudanças, já mostramos as notificações
    } catch (error) {
      console.error('Erro ao carregar contratações:', error);
    } finally {
      loading = false;
    }
  }

  function checkForImportantChanges(newBookings) {
    // Verificar se algum booking mudou de status
    // NOTA: Não mostramos notificações aqui porque o WebSocket já faz isso
    // Esta função apenas detecta se houve mudanças importantes
    if (!bookings || bookings.length === 0) return false;
    
    let hadChanges = false;
    
    bookings.forEach(oldBooking => {
      const newBooking = newBookings.find(b => b.id === oldBooking.id);
      if (newBooking && String(oldBooking.status) !== String(newBooking.status)) {
        hadChanges = true;
      }
    });
    
    return hadChanges;
  }

  async function cancelBooking(id) {
    // Verificar se o pedido está concluído antes de tentar cancelar
    const booking = bookings.find(b => b.id === id);
    if (booking && booking.status === 'completed') {
      notificationStore.error('Não é possível cancelar um pedido que já foi concluído.');
      return;
    }

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
      pending: 'Aguardando Aprovação',
      cancelled: 'Cancelada',
      completed: 'Concluída',
      rejected: 'Rejeitada'
    };
    return labels[status] || status;
  }

  function formatBookingDate(dateString) {
    if (!dateString) return '';
    // Se já está no formato YYYY-MM-DD, usar diretamente
    if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateString)) {
      const [year, month, day] = dateString.split('T')[0].split('-');
      return `${day}/${month}/${year}`;
    }
    // Caso contrário, converter
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  }

  async function acceptSuggestion(id) {
    if (!confirm('Deseja aceitar a sugestão de nova data/horário? Uma nova contratação será criada.')) {
      return;
    }

    try {
      await api.put(`/bookings/${id}/accept-suggestion`);
      await loadBookings(false);
      notificationStore.success('Sugestão aceita! Nova contratação criada e aguardando aprovação do prestador.');
      setTimeout(() => loadBookings(false), 1000);
    } catch (error) {
      notificationStore.error(error.response?.data?.error || 'Erro ao aceitar sugestão');
    }
  }

  async function rejectSuggestion(id) {
    if (!confirm('Deseja rejeitar a sugestão? O prestador será notificado.')) {
      return;
    }

    try {
      await api.put(`/bookings/${id}/reject-suggestion`);
      await loadBookings(false);
      notificationStore.info('Sugestão rejeitada. O prestador foi notificado.');
      setTimeout(() => loadBookings(false), 1000);
    } catch (error) {
      notificationStore.error(error.response?.data?.error || 'Erro ao rejeitar sugestão');
    }
  }
</script>

<svelte:head>
  <title>Minhas Contratações - Marketplace</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-2 md:px-4">
  <div class="flex items-center gap-3 mb-6 md:mb-8">
    <h1 class="text-2xl md:text-3xl font-bold text-gray-900">Minhas Contratações</h1>
    {#if lastUpdate}
      <span class="text-xs text-gray-500" title="Última atualização: {lastUpdate.toLocaleTimeString('pt-BR')}">
        🔄 Atualizando automaticamente
      </span>
    {/if}
  </div>

  {#if loading}
    <div class="text-center py-12">
      <p class="text-gray-600">Carregando contratações...</p>
    </div>
  {:else if bookings.length === 0}
    <div class="text-center py-12 bg-white rounded-lg shadow-md">
      <p class="text-gray-600 mb-4">Você ainda não tem contratações.</p>
      <a
        href="/services"
        class="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        Ver Serviços Disponíveis
      </a>
    </div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {#each bookings as booking}
        <div class="bg-white rounded-lg shadow-md p-6">
          <h3 class="text-xl font-semibold text-gray-900 mb-2">{booking.service?.name}</h3>
          <p class="text-sm text-gray-600 mb-2">
            Prestador: {booking.provider?.name}
          </p>
          <p class="text-sm text-gray-600 mb-2">
            Variação: {booking.variation?.name}
          </p>
          <p class="text-sm text-gray-600 mb-2">
            Data: {formatBookingDate(booking.scheduledDate)} às {booking.scheduledTime}
          </p>
          <p class="text-lg font-semibold text-blue-600 mb-4">
            R$ {booking.totalPrice}
          </p>
          {#if booking.status === 'rejected' && booking.rejectionReason}
            <div class="mb-3 p-3 bg-red-50 border border-red-200 rounded">
              <p class="text-sm font-semibold text-red-800 mb-1">Motivo da rejeição:</p>
              <p class="text-sm text-red-700">{booking.rejectionReason}</p>
            </div>
          {/if}

          {#if booking.status === 'rejected' && booking.suggestedDate && booking.suggestedTime}
            <div class="mb-3 p-3 bg-blue-50 border border-blue-200 rounded">
              <p class="text-sm font-semibold text-blue-800 mb-1">Sugestão do prestador:</p>
              <p class="text-sm text-blue-700 mb-2">
                Nova data: {formatBookingDate(booking.suggestedDate)} às {booking.suggestedTime}
              </p>
              {#if booking.alternativeBookingId}
                <p class="text-xs text-green-600 italic">Você já aceitou esta sugestão. Verifique suas contratações pendentes.</p>
              {:else if booking.suggestionRejectedAt}
                <p class="text-xs text-red-600 italic">Você rejeitou esta sugestão.</p>
              {:else}
                <div class="flex gap-2 mt-2">
                  <button
                    on:click={() => acceptSuggestion(booking.id)}
                    class="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs"
                  >
                    Aceitar Sugestão
                  </button>
                  <button
                    on:click={() => rejectSuggestion(booking.id)}
                    class="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs"
                  >
                    Rejeitar Sugestão
                  </button>
                </div>
              {/if}
            </div>
          {/if}

          <div class="flex flex-col gap-2">
            <div class="flex justify-between items-center">
              <span class="px-2 py-1 text-xs font-semibold rounded-full {getStatusColor(booking.status)}">
                {getStatusLabel(booking.status)}
              </span>
              {#if booking.status !== 'cancelled' && booking.status !== 'rejected' && booking.status !== 'completed'}
                <button
                  on:click={() => cancelBooking(booking.id)}
                  class="text-red-600 hover:text-red-900 text-sm"
                >
                  Cancelar
                </button>
              {/if}
            </div>
            {#if booking.status === 'confirmed'}
              <a
                href="/chat?bookingId={booking.id}"
                class="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm text-center flex items-center justify-center gap-2 mt-2"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Iniciar Chat com Prestador
              </a>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>


