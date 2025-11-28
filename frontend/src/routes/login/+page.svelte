<script>
  import { onMount } from 'svelte';
  import api from '$lib/api';
  import { authStore } from '$lib/stores/auth';
  import { goto } from '$app/navigation';

  let email = '';
  let password = '';
  let error = '';
  let loading = false;

  async function handleLogin() {
    if (!email || !password) {
      error = 'Por favor, preencha todos os campos';
      return;
    }

    try {
      loading = true;
      error = '';

      const response = await api.post('/auth/login', { email, password });
      authStore.login(response.data.user, response.data.token);

      // Redirecionar baseado no role
      if (response.data.user.role === 'provider') {
        goto('/provider/dashboard');
      } else {
        goto('/');
      }
    } catch (err) {
      console.error('Erro no login:', err);
      if (err.response) {
        error = err.response.data?.error || `Erro ${err.response.status}: ${err.response.statusText}`;
      } else if (err.request) {
        error = 'Não foi possível conectar ao servidor. Verifique se o backend está rodando.';
      } else {
        error = err.message || 'Erro ao fazer login';
      }
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Login - Marketplace</title>
</svelte:head>

<div class="max-w-md mx-auto mt-6 md:mt-12 px-4">
  <div class="bg-white rounded-lg shadow-md p-6 md:p-8">
    <h1 class="text-3xl font-bold text-gray-900 mb-6 text-center">Login</h1>

    {#if error}
      <div class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
        {error}
      </div>
    {/if}

    <form on:submit|preventDefault={handleLogin} class="space-y-4">
      <div>
        <label for="email" class="block text-sm font-medium text-gray-700 mb-2">
          Email
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
          Senha
        </label>
        <input
          type="password"
          id="password"
          bind:value={password}
          required
          class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        class="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
      >
        {loading ? 'Entrando...' : 'Entrar'}
      </button>
    </form>

    <p class="mt-4 text-center text-gray-600">
      Não tem uma conta?
      <a href="/register" class="text-blue-600 hover:underline">Cadastre-se</a>
    </p>
  </div>
</div>

