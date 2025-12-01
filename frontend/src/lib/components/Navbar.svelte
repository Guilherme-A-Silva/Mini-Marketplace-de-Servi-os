<script>
  import { authStore } from '$lib/stores/auth';
  import { goto } from '$app/navigation';

  export let user;
  export let isAuthenticated;

  let mobileMenuOpen = false;

  function handleLogout() {
    authStore.logout();
    goto('/');
    mobileMenuOpen = false;
  }

  function toggleMobileMenu() {
    mobileMenuOpen = !mobileMenuOpen;
  }

  function closeMobileMenu() {
    mobileMenuOpen = false;
  }
</script>

<nav class="bg-white shadow-md fixed top-0 left-0 right-0 z-50">
  <div class="container mx-auto px-4">
    <div class="flex justify-between items-center h-16">
      <!-- Logo e menu desktop -->
      <div class="flex items-center">
        <a href="/" class="text-2xl font-bold text-blue-600">Marketplace</a>
        <!-- Menu desktop -->
        <div class="hidden md:flex md:items-center md:ml-8 md:space-x-6">
          <a href="/services" class="text-gray-700 hover:text-blue-600 transition">Serviços</a>
          {#if isAuthenticated && user?.role === 'provider'}
            <a href="/provider/dashboard" class="text-gray-700 hover:text-blue-600 transition">Painel</a>
          {/if}
          {#if isAuthenticated}
            <a href={user?.role === 'provider' ? '/provider/bookings' : '/bookings'} class="text-gray-700 hover:text-blue-600 transition">Minhas Contratações</a>
            <a href="/chat" class="text-gray-700 hover:text-blue-600 transition">Chat</a>
          {/if}
        </div>
      </div>

      <!-- Menu desktop - lado direito -->
      <div class="hidden md:flex md:items-center md:space-x-4">
        {#if isAuthenticated}
          <span class="text-gray-700 text-sm">Olá, {user?.name}</span>
          {#if user?.role === 'provider'}
            <a href="/provider/notifications" class="relative p-2 hover:bg-gray-100 rounded-full transition">
              <svg class="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </a>
          {/if}
          <button
            on:click={handleLogout}
            class="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition"
          >
            Sair
          </button>
        {:else}
          <a href="/login" class="px-4 py-2 text-gray-700 hover:text-blue-600 transition">Entrar</a>
          <a href="/register" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition">
            Cadastrar
          </a>
        {/if}
      </div>

      <!-- Botão hambúrguer mobile -->
      <button
        on:click={toggleMobileMenu}
        class="md:hidden p-2 rounded-md text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label="Toggle menu"
      >
        {#if mobileMenuOpen}
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        {:else}
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        {/if}
      </button>
    </div>

    <!-- Menu mobile -->
    {#if mobileMenuOpen}
      <div class="md:hidden border-t border-gray-200">
        <div class="px-2 pt-2 pb-3 space-y-1">
          <a
            href="/services"
            on:click={closeMobileMenu}
            class="block px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition"
          >
            Serviços
          </a>
          {#if isAuthenticated && user?.role === 'provider'}
            <a
              href="/provider/dashboard"
              on:click={closeMobileMenu}
              class="block px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition"
            >
              Painel
            </a>
          {/if}
          {#if isAuthenticated}
            <a
              href={user?.role === 'provider' ? '/provider/bookings' : '/bookings'}
              on:click={closeMobileMenu}
              class="block px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition"
            >
              Minhas Contratações
            </a>
            <a
              href="/chat"
              on:click={closeMobileMenu}
              class="block px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition"
            >
              Chat
            </a>
            {#if user?.role === 'provider'}
              <a
                href="/provider/notifications"
                on:click={closeMobileMenu}
                class="block px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition"
              >
                Notificações
              </a>
            {/if}
            <div class="border-t border-gray-200 pt-2 mt-2">
              <div class="px-3 py-2 text-sm text-gray-500">
                Olá, {user?.name}
              </div>
              <button
                on:click={handleLogout}
                class="w-full text-left px-3 py-2 text-red-600 hover:bg-red-50 rounded-md transition"
              >
                Sair
              </button>
            </div>
          {:else}
            <div class="border-t border-gray-200 pt-2 mt-2 space-y-1">
              <a
                href="/login"
                on:click={closeMobileMenu}
                class="block px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition"
              >
                Entrar
              </a>
              <a
                href="/register"
                on:click={closeMobileMenu}
                class="block px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition text-center"
              >
                Cadastrar
              </a>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</nav>

