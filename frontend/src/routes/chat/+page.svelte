<script>
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import api from '$lib/api';
  import { authStore } from '$lib/stores/auth';
  import { notificationStore } from '$lib/stores/notifications';
  import { getSocket } from '$lib/socket';
  import { browser } from '$app/environment';

  let user = null;
  let conversations = [];
  let selectedConversation = null;
  let messages = [];
  let newMessage = '';
  let loading = true;
  let sending = false;
  let socket = null;
  let bookingInfo = null; // Informações do booking quando selecionado por bookingId

  authStore.subscribe((state) => {
    user = state.user;
  });

  onMount(async () => {
    await loadConversations();
    if (browser) {
      initSocket();
      
      // Se houver bookingId na URL, selecionar a conversa correspondente
      const bookingId = $page.url.searchParams.get('bookingId');
      if (bookingId) {
        const bookingIdNum = parseInt(bookingId);
        // Aguardar um pouco para garantir que as conversas foram carregadas
        setTimeout(async () => {
          let conversation = conversations.find(c => c.bookingId === bookingIdNum);
          
          // Se não encontrou, recarregar conversas (backend adiciona bookings confirmados sem mensagens)
          if (!conversation) {
            await loadConversations();
            conversation = conversations.find(c => c.bookingId === bookingIdNum);
          }
          
          if (conversation) {
            selectConversation(conversation);
          } else {
            // Se ainda não existe, buscar informações do booking para criar conversa temporária
            try {
              const bookingResponse = await api.get(`/bookings/${bookingIdNum}`);
              const booking = bookingResponse.data.booking;
              if (booking) {
                // Verificar se o booking está confirmado
                if (booking.status !== 'confirmed') {
                  notificationStore.error('O chat só está disponível para contratações confirmadas');
                  return;
                }
                
                // Criar conversa temporária (será adicionada à lista quando primeira mensagem for enviada)
                selectedConversation = {
                  id: `booking:${bookingIdNum}`,
                  bookingId: bookingIdNum,
                  bookingStatus: booking.status,
                  otherUser: user.role === 'provider' ? booking.client : booking.provider,
                  lastMessage: null,
                  unreadCount: 0
                };
                bookingInfo = booking;
                messages = []; // Iniciar com mensagens vazias
              }
            } catch (error) {
              console.error('Erro ao buscar booking:', error);
              notificationStore.error('Erro ao carregar informações da contratação');
            }
          }
        }, 300);
      }
    }
  });

  onDestroy(() => {
    if (socket) {
      socket.off('message-created');
    }
  });

  function initSocket() {
    if (!browser) return;
    socket = getSocket();
    if (socket) {
      socket.on('message-created', (data) => {
        console.log('📨 Mensagem recebida via WebSocket:', data);
        
        // Verificar se a mensagem pertence à conversa atual
        if (selectedConversation && data.message) {
          const message = data.message;
          const isCurrentConversation = 
            (data.bookingId && selectedConversation.bookingId === data.bookingId) ||
            (!data.bookingId && (
              (message.senderId === selectedConversation.otherUser.id && message.receiverId === user?.id) ||
              (message.receiverId === selectedConversation.otherUser.id && message.senderId === user?.id) ||
              (message.senderId === user?.id && message.receiverId === selectedConversation.otherUser.id)
            ));
          
          if (isCurrentConversation) {
            // Adicionar mensagem imediatamente à lista se não existir
            const messageExists = messages.some(m => m.id === message.id);
            if (!messageExists) {
              messages = [...messages, message];
              // Scroll para última mensagem
              setTimeout(() => {
                const container = document.getElementById('messages-container');
                if (container) {
                  container.scrollTop = container.scrollHeight;
                }
              }, 100);
            }
            // Recarregar para garantir sincronização completa
            setTimeout(() => loadMessages(), 500);
          } else {
            // Atualizar lista de conversas se não for a conversa atual
            loadConversations();
          }
        } else {
          // Se não há conversa selecionada, atualizar lista
          loadConversations();
        }
      });
    }
  }

  async function loadConversations() {
    try {
      loading = true;
      const response = await api.get('/messages/conversations');
      conversations = response.data.conversations || [];
      if (conversations.length > 0 && !selectedConversation) {
        selectConversation(conversations[0]);
      }
    } catch (error) {
      console.error('Erro ao carregar conversas:', error);
      notificationStore.error('Erro ao carregar conversas');
    } finally {
      loading = false;
    }
  }

  async function selectConversation(conversation) {
    selectedConversation = conversation;
    bookingInfo = null;
    
    // Se for conversa de booking, buscar informações atualizadas
    if (conversation.bookingId) {
      try {
        const bookingResponse = await api.get(`/bookings/${conversation.bookingId}`);
        bookingInfo = bookingResponse.data.booking;
      } catch (error) {
        console.error('Erro ao buscar booking:', error);
      }
    }
    
    await loadMessages();
    // Marcar como lida
    if (conversation.unreadCount > 0) {
      try {
        const params = conversation.bookingId 
          ? { bookingId: conversation.bookingId }
          : { otherUserId: conversation.otherUser.id };
        await api.put('/messages/read/conversation', null, { params });
        conversation.unreadCount = 0;
      } catch (error) {
        console.error('Erro ao marcar como lida:', error);
      }
    }
  }

  async function createConversationFromBooking(bookingId) {
    // Se não houver conversa ainda, criar uma mensagem inicial para iniciar a conversa
    // A conversa será criada automaticamente quando a primeira mensagem for enviada
    // Por enquanto, apenas recarregar as conversas
    await loadConversations();
    const conversation = conversations.find(c => c.bookingId === parseInt(bookingId));
    if (conversation) {
      selectConversation(conversation);
    }
  }

  async function loadMessages() {
    if (!selectedConversation) return;
    
    try {
      const params = selectedConversation.bookingId
        ? { bookingId: selectedConversation.bookingId }
        : { otherUserId: selectedConversation.otherUser.id };
      
      const response = await api.get('/messages', { params });
      messages = response.data.messages || [];
      
      // Scroll para última mensagem
      if (browser) {
        setTimeout(() => {
          const container = document.getElementById('messages-container');
          if (container) {
            container.scrollTop = container.scrollHeight;
          }
        }, 100);
      }
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
      notificationStore.error('Erro ao carregar mensagens');
    }
  }

  async function sendMessage() {
    if (!newMessage.trim() || !selectedConversation) return;
    
    // Verificar se o booking ainda está confirmado
    if (selectedConversation.bookingId) {
      if (bookingInfo && bookingInfo.status !== 'confirmed') {
        notificationStore.error('O chat foi encerrado pois a contratação foi concluída ou cancelada');
        await loadConversations(); // Recarregar para atualizar status
        return;
      }
    }

    try {
      sending = true;
      const data = {
        content: newMessage.trim()
      };

      if (selectedConversation.bookingId) {
        data.bookingId = selectedConversation.bookingId;
      } else {
        data.receiverId = selectedConversation.otherUser.id;
      }

      const response = await api.post('/messages', data);
      const newMessageData = response.data.message;
      
      // Adicionar mensagem imediatamente à lista (otimistic update)
      if (newMessageData && selectedConversation) {
        const messageExists = messages.some(m => m.id === newMessageData.id);
        if (!messageExists) {
          messages = [...messages, newMessageData];
          // Scroll para última mensagem
          setTimeout(() => {
            const container = document.getElementById('messages-container');
            if (container) {
              container.scrollTop = container.scrollHeight;
            }
          }, 100);
        }
      }
      
      newMessage = '';
      
      // Recarregar conversas para atualizar última mensagem
      await loadConversations();
      
      // Se a conversa não estava na lista antes, selecioná-la agora
      if (selectedConversation && selectedConversation.bookingId) {
        const updatedConversation = conversations.find(c => c.bookingId === selectedConversation.bookingId);
        if (updatedConversation) {
          selectedConversation = updatedConversation;
        }
      }
      
      // Recarregar mensagens para garantir sincronização completa
      await loadMessages();
      
      // Atualizar bookingInfo após enviar mensagem
      if (selectedConversation && selectedConversation.bookingId) {
        try {
          const bookingResponse = await api.get(`/bookings/${selectedConversation.bookingId}`);
          bookingInfo = bookingResponse.data.booking;
        } catch (error) {
          console.error('Erro ao atualizar booking:', error);
        }
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      const errorMessage = error.response?.data?.error || 'Erro ao enviar mensagem';
      notificationStore.error(errorMessage);
      
      // Se o erro for sobre booking não confirmado ou concluído, recarregar conversas
      if (errorMessage.includes('confirmada') || errorMessage.includes('encerrado') || errorMessage.includes('concluída')) {
        await loadConversations();
      }
    } finally {
      sending = false;
    }
  }
  
  $: chatDisabled = selectedConversation?.bookingId && bookingInfo && bookingInfo.status !== 'confirmed';

  function formatTime(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Hoje';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Ontem';
    } else {
      return date.toLocaleDateString('pt-BR');
    }
  }
