<script>
  import { onMount } from 'svelte';
  import api from '$lib/api';
  import { goto } from '$app/navigation';

  let serviceTypes = [];
  let name = '';
  let description = '';
  let serviceTypeId = '';
  let variations = [{ name: '', price: '', durationMinutes: '' }];
  let loading = false;
  let error = '';

  onMount(async () => {
    const response = await api.get('/service-types');
    serviceTypes = response.data.serviceTypes;
  });

  function addVariation() {
    variations = [...variations, { name: '', price: '', durationMinutes: '' }];
  }

  function removeVariation(index) {
    variations = variations.filter((_, i) => i !== index);
  }

  async function handleSubmit() {
    if (!name || !serviceTypeId || variations.length === 0) {
      error = 'Por favor, preencha todos os campos obrigatórios';
      return;
    }

    // Validar variações
    for (const variation of variations) {
      if (!variation.name || !variation.price || !variation.durationMinutes) {
        error = 'Por favor, preencha todos os campos das variações';
        return;
      }
    }

    try {
      loading = true;
      error = '';

      await api.post('/services', {
        name,
        description,
        serviceTypeId: parseInt(serviceTypeId),
        variations: variations.map(v => ({
          name: v.name,
          price: parseFloat(v.price),
          durationMinutes: parseInt(v.durationMinutes)
        }))
      });

      goto('/provider/services');
    } catch (err) {
      error = err.response?.data?.error || 'Erro ao criar serviço';
      if (err.response?.data?.errors) {
        error = err.response.data.errors.map(e => e.msg).join(', ');
      }
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Novo Serviço - Marketplace</title>
</svelte:head>

<div class="max-w-3xl mx-auto px-2 md:px-4">
  <h1 class="text-2xl md:text-3xl font-bold text-gray-900 mb-6 md:mb-8">Novo Serviço</h1>

  <div class="bg-white rounded-lg shadow-md p-4 md:p-8">
    {#if error}
      <div class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
        {error}
      </div>
    {/if}

    <form on:submit|preventDefault={handleSubmit} class="space-y-6">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Nome do Serviço *
        </label>
        <input
          type="text"
          bind:value={name}
          required
          class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Tipo de Serviço *
        </label>
        <select
          bind:value={serviceTypeId}
          required
          class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Selecione um tipo</option>
          {#each serviceTypes as type}
            <option value={type.id}>{type.name}</option>
          {/each}
        </select>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Descrição
        </label>
        <textarea
          bind:value={description}
          rows="4"
          class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        ></textarea>
      </div>

      <div>
        <div class="flex justify-between items-center mb-4">
          <label class="block text-sm font-medium text-gray-700">
            Variações *
          </label>
          <button
            type="button"
            on:click={addVariation}
            class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
          >
            Adicionar Variação
          </button>
        </div>

        <div class="space-y-4">
          {#each variations as variation, index}
            <div class="border border-gray-300 rounded-lg p-4">
              <div class="flex justify-between items-center mb-4">
                <h4 class="font-semibold">Variação {index + 1}</h4>
                {#if variations.length > 1}
                  <button
                    type="button"
                    on:click={() => removeVariation(index)}
                    class="text-red-600 hover:text-red-800"
                  >
                    Remover
                  </button>
                {/if}
              </div>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label class="block text-sm text-gray-600 mb-1">Nome *</label>
                  <input
                    type="text"
                    bind:value={variation.name}
                    placeholder="Ex: Pé, Mãos, etc."
                    class="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label class="block text-sm text-gray-600 mb-1">Preço (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    bind:value={variation.price}
                    placeholder="0.00"
                    class="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label class="block text-sm text-gray-600 mb-1">Duração (min) *</label>
                  <input
                    type="number"
                    bind:value={variation.durationMinutes}
                    placeholder="30"
                    class="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          {/each}
        </div>
      </div>

      <div class="flex gap-4">
        <button
          type="submit"
          disabled={loading}
          class="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? 'Criando...' : 'Criar Serviço'}
        </button>
        <a
          href="/provider/services"
          class="px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
        >
          Cancelar
        </a>
      </div>
    </form>
  </div>
</div>

