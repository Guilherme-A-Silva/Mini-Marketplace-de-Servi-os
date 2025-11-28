<script>
  import { onMount } from 'svelte';
  import api from '$lib/api';

  let slots = [];
  let dayOfWeek = 1;
  let startTime = '09:00';
  let endTime = '18:00';
  let loading = false;
  let error = '';

  const days = [
    { value: 0, label: 'Domingo' },
    { value: 1, label: 'Segunda-feira' },
    { value: 2, label: 'Terça-feira' },
    { value: 3, label: 'Quarta-feira' },
    { value: 4, label: 'Quinta-feira' },
    { value: 5, label: 'Sexta-feira' },
    { value: 6, label: 'Sábado' }
  ];

  onMount(async () => {
    await loadSlots();
  });

  async function loadSlots() {
    try {
      const response = await api.get('/availability');
      slots = response.data.slots;
    } catch (error) {
      console.error('Erro ao carregar disponibilidades:', error);
    }
  }

  async function handleAdd() {
    try {
      loading = true;
      error = '';

      await api.post('/availability', {
        dayOfWeek: parseInt(dayOfWeek),
        startTime,
        endTime
      });

      await loadSlots();
      dayOfWeek = 1;
      startTime = '09:00';
      endTime = '18:00';
    } catch (err) {
      error = err.response?.data?.error || 'Erro ao adicionar disponibilidade';
      if (err.response?.data?.errors) {
        error = err.response.data.errors.map(e => e.msg).join(', ');
      }
    } finally {
      loading = false;
    }
  }

  async function handleDelete(id) {
    if (!confirm('Tem certeza que deseja remover esta disponibilidade?')) {
      return;
    }

    try {
      await api.delete(`/availability/${id}`);
      await loadSlots();
    } catch (error) {
      alert('Erro ao remover disponibilidade');
    }
  }
</script>

<svelte:head>
  <title>Disponibilidades - Marketplace</title>
</svelte:head>

<div class="max-w-4xl mx-auto px-2 md:px-4">
  <h1 class="text-2xl md:text-3xl font-bold text-gray-900 mb-6 md:mb-8">Gerenciar Disponibilidades</h1>

  <div class="bg-white rounded-lg shadow-md p-4 md:p-8 mb-6 md:mb-8">
    <h2 class="text-xl font-semibold mb-4">Adicionar Disponibilidade</h2>

    {#if error}
      <div class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
        {error}
      </div>
    {/if}

    <form on:submit|preventDefault={handleAdd} class="space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Dia da Semana</label>
          <select
            bind:value={dayOfWeek}
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            {#each days as day}
              <option value={day.value}>{day.label}</option>
            {/each}
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Horário Início</label>
          <input
            type="time"
            bind:value={startTime}
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Horário Fim</label>
          <input
            type="time"
            bind:value={endTime}
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={loading}
        class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
      >
        {loading ? 'Adicionando...' : 'Adicionar'}
      </button>
    </form>
  </div>

  <div class="bg-white rounded-lg shadow-md p-4 md:p-8">
    <h2 class="text-xl font-semibold mb-4">Minhas Disponibilidades</h2>

    {#if slots.length === 0}
      <p class="text-gray-600">Nenhuma disponibilidade cadastrada.</p>
    {:else}
      <div class="space-y-4">
        {#each slots as slot}
          <div class="flex justify-between items-center p-4 border border-gray-300 rounded-lg">
            <div>
              <p class="font-semibold">{days.find(d => d.value === slot.dayOfWeek)?.label}</p>
              <p class="text-sm text-gray-600">
                {slot.startTime} - {slot.endTime}
              </p>
            </div>
            <button
              on:click={() => handleDelete(slot.id)}
              class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Remover
            </button>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

