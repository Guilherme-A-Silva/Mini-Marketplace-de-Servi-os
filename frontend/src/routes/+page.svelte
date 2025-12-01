<script>
  import { onMount } from 'svelte';
  import api from '$lib/api';
  import { goto } from '$app/navigation';

  let services = [];
  let serviceTypes = [];
  let selectedType = '';
  let searchQuery = '';
  let filterCity = '';
  let filterNeighborhood = '';
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
      if (filterCity) params.city = filterCity;
      if (filterNeighborhood) params.neighborhood = filterNeighborhood;

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
  <title>Marketplace de Serviços</title>
</svelte:head>

<!-- Hero Section -->
<div class="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white py-12 md:py-20 mb-8 md:mb-12">
  <div class="max-w-7xl mx-auto px-2 md:px-4 text-center">
    <h1 class="text-3xl md:text-5xl font-bold mb-4 md:mb-6">
      Encontre o Serviço Perfeito
    </h1>
    <p class="text-lg md:text-2xl text-blue-100 mb-6 md:mb-8 max-w-2xl mx-auto">
      Conectamos você com os melhores profissionais da sua região
    </p>
  </div>
</div>

<div class="max-w-7xl mx-auto px-2 md:px-4">
  <!-- Busca e Filtros -->
  <div class="bg-white p-6 md:p-8 rounded-xl shadow-lg mb-8 md:mb-12 border border-gray-100">
    <h2 class="text-xl md:text-2xl font-bold text-gray-900 mb-6">Buscar Serviços</h2>
    
    <div class="space-y-6">
      <!-- Busca Principal -->
      <div class="flex flex-col gap-3 md:flex-row md:gap-4">
        <div class="flex-1 relative">
          <svg class="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar serviços..."
            bind:value={searchQuery}
            on:keydown={(e) => e.key === 'Enter' && handleSearch()}
            class="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm md:text-base transition"
          />
        </div>
        <div class="w-full md:w-64 relative">
          <svg class="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
          <select
            bind:value={selectedType}
            on:change={handleTypeChange}
            class="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm md:text-base appearance-none bg-white transition"
          >
            <option value="">Todos os tipos</option>
            {#each serviceTypes as type}
              <option value={type.id}>{type.name}</option>
            {/each}
          </select>
        </div>
        <button
          on:click={handleSearch}
          class="w-full md:w-auto px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold text-sm md:text-base shadow-md hover:shadow-lg"
        >
          Buscar
        </button>
      </div>
      
      <!-- Filtros de Localização -->
      <div class="border-t border-gray-200 pt-6">
        <div class="flex items-center gap-2 mb-4">
          <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <h3 class="text-lg font-semibold text-gray-900">Localização</h3>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Cidade</label>
            <div class="relative">
              <svg class="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
              </svg>
              <input
                type="text"
                placeholder="Ex: São Paulo"
                bind:value={filterCity}
                on:keydown={(e) => e.key === 'Enter' && handleSearch()}
                class="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm md:text-base transition"
              />
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Bairro</label>
            <div class="relative">
              <svg class="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <input
                type="text"
                placeholder="Ex: Centro"
                bind:value={filterNeighborhood}
                on:keydown={(e) => e.key === 'Enter' && handleSearch()}
                class="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm md:text-base transition"
              />
            </div>
          </div>
          <div class="flex items-end">
            <button
              on:click={() => { filterCity = ''; filterNeighborhood = ''; loadServices(); }}
              class="w-full px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium text-sm md:text-base border-2 border-gray-200"
            >
              <span class="flex items-center justify-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Limpar Filtros
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Lista de Serviços -->
  {#if loading}
    <div class="text-center py-16">
      <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
      <p class="text-gray-600 text-lg">Carregando serviços...</p>
    </div>
  {:else if services.length === 0}
    <div class="text-center py-16 bg-white rounded-xl shadow-md border border-gray-100">
      <svg class="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p class="text-gray-600 text-lg font-medium">Nenhum serviço encontrado.</p>
      <p class="text-gray-500 text-sm mt-2">Tente ajustar os filtros de busca.</p>
    </div>
  {:else}
    <div>
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-2xl md:text-3xl font-bold text-gray-900">
          Serviços Disponíveis
        </h2>
        <span class="text-gray-600 text-sm md:text-base">
          {services.length} {services.length === 1 ? 'serviço encontrado' : 'serviços encontrados'}
        </span>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {#each services as service}
          <div
            role="button"
            tabindex="0"
            class="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer border border-gray-100 transform hover:-translate-y-1"
            on:click={() => goto(`/services/${service.id}`)}
            on:keydown={(e) => e.key === 'Enter' && goto(`/services/${service.id}`)}
          >
            <div class="p-6">
              <div class="flex items-start justify-between mb-3">
                <h3 class="text-xl font-bold text-gray-900 flex-1">{service.name}</h3>
                <span class="ml-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                  {service.serviceType?.name}
                </span>
              </div>
              <p class="text-gray-600 text-sm mb-4 line-clamp-2 min-h-[2.5rem]">
                {service.description || 'Sem descrição'}
              </p>
              <div class="border-t border-gray-100 pt-4 mt-4">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span class="text-gray-600 text-sm">
                      {service.provider?.name}
                    </span>
                  </div>
                  <div class="text-right">
                    <div class="text-xs text-gray-500">A partir de</div>
                    <div class="text-lg font-bold text-blue-600">
                      R$ {parseFloat(service.variations?.[0]?.price || 0).toFixed(2)}
                    </div>
                  </div>
                </div>
                {#if service.provider?.city}
                  <div class="flex items-center gap-1 mt-3 text-xs text-gray-500">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {service.provider.city}
                    {#if service.provider.neighborhood}
                      - {service.provider.neighborhood}
                    {/if}
                  </div>
                {/if}
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

