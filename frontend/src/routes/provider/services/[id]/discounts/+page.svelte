<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import api from '$lib/api';
  import { notificationStore } from '$lib/stores/notifications';
  import { goto } from '$app/navigation';

  let service = null;
  let variations = [];
  let discounts = [];
  let loading = true;
  let showModal = false;
  let editingDiscount = null;
  let formData = {
    serviceVariationId: '',
    dayOfWeek: 0,
    discountPercentage: 0,
    startDate: '',
    endDate: '',
    isActive: true
  };

  const daysOfWeek = [
    { value: 0, label: 'Domingo' },
    { value: 1, label: 'Segunda-feira' },
    { value: 2, label: 'Terça-feira' },
    { value: 3, label: 'Quarta-feira' },
    { value: 4, label: 'Quinta-feira' },
    { value: 5, label: 'Sexta-feira' },
    { value: 6, label: 'Sábado' }
  ];

  onMount(async () => {
    await loadService();
    await loadDiscounts();
  });

  async function loadService() {
    try {
      const response = await api.get(`/services/${$page.params.id}`);
      service = response.data.service;
      variations = service.variations || [];
      if (variations.length > 0) {
        formData.serviceVariationId = variations[0].id;
      }
    } catch (error) {
      console.error('Erro ao carregar serviço:', error);
      notificationStore.error('Erro ao carregar serviço');
    } finally {
      loading = false;
    }
  }

  async function loadDiscounts() {
    try {
      const response = await api.get('/discounts', {
        params: { serviceVariationId: formData.serviceVariationId }
      });
      discounts = response.data.discounts || [];
    } catch (error) {
      console.error('Erro ao carregar descontos:', error);
    }
  }

  function openModal(discount = null) {
    editingDiscount = discount;
    if (discount) {
      formData = {
        serviceVariationId: discount.serviceVariationId,
        dayOfWeek: discount.dayOfWeek,
        discountPercentage: discount.discountPercentage,
        startDate: discount.startDate ? discount.startDate.split('T')[0] : '',
        endDate: discount.endDate ? discount.endDate.split('T')[0] : '',
        isActive: discount.isActive
      };
    } else {
      formData = {
        serviceVariationId: variations[0]?.id || '',
        dayOfWeek: 0,
        discountPercentage: 0,
        startDate: '',
        endDate: '',
        isActive: true
      };
    }
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    editingDiscount = null;
    formData = {
      serviceVariationId: variations[0]?.id || '',
      dayOfWeek: 0,
      discountPercentage: 0,
      startDate: '',
      endDate: '',
      isActive: true
    };
  }

  async function saveDiscount() {
    try {
      const data = {
        ...formData,
        serviceVariationId: parseInt(formData.serviceVariationId),
        dayOfWeek: parseInt(formData.dayOfWeek),
        discountPercentage: parseFloat(formData.discountPercentage),
        startDate: formData.startDate || null,
        endDate: formData.endDate || null
      };

      if (editingDiscount) {
        await api.put(`/discounts/${editingDiscount.id}`, data);
        notificationStore.success('Desconto atualizado com sucesso!');
      } else {
        await api.post('/discounts', data);
        notificationStore.success('Desconto criado com sucesso!');
      }

      closeModal();
      await loadDiscounts();
    } catch (error) {
      console.error('Erro ao salvar desconto:', error);
      notificationStore.error(error.response?.data?.error || 'Erro ao salvar desconto');
    }
  }

  async function deleteDiscount(id) {
    if (!confirm('Tem certeza que deseja deletar este desconto?')) {
      return;
    }

    try {
      await api.delete(`/discounts/${id}`);
      notificationStore.success('Desconto removido com sucesso!');
      await loadDiscounts();
    } catch (error) {
      console.error('Erro ao deletar desconto:', error);
      notificationStore.error('Erro ao deletar desconto');
    }
  }

  function getDayName(dayOfWeek) {
    return daysOfWeek.find(d => d.value === dayOfWeek)?.label || '';
  }
</script>

<svelte:head>
  <title>Gerenciar Descontos - {service?.name || 'Serviço'}</title>
</svelte:head>

