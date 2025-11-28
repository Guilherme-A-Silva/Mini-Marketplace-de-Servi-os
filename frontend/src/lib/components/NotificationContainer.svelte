<script>
  import { notificationStore } from '$lib/stores/notifications';
  import Notification from './Notification.svelte';
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';

  function handleNotificationClose(event) {
    const id = event.detail?.id;
    if (id) {
      notificationStore.remove(id);
    }
  }

  onMount(() => {
    if (browser && typeof document !== 'undefined') {
      document.addEventListener('notification-close', handleNotificationClose);
    }
  });

  onDestroy(() => {
    if (browser && typeof document !== 'undefined') {
      document.removeEventListener('notification-close', handleNotificationClose);
    }
  });
</script>

<div class="fixed left-0 right-0 z-50 pointer-events-none" style="top: 80px;">
  {#each $notificationStore as notification, index (notification.id)}
    <div 
      class="pointer-events-auto flex justify-center"
      style="margin-top: {index * 90}px;"
    >
      <Notification
        message={notification.message}
        type={notification.type}
        duration={notification.duration}
        notificationId={notification.id}
      />
    </div>
  {/each}
</div>

