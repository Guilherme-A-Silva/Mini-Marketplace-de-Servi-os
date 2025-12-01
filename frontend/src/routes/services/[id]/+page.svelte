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
  let reviews = [];
  let showReviewForm = false;
  let reviewRating = 5;
  let reviewComment = '';
  let submittingReview = false;

  let user = null;
  authStore.subscribe((state) => {
    user = state.user;
  });

  onMount(async () => {
    await loadService();
    await loadAvailability();
    await loadReviews();
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

  async function loadReviews() {
    try {
      const response = await api.get('/reviews', {
        params: { serviceId: $page.params.id }
      });
      reviews = response.data.reviews || [];
    } catch (error) {
      console.error('Erro ao carregar avaliações:', error);
    }
  }

  function getDayName(dayOfWeek) {
    const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    return days[dayOfWeek] || '';
  }

  function getDiscountForDate(variation, date) {
    if (!variation.discounts || !date) return null;
    const dayOfWeek = new Date(date).getDay();
    const now = new Date();
    const selectedDate = new Date(date);
    
    return variation.discounts.find(d => {
      if (d.dayOfWeek !== dayOfWeek || !d.isActive) return false;
      if (!d.startDate && !d.endDate) return true; // Permanente
      const startDate = d.startDate ? new Date(d.startDate) : null;
      const endDate = d.endDate ? new Date(d.endDate) : null;
      if (startDate && selectedDate < startDate) return false;
      if (endDate && selectedDate > endDate) return false;
      return true;
    });
  }

  function calculatePriceWithDiscount(variation, date) {
    const discount = getDiscountForDate(variation, date);
    if (!discount) return parseFloat(variation.price);
    const discountAmount = (parseFloat(variation.price) * parseFloat(discount.discountPercentage)) / 100;
    return parseFloat(variation.price) - discountAmount;
  }

  async function submitReview() {
    if (!user) {
      notificationStore.error('Você precisa estar logado para avaliar');
      return;
    }

    try {
      submittingReview = true;
      // Buscar bookingId - precisamos encontrar uma contratação concluída do cliente para este serviço
      const bookingsResponse = await api.get('/bookings', {
        params: { serviceId: service.id }
      });
      const completedBooking = bookingsResponse.data.bookings?.find(
        b => b.clientId === user.id && b.status === 'completed'
      );

      if (!completedBooking) {
        notificationStore.error('Você precisa ter uma contratação concluída para avaliar');
        return;
      }

      await api.post('/reviews', {
        bookingId: completedBooking.id,
        rating: reviewRating,
        comment: reviewComment
      });

      notificationStore.success('Avaliação enviada com sucesso!');
      showReviewForm = false;
      reviewRating = 5;
      reviewComment = '';
      await loadReviews();
      await loadService(); // Recarregar para atualizar média
    } catch (error) {
      console.error('Erro ao enviar avaliação:', error);
      notificationStore.error(error.response?.data?.error || 'Erro ao enviar avaliação');
    } finally {
      submittingReview = false;
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

      <!-- Avaliações -->
      {#if service.averageRating !== undefined}
        <div class="mb-6 p-4 bg-gray-50 rounded-lg">
          <div class="flex items-center gap-4 mb-2">
            <div class="text-2xl font-bold">{service.averageRating}</div>
            <div>
              <div class="flex items-center gap-1">
                {#each Array(5) as _, i}
                  <span class="text-yellow-400">
                    {#if i < Math.floor(service.averageRating)}
                      ★
                    {:else}
                      ☆
                    {/if}
                  </span>
                {/each}
              </div>
              <div class="text-sm text-gray-600">{service.totalReviews} avaliações</div>
            </div>
          </div>
        </div>
      {/if}

      <div class="mb-6">
        <h2 class="text-lg md:text-xl font-semibold mb-4">Variações</h2>
        <div class="space-y-2">
          {#each service.variations || [] as variation}
            {@const discount = selectedDate ? getDiscountForDate(variation, selectedDate) : null}
            {@const finalPrice = selectedDate ? calculatePriceWithDiscount(variation, selectedDate) : parseFloat(variation.price)}
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
                  {#if discount && selectedDate}
                    <span class="line-through text-gray-400">R$ {variation.price}</span>
                    <span class="text-green-600 font-semibold ml-2">R$ {finalPrice.toFixed(2)}</span>
                    <span class="text-green-600 ml-1">(-{discount.discountPercentage}%)</span>
                  {:else}
                    R$ {variation.price}
                  {/if}
                  • {variation.durationMinutes} minutos
                </div>
                {#if variation.discounts && variation.discounts.length > 0}
                  <div class="text-xs text-blue-600 mt-1">
                    Descontos disponíveis: {variation.discounts.map(d => getDayName(d.dayOfWeek)).join(', ')}
                  </div>
                {/if}
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

      <!-- Avaliações -->
      <div class="mb-6 border-t pt-6">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-lg md:text-xl font-semibold">Avaliações ({reviews.length})</h2>
          {#if user && user.role === 'client'}
            <button
              on:click={() => showReviewForm = !showReviewForm}
              class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
            >
              {showReviewForm ? 'Cancelar' : 'Avaliar'}
            </button>
          {/if}
        </div>

        {#if showReviewForm}
          <div class="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 class="font-semibold mb-4">Deixe sua avaliação</h3>
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Nota</label>
                <div class="flex gap-2">
                  {#each Array(5) as _, i}
                    <button
                      type="button"
                      on:click={() => reviewRating = i + 1}
                      class="text-3xl {i < reviewRating ? 'text-yellow-400' : 'text-gray-300'} hover:text-yellow-400 transition"
                    >
                      ★
                    </button>
                  {/each}
                </div>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Comentário</label>
                <textarea
                  bind:value={reviewComment}
                  rows="4"
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="Compartilhe sua experiência..."
                ></textarea>
              </div>
              <button
                on:click={submitReview}
                disabled={submittingReview}
                class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition text-sm"
              >
                {submittingReview ? 'Enviando...' : 'Enviar Avaliação'}
              </button>
            </div>
          </div>
        {/if}

        {#if reviews.length === 0}
          <p class="text-gray-600 text-sm">Ainda não há avaliações para este serviço.</p>
        {:else}
          <div class="space-y-4">
            {#each reviews as review}
              <div class="p-4 border rounded-lg">
                <div class="flex items-start justify-between mb-2">
                  <div>
                    <div class="font-semibold text-sm">{review.client?.name || 'Anônimo'}</div>
                    <div class="flex items-center gap-1 mt-1">
                      {#each Array(5) as _, i}
                        <span class="text-yellow-400 text-sm">
                          {#if i < review.rating}★{:else}☆{/if}
                        </span>
                      {/each}
                    </div>
                  </div>
                  <div class="text-xs text-gray-500">
                    {new Date(review.createdAt).toLocaleDateString('pt-BR')}
                  </div>
                </div>
                {#if review.comment}
                  <p class="text-sm text-gray-700 mt-2">{review.comment}</p>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
{:else}
  <div class="text-center py-12">
    <p class="text-gray-600">Serviço não encontrado.</p>
  </div>
{/if}

