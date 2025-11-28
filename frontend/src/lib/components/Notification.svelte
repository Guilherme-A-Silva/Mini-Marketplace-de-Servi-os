<script>
  import { onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import { browser } from '$app/environment';

  export let message = '';
  export let type = 'info'; // info, success, error, warning
  export let duration = 5000; // 5 segundos por padrão
  export let notificationId = null;

  let visible = false;
  let timeoutId = null;

  function dispatchCloseEvent() {
    if (browser && typeof document !== 'undefined') {
      const closeEvent = new CustomEvent('notification-close', { 
        detail: { id: notificationId } 
      });
      document.dispatchEvent(closeEvent);
    }
  }

  onMount(() => {
    visible = true;
    
    if (duration > 0) {
      timeoutId = setTimeout(() => {
        visible = false;
        // Disparar evento de fechamento após a animação
        setTimeout(() => {
          dispatchCloseEvent();
        }, 300);
      }, duration);
    }
  });

  function close() {
    visible = false;
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    // Disparar evento de fechamento após a animação
    setTimeout(() => {
      dispatchCloseEvent();
    }, 300);
  }

  $: bgColor = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-yellow-500',
    info: 'bg-blue-500'
  }[type] || 'bg-blue-500';

  $: icon = {
    success: '✓',
    error: '✗',
    warning: '⚠',
    info: 'ℹ'
  }[type] || 'ℹ';
</script>

{#if visible}
  <div
    transition:fly={{ y: -100, duration: 300 }}
    class="relative z-50 min-w-[300px] max-w-[500px] w-full"
    role="alert"
  >
    <div class="flex items-center gap-3 {bgColor} text-white rounded-lg shadow-lg p-4">
      <div class="flex-shrink-0 text-2xl font-bold">
        {icon}
      </div>
      <div class="flex-1">
        <p class="text-sm font-medium">{message}</p>
      </div>
      <button
        on:click={close}
        class="flex-shrink-0 text-white hover:text-gray-200 transition"
        aria-label="Fechar notificação"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  </div>
{/if}

