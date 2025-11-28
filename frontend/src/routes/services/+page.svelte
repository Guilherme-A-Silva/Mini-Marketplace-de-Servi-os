<script>
  import { onMount } from 'svelte';
  import api from '$lib/api';
  import { goto } from '$app/navigation';

  let services = [];
  let serviceTypes = [];
  let selectedType = '';
  let searchQuery = '';
  let loading = true;

  onMount(async () => {
    await loadServiceTypes();
    await loadServices();
  });

  async function loadServiceTypes() {
    try {
      const response = await api.get('/service-types');
      serviceTypes = response.data.serviceTypes;
    } catch (error) {
      console.error('Erro ao carregar tipos:', error);
    }
  }

  async function loadServices() {
    try {
      loading = true;
      const params = {};
      if (selectedType) params.serviceTypeId = selectedType;
      if (searchQuery) params.search = searchQuery;

      const response = await api.get('/services', { params });
      services = response.data.services;
    } catch (error) {
      console.error('Erro ao carregar serviços:', error);
    } finally {
      loading = false;
    }
  }

  function handleSearch() {
    loadServices();
  }

  function handleTypeChange() {
    loadServices();
  }
</script>

<svelte:head>
  <title>Serviços - Marketplace</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-2 md:px-4">
  <h1 class="text-2xl md:text-3xl font-bold text-gray-900 mb-6 md:mb-8">Todos os Serviços</h1>

  <!-- Busca e Filtros -->
  <div class="bg-white p-4 md:p-6 rounded-lg shadow-md mb-6 md:mb-8">
    <div class="flex flex-col gap-3 md:flex-row md:gap-4">
      <div class="flex-1">
        <input
          type="text"
          placeholder="Buscar serviços..."
          bind:value={searchQuery}
          on:keydown={(e) => e.key === 'Enter' && handleSearch()}
          class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm md:text-base"
        />
      </div>
      <div class="w-full md:w-64">
        <select
          bind:value={selectedType}
          on:change={handleTypeChange}
          class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm md:text-base"
        >
          <option value="">Todos os tipos</option>
          {#each serviceTypes as type}
            <option value={type.id}>{type.name}</option>
          {/each}
        </select>
      </div>
      <button
        on:click={handleSearch}
        class="w-full md:w-auto px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm md:text-base"
      >
        Buscar
      </button>
    </div>
  </div>

  <!-- Lista de Serviços -->
  {#if loading}
    <div class="text-center py-12">
      <p class="text-gray-600">Carregando serviços...</p>
    </div>
  {:else if services.length === 0}
    <div class="text-center py-12">
      <p class="text-gray-600">Nenhum serviço encontrado.</p>
    </div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {#each services as service}
        <div
          role="button"
          tabindex="0"
          class="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
          on:click={() => goto(`/services/${service.id}`)}
          on:keydown={(e) => e.key === 'Enter' && goto(`/services/${service.id}`)}
        >
          <div class="p-6">
            <h3 class="text-xl font-semibold text-gray-900 mb-2">{service.name}</h3>
            <p class="text-sm text-blue-600 mb-2">{service.serviceType?.name}</p>
            <p class="text-gray-600 text-sm mb-4 line-clamp-2">
              {service.description || 'Sem descrição'}
            </p>
            <div class="flex justify-between items-center">
              <span class="text-gray-500 text-sm">
                Por {service.provider?.name}
              </span>
              <span class="text-blue-600 font-semibold">
                A partir de R$ {service.variations?.[0]?.price || '0.00'}
              </span>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

