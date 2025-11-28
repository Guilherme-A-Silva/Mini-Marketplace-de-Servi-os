<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import api from '$lib/api';
  import { authStore } from '$lib/stores/auth';
  import { goto } from '$app/navigation';
  import { notificationStore } from '$lib/stores/notifications';

  let service = null;
  let selectedVariation = null;
  let selectedDate = '';
  let selectedTime = '';
  let availabilitySlots = [];
  let loading = true;
  let booking = false;
  let error = '';

  let user = null;
  authStore.subscribe((state) => {
    user = state.user;
  });

  onMount(async () => {
    await loadService();
    await loadAvailability();
  });

  async function loadService() {
    try {
      const response = await api.get(`/services/${$page.params.id}`);
      service = response.data.service;
      if (service.variations && service.variations.length > 0) {
        selectedVariation = service.variations[0];
      }
    } catch (error) {
      console.error('Erro ao carregar serviço:', error);
    } finally {
      loading = false;
    }
  }

  async function loadAvailability() {
    try {
      const response = await api.get('/availability', {
        params: { providerId: service?.providerId }
      });
      availabilitySlots = response.data.slots;
    } catch (error) {
      console.error('Erro ao carregar disponibilidades:', error);
    }
  }

  function getAvailableTimes(dayOfWeek) {
    const slot = availabilitySlots.find(s => s.dayOfWeek === dayOfWeek && s.isActive);
    if (!slot) return [];

    const times = [];
    const [startHour, startMin] = slot.startTime.split(':').map(Number);
    const [endHour, endMin] = slot.endTime.split(':').map(Number);
    
    let currentHour = startHour;
    let currentMin = startMin;

    while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
      times.push(`${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`);
      currentMin += 30;
      if (currentMin >= 60) {
        currentMin = 0;
        currentHour++;
      }
    }

    return times;
  }

  function getDayOfWeek(dateStr) {
    const date = new Date(dateStr);
    return date.getDay();
  }

  async function handleBooking() {
    if (!user) {
      goto('/login');
      return;
    }

    if (!selectedVariation || !selectedDate || !selectedTime) {
      error = 'Por favor, preencha todos os campos';
      return;
    }

    try {
      booking = true;
      error = '';

      // Verificar se é serviço de múltiplos dias (duração > 1 dia)
      const durationDays = Math.ceil(selectedVariation.durationMinutes / (24 * 60));
      let endDate = null;
      let endTime = null;

      if (durationDays > 1) {
        const startDate = new Date(`${selectedDate}T${selectedTime}`);
        const endDateTime = new Date(startDate.getTime() + selectedVariation.durationMinutes * 60000);
        endDate = endDateTime.toISOString().split('T')[0];
        endTime = endDateTime.toTimeString().slice(0, 5);
      }

      const bookingData = {
        serviceId: parseInt(service.id),
        serviceVariationId: parseInt(selectedVariation.id),
        scheduledDate: selectedDate,
        scheduledTime: selectedTime
      };

      // Adicionar endDate e endTime apenas se existirem
      if (endDate && endTime) {
        bookingData.endDate = endDate;
        bookingData.endTime = endTime;
      }

      console.log('Dados da contratação:', bookingData);

      const response = await api.post('/bookings', bookingData);

      let message = 'Solicitação de contratação enviada! O prestador receberá uma notificação e avaliará sua solicitação.';
      if (response.data.warning) {
        notificationStore.warning(response.data.warning);
      }
      notificationStore.success(message);
      goto('/bookings');
    } catch (err) {
      console.error('Erro completo:', err);
      if (err.response?.data?.errors) {
        error = err.response.data.errors.map(e => e.msg || e.message).join(', ');
      } else {
        error = err.response?.data?.error || 'Erro ao realizar contratação';
      }
    } finally {
      booking = false;
    }
  }
</script>

<svelte:head>
  <title>{service?.name || 'Serviço'} - Marketplace</title>
</svelte:head>