{#if loading}
  <div class="text-center py-12">
    <p class="text-gray-600">Carregando...</p>
  </div>
{:else if service}
  <div class="max-w-6xl mx-auto px-2 md:px-4">
    <div class="mb-6">
      <button
        on:click={() => goto(`/provider/services/${service.id}`)}
        class="text-blue-600 hover:text-blue-800 mb-4 text-sm"
      >
        ← Voltar para o serviço
      </button>
      <h1 class="text-2xl md:text-3xl font-bold text-gray-900">Gerenciar Descontos</h1>
      <p class="text-gray-600 mt-2">{service.name}</p>
    </div>

    <div class="bg-white rounded-lg shadow-md p-4 md:p-6 mb-6">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-lg md:text-xl font-semibold">Descontos</h2>
        <button
          on:click={() => openModal()}
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
        >
          + Novo Desconto
        </button>
      </div>

      {#if variations.length === 0}
        <p class="text-gray-600">Este serviço não possui variações.</p>
      {:else}
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">Filtrar por variação</label>
          <select
            bind:value={formData.serviceVariationId}
            on:change={loadDiscounts}
            class="w-full md:w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
          >
            {#each variations as variation}
              <option value={variation.id}>{variation.name}</option>
            {/each}
          </select>
        </div>

        {#if discounts.length === 0}
          <p class="text-gray-600">Nenhum desconto cadastrado para esta variação.</p>
        {:else}
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b">
                  <th class="text-left py-2 px-2">Dia da Semana</th>
                  <th class="text-left py-2 px-2">Desconto</th>
                  <th class="text-left py-2 px-2">Período</th>
                  <th class="text-left py-2 px-2">Status</th>
                  <th class="text-right py-2 px-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {#each discounts as discount}
                  <tr class="border-b hover:bg-gray-50">
                    <td class="py-2 px-2">{getDayName(discount.dayOfWeek)}</td>
                    <td class="py-2 px-2 font-semibold text-green-600">{discount.discountPercentage}%</td>
                    <td class="py-2 px-2 text-xs">
                      {#if discount.startDate && discount.endDate}
                        {new Date(discount.startDate).toLocaleDateString('pt-BR')} - {new Date(discount.endDate).toLocaleDateString('pt-BR')}
                      {:else if discount.startDate}
                        A partir de {new Date(discount.startDate).toLocaleDateString('pt-BR')}
                      {:else}
                        Permanente
                      {/if}
                    </td>
                    <td class="py-2 px-2">
                      <span class="px-2 py-1 rounded text-xs {discount.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
                        {discount.isActive ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td class="py-2 px-2 text-right">
                      <button
                        on:click={() => openModal(discount)}
                        class="text-blue-600 hover:text-blue-800 mr-2 text-sm"
                      >
                        Editar
                      </button>
                      <button
                        on:click={() => deleteDiscount(discount.id)}
                        class="text-red-600 hover:text-red-800 text-sm"
                      >
                        Deletar
                      </button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      {/if}
    </div>
  </div>
{/if}

<!-- Modal -->
{#if showModal}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded-lg max-w-md w-full p-6">
      <h3 class="text-xl font-semibold mb-4">
        {editingDiscount ? 'Editar Desconto' : 'Novo Desconto'}
      </h3>

      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Variação *</label>
          <select
            bind:value={formData.serviceVariationId}
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
          >
            {#each variations as variation}
              <option value={variation.id}>{variation.name} - R$ {variation.price}</option>
            {/each}
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Dia da Semana *</label>
          <select
            bind:value={formData.dayOfWeek}
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
          >
            {#each daysOfWeek as day}
              <option value={day.value}>{day.label}</option>
            {/each}
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Percentual de Desconto (%) *</label>
          <input
            type="number"
            bind:value={formData.discountPercentage}
            min="0"
            max="100"
            step="0.01"
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Data de Início (opcional)</label>
          <input
            type="date"
            bind:value={formData.startDate}
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
          />
          <p class="text-xs text-gray-500 mt-1">Deixe em branco para desconto permanente</p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Data de Fim (opcional)</label>
          <input
            type="date"
            bind:value={formData.endDate}
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>

        <div>
          <label class="flex items-center gap-2">
            <input
              type="checkbox"
              bind:checked={formData.isActive}
              class="rounded"
            />
            <span class="text-sm text-gray-700">Ativo</span>
          </label>
        </div>
      </div>

      <div class="flex gap-3 mt-6">
        <button
          on:click={saveDiscount}
          class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
        >
          Salvar
        </button>
        <button
          on:click={closeModal}
          class="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition text-sm"
        >
          Cancelar
        </button>
      </div>
    </div>
  </div>
{/if}