</script>

<svelte:head>
  <title>Chat - Marketplace</title>
</svelte:head>

{#if !user}
  <div class="text-center py-12">
    <p class="text-gray-600">Você precisa estar logado para acessar o chat.</p>
  </div>
{:else if loading}
  <div class="text-center py-12">
    <p class="text-gray-600">Carregando conversas...</p>
  </div>
{:else}
  <div class="max-w-6xl mx-auto px-2 md:px-4 h-[calc(100vh-200px)] flex flex-col">
    <h1 class="text-2xl md:text-3xl font-bold text-gray-900 mb-4 md:mb-6">Chat</h1>
    
    <div class="flex-1 flex gap-4 bg-white rounded-lg shadow-md overflow-hidden">
      <!-- Lista de Conversas -->
      <div class="w-full md:w-80 border-r overflow-y-auto">
        {#if conversations.length === 0}
          <div class="p-4 text-center text-gray-600 text-sm">
            Nenhuma conversa ainda
          </div>
        {:else}
          {#each conversations as conversation}
            <button
              on:click={() => selectConversation(conversation)}
              class="w-full p-4 text-left hover:bg-gray-50 border-b {selectedConversation?.id === conversation.id ? 'bg-blue-50' : ''}"
            >
              <div class="flex items-start justify-between">
                <div class="flex-1 min-w-0">
                  <div class="font-semibold text-sm truncate">
                    {conversation.otherUser.name}
                  </div>
                  {#if conversation.bookingId}
                    <div class="text-xs text-gray-500 mt-1">
                      Contratação #{conversation.bookingId}
                    </div>
                  {/if}
                  {#if conversation.lastMessage}
                    <div class="text-xs text-gray-600 truncate mt-1">
                      {conversation.lastMessage.content}
                    </div>
                  {/if}
                </div>
                {#if conversation.unreadCount > 0}
                  <span class="ml-2 bg-blue-600 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                    {conversation.unreadCount}
                  </span>
                {/if}
              </div>
            </button>
          {/each}
        {/if}
      </div>

      <!-- Área de Mensagens -->
      <div class="flex-1 flex flex-col {!selectedConversation ? 'hidden md:flex' : ''}">
        {#if !selectedConversation}
          <div class="flex-1 flex items-center justify-center text-gray-500">
            Selecione uma conversa
          </div>
        {:else}
          <!-- Cabeçalho da Conversa -->
          <div class="p-4 border-b bg-gray-50">
            <div class="font-semibold">{selectedConversation.otherUser.name}</div>
            {#if selectedConversation.bookingId}
              <div class="text-sm text-gray-600">
                Contratação #{selectedConversation.bookingId}
              </div>
              {#if bookingInfo && bookingInfo.status === 'completed'}
                <div class="mt-2 px-3 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-medium">
                  ⚠️ Chat encerrado - Contratação concluída
                </div>
              {:else if bookingInfo && bookingInfo.status !== 'confirmed'}
                <div class="mt-2 px-3 py-1 bg-red-100 text-red-800 rounded text-xs font-medium">
                  ⚠️ Chat não disponível - Status: {bookingInfo.status}
                </div>
              {/if}
            {/if}
          </div>

          <!-- Mensagens -->
          <div id="messages-container" class="flex-1 overflow-y-auto p-4 space-y-4">
            {#each messages as message, index}
              {@const isMine = message.senderId === user.id}
              {@const showDate = index === 0 || formatDate(message.createdAt) !== formatDate(messages[index - 1].createdAt)}
              
              {#if showDate}
                <div class="text-center text-xs text-gray-500 my-4">
                  {formatDate(message.createdAt)}
                </div>
              {/if}

              <div class="flex {isMine ? 'justify-end' : 'justify-start'}">
                <div class="max-w-[70%] md:max-w-[60%]">
                  <div class="text-xs text-gray-500 mb-1 {isMine ? 'text-right' : 'text-left'}">
                    {isMine ? 'Você' : selectedConversation.otherUser.name} • {formatTime(message.createdAt)}
                  </div>
                  <div class="p-3 rounded-lg {isMine ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-900'}">
                    {message.content}
                  </div>
                </div>
              </div>
            {/each}
          </div>

          <!-- Input de Mensagem -->
          <div class="p-4 border-t bg-gray-50">
            {#if chatDisabled}
              <div class="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                O chat foi encerrado pois a contratação foi concluída ou cancelada.
              </div>
            {:else}
              <form
                on:submit|preventDefault={sendMessage}
                class="flex gap-2"
              >
                <input
                  type="text"
                  bind:value={newMessage}
                  placeholder="Digite sua mensagem..."
                  class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  disabled={sending || chatDisabled}
                />
                <button
                  type="submit"
                  disabled={sending || !newMessage.trim() || chatDisabled}
                  class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition text-sm"
                >
                  {sending ? 'Enviando...' : 'Enviar'}
                </button>
              </form>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

