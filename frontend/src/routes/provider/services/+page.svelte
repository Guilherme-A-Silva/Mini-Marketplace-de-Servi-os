<script>
  import { onMount } from 'svelte';
  import api from '$lib/api';
  import { authStore } from '$lib/stores/auth';
  import { goto } from '$app/navigation';

  let services = [];
  let loading = true;
  let user = null;

  authStore.subscribe((state) => {
    user = state.user;
  });

  onMount(async () => {
    await loadServices();
  });

  async function loadServices() {
    try {
      const response = await api.get('/services');
      services = response.data.services.filter(s => s.providerId === user?.id);
    } catch (error) {
      console.error('Erro ao carregar serviços:', error);
    } finally {
      loading = false;
    }
  }

  async function deleteService(id) {
    if (!confirm('Tem certeza que deseja deletar este serviço?')) {
      return;
    }

    try {
      await api.delete(`/services/${id}`);
      await loadServices();
    } catch (error) {
      alert('Erro ao deletar serviço');
    }
  }
</script>

<svelte:head>
  <title>Meus Serviços - Marketplace</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-2 md:px-4">
  <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 md:mb-8">
    <h1 class="text-2xl md:text-3xl font-bold text-gray-900">Meus Serviços</h1>
    <a
      href="/provider/services/new"
      class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
    >
      Novo Serviço
    </a>
  </div>

  {#if loading}
    <div class="text-center py-12">
      <p class="text-gray-600">Carregando serviços...</p>
    </div>
  {:else if services.length === 0}
    <div class="text-center py-12 bg-white rounded-lg shadow-md">
      <p class="text-gray-600 mb-4">Você ainda não tem serviços cadastrados.</p>
      <a
        href="/provider/services/new"
        class="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        Criar Primeiro Serviço
      </a>
    </div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {#each services as service}
        <div class="bg-white rounded-lg shadow-md p-6">
          <h3 class="text-xl font-semibold text-gray-900 mb-2">{service.name}</h3>
          <p class="text-sm text-blue-600 mb-2">{service.serviceType?.name}</p>
          <p class="text-gray-600 text-sm mb-4">
            {service.variations?.length || 0} variações
          </p>
          <div class="flex gap-2">
            <a
              href="/provider/services/{service.id}"
              class="flex-1 text-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Editar
            </a>
            <button
              on:click={() => deleteService(service.id)}
              class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Deletar
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