{#if loading}
  <div class="text-center py-12">
    <p class="text-gray-600">Carregando serviço...</p>
  </div>
{:else if service}
  <div class="max-w-4xl mx-auto px-2 md:px-4">
    <div class="bg-white rounded-lg shadow-md p-4 md:p-8">
      <h1 class="text-2xl md:text-3xl font-bold text-gray-900 mb-3 md:mb-4">{service.name}</h1>
      <p class="text-blue-600 mb-3 md:mb-4 text-sm md:text-base">{service.serviceType?.name}</p>
      <p class="text-gray-700 mb-4 md:mb-6 text-sm md:text-base">{service.description || 'Sem descrição'}</p>

      <div class="mb-4 md:mb-6">
        <h2 class="text-lg md:text-xl font-semibold mb-3 md:mb-4">Prestador</h2>
        <p class="text-gray-700"><strong>Nome:</strong> {service.provider?.name}</p>
        {#if service.provider?.city}
          <p class="text-gray-700"><strong>Localização:</strong> {service.provider?.city}
            {#if service.provider?.neighborhood}
              - {service.provider?.neighborhood}
            {/if}
          </p>
        {/if}
        {#if service.provider?.phone}
          <p class="text-gray-700"><strong>Telefone:</strong> {service.provider?.phone}</p>
        {/if}
      </div>

      <div class="mb-6">
        <h2 class="text-lg md:text-xl font-semibold mb-4">Variações</h2>
        <div class="space-y-2">
          {#each service.variations || [] as variation}
            <label class="flex items-center p-3 md:p-4 border rounded-lg cursor-pointer hover:bg-gray-50 {selectedVariation?.id === variation.id ? 'border-blue-500 bg-blue-50' : ''}">
              <input
                type="radio"
                bind:group={selectedVariation}
                value={variation}
                class="mr-3 md:mr-4"
              />
              <div class="flex-1">
                <div class="font-semibold text-sm md:text-base">{variation.name}</div>
                <div class="text-xs md:text-sm text-gray-600">
                  R$ {variation.price} • {variation.durationMinutes} minutos
                </div>
              </div>
            </label>
          {/each}
        </div>
      </div>

      {#if user}
        <div class="mb-6">
          <h2 class="text-lg md:text-xl font-semibold mb-4">Agendar</h2>
          
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Data</label>
              <input
                type="date"
                bind:value={selectedDate}
                min={new Date().toISOString().split('T')[0]}
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm md:text-base"
              />
            </div>

            {#if selectedDate}
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Horário</label>
                <div class="space-y-2">
                  <select
                    bind:value={selectedTime}
                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm md:text-base"
                  >
                    <option value="">Selecione um horário</option>
                    {#each getAvailableTimes(getDayOfWeek(selectedDate)) as time}
                      <option value={time}>{time}</option>
                    {/each}
                  </select>
                  <p class="text-xs text-gray-500">
                    Ou digite um horário personalizado:
                  </p>
                  <input
                    type="time"
                    bind:value={selectedTime}
                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm md:text-base"
                    placeholder="HH:MM"
                  />
                  <p class="text-xs text-blue-600">
                    Você pode solicitar qualquer horário. O prestador avaliará sua solicitação.
                  </p>
                </div>
              </div>
            {/if}
          </div>

          {#if error}
            <div class="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          {/if}

          <button
            on:click={handleBooking}
            disabled={booking || !selectedVariation || !selectedDate || !selectedTime}
            class="mt-6 w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition text-sm md:text-base"
          >
            {booking ? 'Processando...' : 'Contratar Serviço'}
          </button>
        </div>
      {:else}
        <div class="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p class="text-yellow-800">
            Você precisa estar logado para contratar este serviço.
            <a href="/login" class="text-blue-600 underline">Fazer login</a>
          </p>
        </div>
      {/if}
    </div>
  </div>
{:else}
  <div class="text-center py-12">
    <p class="text-gray-600">Serviço não encontrado.</p>
  </div>
{/if}

