<script>
  import api from '$lib/api';
  import { authStore } from '$lib/stores/auth';
  import { goto } from '$app/navigation';

  let name = '';
  let email = '';
  let password = '';
  let confirmPassword = '';
  let role = 'client';
  let phone = '';
  let city = '';
  let neighborhood = '';
  let error = '';
  let loading = false;

  async function handleRegister() {
    if (!name || !email || !password) {
      error = 'Por favor, preencha todos os campos obrigatórios';
      return;
    }

    if (password !== confirmPassword) {
      error = 'As senhas não coincidem';
      return;
    }

    if (password.length < 6) {
      error = 'A senha deve ter no mínimo 6 caracteres';
      return;
    }

    try {
      loading = true;
      error = '';

      const response = await api.post('/auth/register', {
        name,
        email,
        password,
        role,
        phone,
        city,
        neighborhood
      });

      authStore.login(response.data.user, response.data.token);

      // Redirecionar baseado no role
      if (response.data.user.role === 'provider') {
        goto('/provider/dashboard');
      } else {
        goto('/');
      }
    } catch (err) {
      console.error('Erro no registro:', err);
      if (err.response) {
        error = err.response.data?.error || `Erro ${err.response.status}: ${err.response.statusText}`;
        if (err.response.data?.errors) {
          error = err.response.data.errors.map(e => e.msg).join(', ');
        }
      } else if (err.request) {
        error = 'Não foi possível conectar ao servidor. Verifique se o backend está rodando.';
      } else {
        error = err.message || 'Erro ao criar conta';
      }
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Cadastro - Marketplace</title>
</svelte:head>

<div class="max-w-md mx-auto mt-6 md:mt-12 px-4">
  <div class="bg-white rounded-lg shadow-md p-6 md:p-8">
    <h1 class="text-3xl font-bold text-gray-900 mb-6 text-center">Cadastro</h1>

    {#if error}
      <div class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
        {error}
      </div>
    {/if}

    <form on:submit|preventDefault={handleRegister} class="space-y-4">
      <div>
        <label for="name" class="block text-sm font-medium text-gray-700 mb-2">
          Nome *
        </label>
        <input
          type="text"
          id="name"
          bind:value={name}
          required
          class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label for="email" class="block text-sm font-medium text-gray-700 mb-2">
          Email *
        </label>
        <input
          type="email"
          id="email"
          bind:value={email}
          required
          class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label for="password" class="block text-sm font-medium text-gray-700 mb-2">
          Senha *
        </label>
        <input
          type="password"
          id="password"
          bind:value={password}
          required
          class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label for="confirmPassword" class="block text-sm font-medium text-gray-700 mb-2">
          Confirmar Senha *
        </label>
        <input
          type="password"
          id="confirmPassword"
          bind:value={confirmPassword}
          required
          class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label for="role" class="block text-sm font-medium text-gray-700 mb-2">
          Tipo de Conta *
        </label>
        <select
          id="role"
          bind:value={role}
          class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="client">Cliente</option>
          <option value="provider">Prestador</option>
        </select>
      </div>

      <div>
        <label for="phone" class="block text-sm font-medium text-gray-700 mb-2">
          Telefone
        </label>
        <input
          type="tel"
          id="phone"
          bind:value={phone}
          class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label for="city" class="block text-sm font-medium text-gray-700 mb-2">
          Cidade
        </label>
        <input
          type="text"
          id="city"
          bind:value={city}
          class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label for="neighborhood" class="block text-sm font-medium text-gray-700 mb-2">
          Bairro
        </label>
        <input
          type="text"
          id="neighborhood"
          bind:value={neighborhood}
          class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        class="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
      >
        {loading ? 'Cadastrando...' : 'Cadastrar'}
      </button>
    </form>

    <p class="mt-4 text-center text-gray-600">
      Já tem uma conta?
      <a href="/login" class="text-blue-600 hover:underline">Faça login</a>
    </p>
  </div>
</div>

