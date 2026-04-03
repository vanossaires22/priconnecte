/**
 * Priconnecte Messenger — Main Application Logic
 * Интеграция с Supabase: Auth, Realtime, Storage, Database
 * 
 * @version 1.0.0
 * @requires supabase-client.js, config.js
 */

'use strict';

// === Глобальное состояние приложения ===
const AppState = {
    currentUser: null,
    currentChat: null,
    activeTab: 'all',
    isRecording: false,
    recordingTimer: null,
    recordingStartTime: null,
    unsubscribeMessages: null,
    unsubscribePresence: null,
    messagePage: { before: null, hasMore: true },
    typingTimeout: null,
    contextMenuTarget: null
};

// === DOM Elements Cache ===
const DOM = {};

function cacheElements() {
    // Auth
    DOM.authContainer = document.getElementById('authContainer');
    DOM.appContainer = document.getElementById('appContainer');
    DOM.loginForm = document.getElementById('loginForm');
    DOM.registerForm = document.getElementById('registerForm');
    DOM.switchToRegister = document.getElementById('switchToRegister');
    DOM.switchToLogin = document.getElementById('switchToLogin');
    
    // Profile
    DOM.userProfileBtn = document.getElementById('userProfileBtn');
    DOM.userAvatar = document.getElementById('userAvatar');
    DOM.userName = document.getElementById('userName');
    DOM.userStatusText = document.getElementById('userStatusText');
    DOM.profileModal = document.getElementById('profileModal');
    DOM.closeProfile = document.getElementById('closeProfile');
    DOM.profileAvatarPreview = document.getElementById('profileAvatarPreview');
    DOM.profileName = document.getElementById('profileName');
    DOM.profileStatus = document.getElementById('profileStatus');
    DOM.saveProfile = document.getElementById('saveProfile');
    DOM.logoutBtn = document.getElementById('logoutBtn');
    DOM.avatarUpload = document.getElementById('avatarUpload');
    
    // Sidebar
    DOM.sidebar = document.getElementById('sidebar');
    DOM.contactsList = document.getElementById('contactsList');
    DOM.searchInput = document.getElementById('searchInput');
    DOM.tabs = document.querySelectorAll('.tab');
    DOM.newChatBtn = document.getElementById('newChatBtn');
    DOM.addContactBtn = document.getElementById('addContactBtn');
    DOM.settingsBtn = document.getElementById('settingsBtn');
    DOM.openSidebar = document.getElementById('openSidebar');
    
    // Chat Area
    DOM.messagesContainer = document.getElementById('messagesContainer');
    DOM.currentChatName = document.getElementById('currentChatName');
    DOM.currentAvatar = document.getElementById('currentAvatar');
    DOM.currentStatus = document.getElementById('currentStatus');
    DOM.messageInput = document.getElementById('messageInput');
    DOM.sendBtn = document.getElementById('sendBtn');
    DOM.emojiBtn = document.getElementById('emojiBtn');
    DOM.voiceBtn = document.getElementById('voiceBtn');
    DOM.videoBtn = document.getElementById('videoBtn');
    DOM.callBtn = document.getElementById('callBtn');
    DOM.videoCallBtn = document.getElementById('videoCallBtn');
    
    // Voice Recording
    DOM.voiceRecording = document.getElementById('voiceRecording');
    DOM.recordingTime = document.getElementById('recordingTime');
    DOM.stopRecording = document.getElementById('stopRecording');
    
    // Video Recording
    DOM.videoRecording = document.getElementById('videoRecording');
    DOM.videoPreview = document.getElementById('videoPreview');
    DOM.videoTime = document.getElementById('videoTime');
    DOM.cancelVideo = document.getElementById('cancelVideo');
    
    // Modals
    DOM.newChatModal = document.getElementById('newChatModal');
    DOM.closeNewChat = document.getElementById('closeNewChat');
    DOM.chatType = document.getElementById('chatType');
    DOM.newChatName = document.getElementById('newChatName');
    DOM.contactsSelect = document.getElementById('contactsSelect');
    DOM.confidentialChat = document.getElementById('confidentialChat');
    DOM.createChat = document.getElementById('createChat');
    
    DOM.addContactModal = document.getElementById('addContactModal');
    DOM.closeAddContact = document.getElementById('closeAddContact');
    DOM.contactSearch = document.getElementById('contactSearch');
    DOM.contactSearchResults = document.getElementById('contactSearchResults');
    DOM.contactUsername = document.getElementById('contactUsername');
    DOM.addContact = document.getElementById('addContact');
    
    DOM.settingsModal = document.getElementById('settingsModal');
    DOM.closeSettings = document.getElementById('closeSettings');
    DOM.themeSelect = document.getElementById('themeSelect');
    DOM.notificationsToggle = document.getElementById('notificationsToggle');
    
    DOM.callModal = document.getElementById('callModal');
    DOM.callAvatar = document.getElementById('callAvatar');
    DOM.callUserName = document.getElementById('callUserName');
    DOM.callStatus = document.getElementById('callStatus');
    DOM.muteCall = document.getElementById('muteCall');
    DOM.toggleVideo = document.getElementById('toggleVideo');
    DOM.endCall = document.getElementById('endCall');
    DOM.localVideo = document.getElementById('localVideo');
    DOM.remoteVideo = document.getElementById('remoteVideo');
    
    // Context Menu & Notifications
    DOM.messageContextMenu = document.getElementById('messageContextMenu');
    DOM.notificationsContainer = document.getElementById('notificationsContainer');
    
    // Chat Header
    DOM.chatMenuBtn = document.getElementById('chatMenuBtn');
}

// === Инициализация приложения ===
async function init() {
    console.log('🚀 Priconnecte initializing...');
    
    cacheElements();
    bindEvents();
    loadTheme();
    
    // Подписка на изменения аутентификации
    Auth.onAuthStateChange(handleAuthChange);
    
    // Проверка текущей сессии
    try {
        const user = await DB.getCurrentUser();
        if (user) {
            await onUserSignedIn(user);
        } else {
            showAuth();
        }
    } catch (err) {
        console.error('Auth check failed:', err);
        showAuth();
    }
    
    // PWA: Регистрация Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('✅ SW registered:', reg.scope))
            .catch(err => console.warn('⚠️ SW registration failed:', err));
    }
    
    console.log('✅ Priconnecte initialized');
}

// === Обработчик изменений аутентификации ===
async function handleAuthChange(event, user) {
    console.log('🔄 Auth event:', event);
    
    switch (event) {
        case 'SIGNED_IN':
            await onUserSignedIn(user);
            break;
        case 'SIGNED_OUT':
            onUserSignedOut();
            break;
        case 'USER_UPDATED':
            if (AppState.currentUser?.id === user?.id) {
                await loadUserProfile(user.id);
            }
            break;
        case 'TOKEN_REFRESHED':
            console.log('🔄 Token refreshed');
            break;
    }
}

// === Пользователь вошёл ===
async function onUserSignedIn(user) {
    console.log('✅ User signed in:', user.id);
    AppState.currentUser = user;
    
    try {
        // Загружаем профиль
        await loadUserProfile(user.id);
        
        // Загружаем чаты
        await loadChats(AppState.activeTab);
        
        // Подписываемся на presence
        setupPresenceSubscription(user.id);
        
        // Показываем приложение
        showApp();
        
        // Отправляем онлайн-статус
        await updateLastSeen(user.id, true);
        
    } catch (err) {
        console.error('Failed to load user data:', err);
        showNotification('Ошибка загрузки данных', 'error');
        showAuth();
    }
}

// === Пользователь вышел ===
function onUserSignedOut() {
    console.log('👋 User signed out');
    
    // Отписываемся от realtime
    if (AppState.unsubscribeMessages) AppState.unsubscribeMessages();
    if (AppState.unsubscribePresence) AppState.unsubscribePresence();
    
    // Сбрасываем состояние
    AppState.currentUser = null;
    AppState.currentChat = null;
    AppState.messagePage = { before: null, hasMore: true };
    
    // Очищаем UI
    DOM.contactsList.innerHTML = '';
    DOM.messagesContainer.innerHTML = getWelcomeMessageHTML();
    
    // Показываем авторизацию
    showAuth();
}

// === Загрузка профиля пользователя ===
async function loadUserProfile(userId) {
    try {
        const profile = await DB.getProfile(userId);
        
        if (profile) {
            // Обновляем UI профиля
            DOM.userName.textContent = profile.display_name || 'Пользователь';
            DOM.userStatusText.textContent = profile.status || 'Онлайн';
            DOM.userAvatar.src = profile.avatar_url || '/assets/icons/default-avatar.svg';
            
            // Заполняем модальное редактирования
            DOM.profileName.value = profile.display_name || '';
            DOM.profileStatus.value = profile.status || '';
            DOM.profileAvatarPreview.src = profile.avatar_url || '/assets/icons/default-avatar.svg';
            
            // Применяем тему
            if (profile.theme) {
                document.documentElement.setAttribute('data-theme', profile.theme);
                DOM.themeSelect.value = profile.theme;
            }
            
            // Уведомления
            if (profile.notifications_enabled !== undefined) {
                DOM.notificationsToggle.checked = profile.notifications_enabled;
            }
        }
    } catch (err) {
        console.error('Failed to load profile:', err);
    }
}

// === Загрузка списка чатов ===
async function loadChats(tab = 'all') {
    if (!AppState.currentUser) return;
    
    try {
        showLoading(DOM.contactsList, 'Загрузка чатов...');
        
        const chats = await DB.getUserChats(AppState.currentUser.id, tab);
        
        if (!chats || chats.length === 0) {
            DOM.contactsList.innerHTML = '<div class="empty-list">Нет чатов</div>';
            return;
        }
        
        renderChatList(chats);
        
    } catch (err) {
        console.error('Failed to load chats:', err);
        DOM.contactsList.innerHTML = '<div class="error">Ошибка загрузки</div>';
        showNotification('Не удалось загрузить чаты', 'error');
    }
}

// === Рендер списка чатов ===
function renderChatList(chats) {
    const fragment = document.createDocumentFragment();
    const searchTerm = DOM.searchInput?.value.toLowerCase() || '';
    
    const filtered = chats.filter(item => {
        const chat = item.chats;
        const name = chat.name?.toLowerCase() || '';
        const lastMsg = chat.last_message?.toLowerCase() || '';
        return name.includes(searchTerm) || lastMsg.includes(searchTerm);
    });
    
    if (filtered.length === 0) {
        DOM.contactsList.innerHTML = '<div class="empty-list">Ничего не найдено</div>';
        return;
    }
    
    filtered.forEach(item => {
        const chat = item.chats;
        const el = document.createElement('div');
        el.className = 'contact-item';
        el.dataset.chatId = chat.id;
        el.dataset.chatType = chat.type;
        el.tabIndex = 0;
        el.role = 'button';
        el.setAttribute('aria-label', `Чат с ${chat.name}`);
        
        const lastMsg = chat.last_message || 'Нет сообщений';
        const time = chat.updated_at ? formatRelativeTime(chat.updated_at) : '';
        const isEncrypted = chat.is_encrypted ? '<i class="ri-lock-line encrypted-badge"></i>' : '';
        
        el.innerHTML = `
            <img src="${chat.avatar_url || '/assets/icons/default-chat.svg'}" 
                 alt="${chat.name}" class="contact-avatar">
            <div class="contact-info">
                <div class="contact-header">
                    <span class="contact-name">${escapeHtml(chat.name)}</span>
                    <span class="contact-time">${time}</span>
                </div>
                <div class="contact-preview">
                    <span class="preview-text">${escapeHtml(lastMsg.substring(0, 40))}${lastMsg.length > 40 ? '...' : ''}</span>
                    ${isEncrypted}
                </div>
            </div>
        `;
        
        el.addEventListener('click', () => openChat(chat.id));
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openChat(chat.id);
            }
        });
        
        fragment.appendChild(el);
    });
    
    DOM.contactsList.innerHTML = '';
    DOM.contactsList.appendChild(fragment);
}

// === Открытие чата ===
async function openChat(chatId) {
    if (!AppState.currentUser) return;
    
    try {
        // Отписываемся от предыдущего чата
        if (AppState.unsubscribeMessages) {
            AppState.unsubscribeMessages();
            AppState.unsubscribeMessages = null;
        }
        
        // Сбрасываем пагинацию
        AppState.messagePage = { before: null, hasMore: true };
        
        // Загружаем информацию о чате
        const {  chatData, error } = await supabase
            .from(SUPABASE_CONFIG.tables.chats)
            .select('*')
            .eq('id', chatId)
            .single();
        
        if (error) throw error;
        
        AppState.currentChat = chatData;
        
        // Обновляем UI заголовка
        DOM.currentChatName.textContent = chatData.name || 'Чат';
        DOM.currentAvatar.src = chatData.avatar_url || '/assets/icons/default-chat.svg';
        DOM.currentStatus.textContent = 'Онлайн'; // TODO: реальный статус
        
        // Показываем индикатор загрузки
        DOM.messagesContainer.innerHTML = '<div class="loading-messages">Загрузка сообщений...</div>';
        
        // Загружаем сообщения
        await loadMessages(chatId);
        
        // Подписываемся на новые сообщения
        AppState.unsubscribeMessages = DB.subscribeToMessages(chatId, handleNewMessage);
        
        // Прокручиваем вниз
        scrollToBottom();
        
        // Мобильная навигация
        if (window.innerWidth < 768) {
            DOM.appContainer.classList.add('chat-active');
        }
        
        // Отмечаем как прочитанные (оптимистично)
        markChatAsRead(chatId);
        
    } catch (err) {
        console.error('Failed to open chat:', err);
        showNotification('Не удалось открыть чат', 'error');
    }
}

// === Загрузка сообщений с пагинацией ===
async function loadMessages(chatId, loadMore = false) {
    try {
        const limit = 50;
        const before = loadMore ? AppState.messagePage.before : null;
        
        const messages = await DB.getMessages(chatId, limit, before);
        
        if (messages.length === 0 && !loadMore) {
            DOM.messagesContainer.innerHTML = getWelcomeMessageHTML();
            return;
        }
        
        if (loadMore) {
            // Вставляем новые сообщения в начало
            const fragment = document.createDocumentFragment();
            messages.reverse().forEach(msg => {
                fragment.prepend(renderMessage(msg));
            });
            DOM.messagesContainer.querySelector('.loading-more')?.remove();
            DOM.messagesContainer.insertBefore(fragment, DOM.messagesContainer.firstChild);
        } else {
            // Полная замена
            DOM.messagesContainer.innerHTML = messages.map(renderMessage).join('');
        }
        
        // Обновляем состояние пагинации
        AppState.messagePage.hasMore = messages.length === limit;
        if (messages.length > 0) {
            AppState.messagePage.before = messages[0].created_at;
        }
        
        // Обработчик бесконечного скролла
        if (!loadMore) {
            setupInfiniteScroll();
        }
        
    } catch (err) {
        console.error('Failed to load messages:', err);
        if (!loadMore) {
            DOM.messagesContainer.innerHTML = '<div class="error">Ошибка загрузки сообщений</div>';
        }
    }
}

// === Рендер одного сообщения ===
function renderMessage(msg) {
    const isOwn = msg.sender_id === AppState.currentUser?.id;
    const profile = msg.profiles || {};
    const isEncrypted = AppState.currentChat?.is_encrypted;
    
    // Тип контента
    let contentHTML = '';
    switch (msg.content_type) {
        case 'image':
            contentHTML = `<img src="${msg.content}" class="message-image" alt="Изображение" loading="lazy">`;
            break;
        case 'video':
            contentHTML = `<video src="${msg.content}" class="message-video" controls></video>`;
            break;
        case 'voice':
            contentHTML = `
                <div class="voice-message">
                    <button class="voice-play-btn" data-url="${msg.content}">
                        <i class="ri-play-fill"></i>
                    </button>
                    <span class="voice-duration">${formatDuration(msg.duration)}</span>
                </div>
            `;
            break;
        case 'file':
            contentHTML = `
                <a href="${msg.content}" class="file-attachment" download>
                    <i class="ri-file-line"></i>
                    <span>Файл</span>
                </a>
            `;
            break;
        default:
            contentHTML = `<div class="message-text">${escapeHtml(msg.content)}</div>`;
    }
    
    // Ответ на сообщение
    const replyHTML = msg.reply_to_id ? `
        <div class="message-reply">
            <i class="ri-reply-line"></i>
            <span>Ответ на сообщение</span>
        </div>
    ` : '';
    
    // Статус доставки
    const statusHTML = isOwn ? `
        <span class="message-status">
            <i class="ri-check-line"></i>
        </span>
    ` : '';
    
    return `
        <div class="message ${isOwn ? 'message-own' : 'message-other'}" 
             data-message-id="${msg.id}"
             data-sender-id="${msg.sender_id}"
             role="article"
             tabindex="0">
            ${!isOwn ? `
                <img src="${profile.avatar_url || '/assets/icons/default-avatar.svg'}" 
                     class="message-avatar" alt="${profile.display_name}">
            ` : ''}
            <div class="message-bubble glass-panel">
                ${!isOwn && msg.content_type !== 'voice' ? `
                    <div class="message-sender">${escapeHtml(profile.display_name || 'Пользователь')}</div>
                ` : ''}
                ${replyHTML}
                ${contentHTML}
                <div class="message-meta">
                    <span class="message-time">${formatTime(msg.created_at)}</span>
                    ${isEncrypted ? '<i class="ri-lock-line" title="E2EE"></i>' : ''}
                    ${statusHTML}
                </div>
            </div>
            <div class="message-actions">
                <button class="icon-btn message-react-btn" title="Реакция">
                    <i class="ri-emotion-line"></i>
                </button>
                <button class="icon-btn message-more-btn" title="Ещё">
                    <i class="ri-more-2-fill"></i>
                </button>
            </div>
        </div>
    `;
}

// === Обработка нового сообщения (Realtime) ===
function handleNewMessage(newMessage) {
    // Игнорируем если не в текущем чате
    if (newMessage.chat_id !== AppState.currentChat?.id) {
        // Показываем уведомление если чат не активен
        if (DOM.notificationsToggle.checked) {
            showNotification(`Новое сообщение в чате`, 'info', {
                icon: 'ri-chat-smile-2-line',
                action: () => openChat(newMessage.chat_id)
            });
        }
        return;
    }
    
    // Добавляем в UI
    const messageEl = document.createElement('div');
    messageEl.innerHTML = renderMessage(newMessage);
    const messageNode = messageEl.firstElementChild;
    
    DOM.messagesContainer.appendChild(messageNode);
    scrollToBottom();
    
    // Воспроизводим звук если не в фокусе
    if (document.hidden && DOM.notificationsToggle.checked) {
        playNotificationSound();
    }
    
    // Отмечаем как прочитанное если окно активно
    if (!document.hidden) {
        markChatAsRead(newMessage.chat_id);
    }
}

// === Отправка сообщения ===
async function sendMessage() {
    const text = DOM.messageInput.value.trim();
    if (!text || !AppState.currentChat) return;
    
    const input = DOM.messageInput;
    input.disabled = true;
    DOM.sendBtn.classList.add('sending');
    
    try {
        await DB.sendMessage(
            AppState.currentChat.id,
            AppState.currentUser.id,
            text,
            { type: 'text' }
        );
        
        input.value = '';
        input.style.height = 'auto';
        stopTypingIndicator();
        
    } catch (err) {
        console.error('Send failed:', err);
        showNotification('Не удалось отправить сообщение', 'error');
        
        // Optimistic rollback could be implemented here
    } finally {
        input.disabled = false;
        DOM.sendBtn.classList.remove('sending');
        input.focus();
    }
}

// === Индикатор набора текста ===
function startTypingIndicator() {
    if (!AppState.currentChat) return;
    
    // Отправляем событие typing через realtime (можно расширить)
    // Для MVP просто локальный таймер
    clearTimeout(AppState.typingTimeout);
    
    // TODO: Реализовать через Supabase Realtime broadcast
}

function stopTypingIndicator() {
    clearTimeout(AppState.typingTimeout);
    // TODO: Отправить stop typing
}

// === Голосовые сообщения ===
let mediaRecorder = null;
let audioChunks = [];

async function sendVoiceMessage(blob) {
  if (!AppState.currentChat) return;
  
  try {  // ← Убедитесь что try есть в начале
    // Загружаем файл в Storage
    const fileName = `${AppState.currentUser.id}/voice/${Date.now()}.webm`;
    const { error: uploadError } = await supabase.storage
      .from(SUPABASE_CONFIG.storage.voice)
      .upload(fileName, blob, { contentType: 'audio/webm' });

    if (uploadError) throw uploadError;

    // Получаем публичный URL
    const { data: { publicUrl } } = supabase.storage
      .from(SUPABASE_CONFIG.storage.voice)
      .getPublicUrl(fileName);

    // Отправляем сообщение с ссылкой
    await DB.sendMessage(
      AppState.currentChat.id,
      AppState.currentUser.id,
      publicUrl,
      { 
        type: 'voice',
        duration: Math.floor((Date.now() - AppState.recordingStartTime) / 1000)
      }
    );
    
  } catch (err) {  // ← Обязательный catch блок
    console.error('Voice send failed:', err);
    showNotification('Не удалось отправить голосовое', 'error');
  } finally {  // ← Опциональный finally
    // Сброс состояния записи
    AppState.isRecording = false;
    stopRecordingTimer();
    DOM.voiceRecording.style.display = 'none';
    DOM.messageInput.parentElement.style.display = 'flex';
  }
}

function stopVoiceRecording() {
    if (mediaRecorder && AppState.isRecording) {
        mediaRecorder.stop();
        AppState.isRecording = false;
        stopRecordingTimer();
        
        DOM.voiceRecording.style.display = 'none';
        DOM.messageInput.parentElement.style.display = 'flex';
    }
}

function startRecordingTimer() {
    AppState.recordingTimer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - AppState.recordingStartTime) / 1000);
        DOM.recordingTime.textContent = formatDuration(elapsed);
    }, 1000);
}

function stopRecordingTimer() {
    clearInterval(AppState.recordingTimer);
    DOM.recordingTime.textContent = '00:00';
}

async function sendVoiceMessage(blob) {
    if (!AppState.currentChat) return;
    
    try {
        // Загружаем файл в Storage
        const fileName = `${AppState.currentUser.id}/voice/${Date.now()}.webm`;
        const { error: uploadError } = await supabase.storage
            .from(SUPABASE_CONFIG.storage.voice)
            .upload(fileName, blob, { contentType: 'audio/webm' });
        
        if (uploadError) throw uploadError;
        
        // Получаем публичный URL
        const { data: { publicUrl } } = supabase.storage
  .from(SUPABASE_CONFIG.storage.voice)
  .getPublicUrl(fileName);
            from(SUPABASE_CONFIG.storage.voice)
            .getPublicUrl(fileName);
        
        // Отправляем сообщение с ссылкой
        await DB.sendMessage(
            AppState.currentChat.id,
            AppState.currentUser.id,
            publicUrl,
            { 
                type: 'voice',
                duration: Math.floor((Date.now() - AppState.recordingStartTime) / 1000)
            }
        );
        
    } catch (err) {
        console.error('Voice send failed:', err);
        showNotification('Не удалось отправить голосовое', 'error');
    }
}

// === Видео сообщения (упрощённо) ===
let videoStream = null;

async function startVideoRecording() {
    try {
        videoStream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 640, height: 480 },
            audio: true 
        });
        
        DOM.videoPreview.srcObject = videoStream;
        DOM.videoRecording.style.display = 'flex';
        
        // Авто-отмена через 60 сек для MVP
        setTimeout(() => {
            if (DOM.videoRecording.style.display !== 'none') {
                cancelVideoRecording();
            }
        }, 60000);
        
    } catch (err) {
        console.error('Camera access denied:', err);
        showNotification('Доступ к камере запрещён', 'error');
    }
}

function cancelVideoRecording() {
    if (videoStream) {
        videoStream.getTracks().forEach(t => t.stop());
        videoStream = null;
    }
    DOM.videoRecording.style.display = 'none';
    DOM.videoPreview.srcObject = null;
}

// === Бесконечный скролл сообщений ===
function setupInfiniteScroll() {
    DOM.messagesContainer.addEventListener('scroll', async function handler() {
        if (this.scrollTop < 100 && AppState.messagePage.hasMore) {
            this.removeEventListener('scroll', handler);
            
            // Показываем индикатор
            const loader = document.createElement('div');
            loader.className = 'loading-more';
            loader.innerHTML = '<i class="ri-loader-4-line spin"></i> Загрузка...';
            DOM.messagesContainer.insertBefore(loader, DOM.messagesContainer.firstChild);
            
            await loadMessages(AppState.currentChat.id, true);
            
            // Восстанавливаем позицию скролла
            loader.remove();
            this.addEventListener('scroll', handler);
        }
    }, { passive: true });
}

// === Прокрутка вниз ===
function scrollToBottom() {
    DOM.messagesContainer.scrollTo({
        top: DOM.messagesContainer.scrollHeight,
        behavior: 'smooth'
    });
}

// === Контекстное меню сообщения ===
function showMessageContextMenu(event, messageId) {
    event.preventDefault();
    AppState.contextMenuTarget = messageId;
    
    const menu = DOM.messageContextMenu;
    const rect = event.target.getBoundingClientRect();
    
    // Позиционирование
    menu.style.left = `${Math.min(rect.right, window.innerWidth - 200)}px`;
    menu.style.top = `${rect.bottom + 5}px`;
    menu.style.display = 'block';
    menu.setAttribute('aria-hidden', 'false');
    
    // Обработчики действий
    const handleAction = (action) => {
        hideMessageContextMenu();
        switch (action) {
            case 'reply':
                startReply(messageId);
                break;
            case 'edit':
                startEdit(messageId);
                break;
            case 'forward':
                startForward(messageId);
                break;
            case 'delete':
                deleteMessage(messageId);
                break;
        }
    };
    
    menu.querySelectorAll('.context-item').forEach(btn => {
        btn.onclick = () => handleAction(btn.dataset.action);
    });
    
    // Закрытие по клику вне
    const closeHandler = (e) => {
        if (!menu.contains(e.target)) {
            hideMessageContextMenu();
            document.removeEventListener('click', closeHandler);
        }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 0);
}

function hideMessageContextMenu() {
    DOM.messageContextMenu.style.display = 'none';
    DOM.messageContextMenu.setAttribute('aria-hidden', 'true');
    AppState.contextMenuTarget = null;
}

// === Действия с сообщениями ===
async function deleteMessage(messageId) {
    if (!confirm('Удалить сообщение?')) return;
    
    try {
        await DB.deleteMessage(messageId, AppState.currentUser.id);
        
        // Удаляем из UI
        const msgEl = DOM.messagesContainer.querySelector(`[data-message-id="${messageId}"]`);
        if (msgEl) {
            msgEl.style.opacity = '0';
            setTimeout(() => msgEl.remove(), 200);
        }
        
        showNotification('Сообщение удалено', 'success');
    } catch (err) {
        console.error('Delete failed:', err);
        showNotification('Ошибка удаления', 'error');
    }
}

function startReply(messageId) {
    const msgEl = DOM.messagesContainer.querySelector(`[data-message-id="${messageId}"]`);
    if (!msgEl) return;
    
    const text = msgEl.querySelector('.message-text')?.textContent || 'Сообщение';
    const sender = msgEl.querySelector('.message-sender')?.textContent || 'Пользователь';
    
    // Показываем контекст в input
    DOM.messageInput.dataset.replyTo = messageId;
    DOM.messageInput.placeholder = `Ответ ${sender}: ${text.substring(0, 30)}...`;
    DOM.messageInput.focus();
}

function startEdit(messageId) {
    const msgEl = DOM.messagesContainer.querySelector(`[data-message-id="${messageId}"]`);
    const textEl = msgEl?.querySelector('.message-text');
    if (!textEl) return;
    
    const original = textEl.textContent;
    const input = document.createElement('textarea');
    input.className = 'edit-input';
    input.value = original;
    
    textEl.replaceWith(input);
    input.focus();
    input.select();
    
    const save = async () => {
        const newText = input.value.trim();
        if (newText && newText !== original) {
            // TODO: Реализовать редактирование через API
            textEl.textContent = newText + ' (изменено)';
            showNotification('Сообщение изменено', 'success');
        } else {
            textEl.textContent = original;
        }
        input.remove();
    };
    
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            save();
        }
        if (e.key === 'Escape') {
            textEl.textContent = original;
            input.remove();
        }
    });
    input.addEventListener('blur', save);
}

function startForward(messageId) {
    // TODO: Реализовать выбор чата для пересылки
    showNotification('Функция пересылки в разработке', 'info');
}

// === Создание нового чата ===
async function createNewChat() {
    const name = DOM.newChatName.value.trim();
    const type = DOM.chatType.value;
    const isEncrypted = DOM.confidentialChat.checked;
    
    if (!name) {
        showNotification('Введите название чата', 'error');
        return;
    }
    
    try {
        const chat = await DB.createChat(
            AppState.currentUser.id,
            name,
            type,
            [], // TODO: добавить выбор участников
            isEncrypted
        );
        
        hideModal(DOM.newChatModal);
        DOM.newChatName.value = '';
        
        // Переходим в новый чат
        await loadChats(AppState.activeTab);
        openChat(chat.id);
        
        showNotification(`Чат "${name}" создан`, 'success');
        
    } catch (err) {
        console.error('Create chat failed:', err);
        showNotification('Ошибка создания чата', 'error');
    }
}

// === Поиск контактов ===
let searchTimeout;
DOM.contactSearch?.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        searchContacts(e.target.value);
    }, 300);
});

async function searchContacts(query) {
    if (query.length < 2) {
        DOM.contactSearchResults.innerHTML = '';
        return;
    }
    
    try {
        const {  profiles, error } = await supabase
            .from(SUPABASE_CONFIG.tables.profiles)
            .select('user_id, display_name, username, avatar_url')
            .or(`display_name.ilike.%${query}%,username.ilike.%${query}%`)
            .neq('user_id', AppState.currentUser?.id)
            .limit(10);
        
        if (error) throw error;
        
        if (profiles.length === 0) {
            DOM.contactSearchResults.innerHTML = '<div class="empty">Ничего не найдено</div>';
            return;
        }
        
        DOM.contactSearchResults.innerHTML = profiles.map(p => `
            <div class="search-result-item" data-user-id="${p.user_id}" tabindex="0">
                <img src="${p.avatar_url || '/assets/icons/default-avatar.svg'}" class="avatar-small">
                <div>
                    <div class="result-name">${escapeHtml(p.display_name)}</div>
                    ${p.username ? `<div class="result-username">@${escapeHtml(p.username)}</div>` : ''}
                </div>
            </div>
        `).join('');
        
        // Обработчики выбора
        DOM.contactSearchResults.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                DOM.contactUsername.value = item.dataset.userId;
                DOM.contactSearchResults.innerHTML = '';
            });
        });
        
    } catch (err) {
        console.error('Search failed:', err);
        DOM.contactSearchResults.innerHTML = '<div class="error">Ошибка поиска</div>';
    }
}

// === Добавление контакта ===
DOM.addContact?.addEventListener('click', async () => {
    const username = DOM.contactUsername.value.trim().replace('@', '');
    if (!username) {
        showNotification('Введите username', 'error');
        return;
    }
    
    try {
        // Ищем пользователя
        const {  profile, error } = await supabase
            .from(SUPABASE_CONFIG.tables.profiles)
            .select('user_id, display_name')
            .eq('username', username)
            .single();
        
        if (error || !profile) {
            showNotification('Пользователь не найден', 'error');
            return;
        }
        
        // Создаём приватный чат если нет
        const chat = await DB.createChat(
            AppState.currentUser.id,
            profile.display_name,
            'private',
            [profile.user_id]
        );
        
        hideModal(DOM.addContactModal);
        DOM.contactUsername.value = '';
        
        await loadChats('all');
        openChat(chat.id);
        
        showNotification(`Контакт добавлен`, 'success');
        
    } catch (err) {
        console.error('Add contact failed:', err);
        showNotification('Ошибка добавления', 'error');
    }
});

// === Настройки ===
DOM.saveProfile?.addEventListener('click', async () => {
    const updates = {
        display_name: DOM.profileName.value.trim(),
        status: DOM.profileStatus.value.trim(),
        theme: DOM.themeSelect.value,
        notifications_enabled: DOM.notificationsToggle.checked,
        updated_at: new Date()
    };
    
    try {
        await DB.updateProfile(AppState.currentUser.id, updates);
        
        // Обновляем UI
        DOM.userName.textContent = updates.display_name || 'Пользователь';
        DOM.userStatusText.textContent = updates.status || 'Онлайн';
        
        if (updates.theme) {
            document.documentElement.setAttribute('data-theme', updates.theme);
        }
        
        hideModal(DOM.profileModal);
        showNotification('Профиль обновлён', 'success');
        
    } catch (err) {
        console.error('Update failed:', err);
        showNotification('Ошибка сохранения', 'error');
    }
});

// === Загрузка аватара ===
DOM.avatarUpload?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Валидация
    if (!file.type.startsWith('image/')) {
        showNotification('Только изображения', 'error');
        return;
    }
    if (file.size > 5 * 1024 * 1024) {
        showNotification('Максимум 5MB', 'error');
        return;
    }
    
    try {
        showNotification('Загрузка...', 'info');
        
        const url = await DB.uploadAvatar(file, AppState.currentUser.id);
        await DB.updateProfile(AppState.currentUser.id, { avatar_url: url });
        
        // Обновляем UI
        DOM.userAvatar.src = url;
        DOM.profileAvatarPreview.src = url;
        
        showNotification('Аватар обновлён', 'success');
        
    } catch (err) {
        console.error('Avatar upload failed:', err);
        showNotification('Ошибка загрузки', 'error');
    }
    
    // Сброс input
    e.target.value = '';
});

// === Тема ===
DOM.themeSelect?.addEventListener('change', (e) => {
    const theme = e.target.value;
    document.documentElement.setAttribute('data-theme', theme);
    
    // Сохраняем при следующем сохранении профиля
});

// === Уведомления системы ===
function showNotification(message, type = 'info', options = {}) {
    const toast = document.createElement('div');
    toast.className = `notification notification-${type}`;
    toast.setAttribute('role', 'alert');
    
    toast.innerHTML = `
        <i class="${options.icon || getNotificationIcon(type)}"></i>
        <span>${escapeHtml(message)}</span>
        ${options.action ? `<button class="notification-action">${options.actionText || 'Открыть'}</button>` : ''}
    `;
    
    DOM.notificationsContainer.appendChild(toast);
    
    // Анимация появления
    requestAnimationFrame(() => toast.classList.add('show'));
    
    // Авто-удаление
    const timeout = setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
    
    // Обработчик действия
    if (options.action) {
        toast.querySelector('.notification-action').onclick = () => {
            clearTimeout(timeout);
            toast.remove();
            options.action();
        };
    }
    
    // Звук для важных уведомлений
    if (type === 'error' || (type === 'info' && document.hidden)) {
        playNotificationSound();
    }
}

function getNotificationIcon(type) {
    const icons = {
        success: 'ri-check-line',
        error: 'ri-error-warning-line',
        info: 'ri-information-line',
        warning: 'ri-alert-line'
    };
    return icons[type] || icons.info;
}

function playNotificationSound() {
    // Простой beep через Web Audio API
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.frequency.value = 800;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
    } catch (e) {
        // Fallback: игнорируем если AudioContext не доступен
    }
}

// === Вспомогательные функции ===
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function formatTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString('ru-RU', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
    });
}

function formatRelativeTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'только что';
    if (minutes < 60) return `${minutes}м`;
    if (hours < 24) return `${hours}ч`;
    if (days < 7) return `${days}д`;
    
    return date.toLocaleDateString('ru-RU', { 
        day: '2-digit', 
        month: '2-digit' 
    });
}

function formatDuration(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function getWelcomeMessageHTML() {
    return `
        <div class="welcome-message">
            <i class="ri-chat-smile-2-line"></i>
            <h3>Добро пожаловать в priconnecte</h3>
            <p>Выберите чат или создайте новый</p>
            <button class="btn-primary" id="welcomeNewChat">
                <i class="ri-add-line"></i> Новый чат
            </button>
        </div>
    `;
}

function showLoading(container, text = 'Загрузка...') {
    container.innerHTML = `
        <div class="loading-state">
            <i class="ri-loader-4-line spin"></i>
            <p>${text}</p>
        </div>
    `;
}

// === Модальные окна ===
function showModal(modal) {
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    
    // Фокус на первый интерактивный элемент
    const focusable = modal.querySelector('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
    focusable?.focus();
    
    // Закрытие по ESC
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            hideModal(modal);
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
    
    // Закрытие по клику на фон
    modal.addEventListener('click', function handler(e) {
        if (e.target === modal) {
            hideModal(modal);
            modal.removeEventListener('click', handler);
        }
    }, { once: true });
}

function hideModal(modal) {
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
}

// === Переключение экранов ===
function showAuth() {
    DOM.authContainer.classList.remove('hidden');
    DOM.appContainer.classList.add('hidden');
    DOM.sidebar.classList.remove('mobile-open');
}

function showApp() {
    DOM.authContainer.classList.add('hidden');
    DOM.appContainer.classList.remove('hidden');
}

// === Тема (localStorage) ===
function loadTheme() {
    const saved = localStorage.getItem('priconnecte-theme');
    if (saved) {
        document.documentElement.setAttribute('data-theme', saved);
        if (DOM.themeSelect) DOM.themeSelect.value = saved;
    }
}

function saveTheme(theme) {
    localStorage.setItem('priconnecte-theme', theme);
}

// === Mark as read ===
async function markChatAsRead(chatId) {
    // TODO: Реализовать обновление last_read в chat_members
    // Для MVP просто визуальный сброс
}

// === Update last seen ===
async function updateLastSeen(userId, online) {
    try {
        await supabase
            .from(SUPABASE_CONFIG.tables.profiles)
            .update({ last_seen: new Date() })
            .eq('user_id', userId);
    } catch (err) {
        console.warn('Failed to update last_seen:', err);
    }
}

// === Presence subscription ===
function setupPresenceSubscription(userId) {
    AppState.unsubscribePresence = DB.subscribeToPresence(userId, (presence) => {
        // Обновляем статус в реальном времени
        const statusEl = DOM.currentStatus;
        if (presence?.online_at) {
            statusEl.textContent = 'Онлайн';
            statusEl.classList.add('online');
        } else {
            statusEl.textContent = 'Был(а) недавно';
            statusEl.classList.remove('online');
        }
    });
}

// === Bind Events ===
function bindEvents() {
    // Auth tabs
    DOM.switchToRegister?.addEventListener('click', (e) => {
        e.preventDefault();
        DOM.loginForm.classList.add('hidden');
        DOM.registerForm.classList.remove('hidden');
    });
    
    DOM.switchToLogin?.addEventListener('click', (e) => {
        e.preventDefault();
        DOM.registerForm.classList.add('hidden');
        DOM.loginForm.classList.remove('hidden');
    });
    
    // Auth forms
    DOM.loginForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        
        try {
            DOM.loginForm.querySelector('button[type="submit"]').disabled = true;
            await Auth.signIn(email, password);
            // handleAuthChange вызовет onUserSignedIn
        } catch (err) {
            console.error('Login error:', err);
            showNotification(err.message || 'Ошибка входа', 'error');
        } finally {
            DOM.loginForm.querySelector('button[type="submit"]').disabled = false;
        }
    });
    
    DOM.registerForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('regName').value;
        const email = document.getElementById('regEmail').value;
        const password = document.getElementById('regPassword').value;
        
        try {
            DOM.registerForm.querySelector('button[type="submit"]').disabled = true;
            await Auth.signUp(email, password, name);
            showNotification('Проверьте email для подтверждения', 'info');
        } catch (err) {
            console.error('Register error:', err);
            showNotification(err.message || 'Ошибка регистрации', 'error');
        } finally {
            DOM.registerForm.querySelector('button[type="submit"]').disabled = false;
        }
    });
    
    // Profile modal
    DOM.userProfileBtn?.addEventListener('click', () => showModal(DOM.profileModal));
    DOM.closeProfile?.addEventListener('click', () => hideModal(DOM.profileModal));
    DOM.logoutBtn?.addEventListener('click', async () => {
        if (confirm('Выйти из аккаунта?')) {
            await Auth.signOut();
        }
    });
    
    // Sidebar tabs
    DOM.tabs?.forEach(tab => {
        tab.addEventListener('click', () => {
            DOM.tabs.forEach(t => {
                t.classList.remove('active');
                t.setAttribute('aria-selected', 'false');
            });
            tab.classList.add('active');
            tab.setAttribute('aria-selected', 'true');
            
            AppState.activeTab = tab.dataset.tab;
            loadChats(AppState.activeTab);
        });
    });
    
    // Search
    DOM.searchInput?.addEventListener('input', () => {
        // Ре-рендер списка с фильтром
        loadChats(AppState.activeTab);
    });
    
    // New chat
    DOM.newChatBtn?.addEventListener('click', () => showModal(DOM.newChatModal));
    DOM.closeNewChat?.addEventListener('click', () => hideModal(DOM.newChatModal));
    DOM.createChat?.addEventListener('click', createNewChat);
    
    // Add contact
    DOM.addContactBtn?.addEventListener('click', () => showModal(DOM.addContactModal));
    DOM.closeAddContact?.addEventListener('click', () => hideModal(DOM.addContactModal));
    
    // Settings
    DOM.settingsBtn?.addEventListener('click', () => showModal(DOM.settingsModal));
    DOM.closeSettings?.addEventListener('click', () => hideModal(DOM.settingsModal));
    
    // Message input
    DOM.messageInput?.addEventListener('input', (e) => {
        // Auto-resize
        e.target.style.height = 'auto';
        e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
        
        // Typing indicator
        startTypingIndicator();
    });
    
    DOM.messageInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    DOM.sendBtn?.addEventListener('click', sendMessage);
    
    // Voice recording
    DOM.voiceBtn?.addEventListener('click', () => {
        if (AppState.isRecording) {
            stopVoiceRecording();
        } else {
            startVoiceRecording();
        }
    });
    
    DOM.stopRecording?.addEventListener('click', stopVoiceRecording);
    
    // Video recording
    DOM.videoBtn?.addEventListener('click', startVideoRecording);
    DOM.cancelVideo?.addEventListener('click', cancelVideoRecording);
    
    // Call buttons (заглушки для MVP)
    DOM.callBtn?.addEventListener('click', () => {
        showNotification('Голосовые звонки в разработке', 'info');
    });
    
    DOM.videoCallBtn?.addEventListener('click', () => {
        showNotification('Видеозвонки в разработке', 'info');
    });
    
    // Mobile sidebar toggle
    DOM.openSidebar?.addEventListener('click', () => {
        DOM.sidebar.classList.toggle('mobile-open');
    });
    
    // Close sidebar on chat select (mobile)
    DOM.contactsList?.addEventListener('click', () => {
        if (window.innerWidth < 768) {
            DOM.sidebar.classList.remove('mobile-open');
        }
    });
    
    // Context menu on messages
    DOM.messagesContainer?.addEventListener('contextmenu', (e) => {
        const msgEl = e.target.closest('.message');
        if (msgEl) {
            showMessageContextMenu(e, msgEl.dataset.messageId);
        }
    });
    
    // Close context menu on scroll
    DOM.messagesContainer?.addEventListener('scroll', hideMessageContextMenu, { passive: true });
    
    // Emoji button (заглушка)
    DOM.emojiBtn?.addEventListener('click', () => {
        showNotification('Панель эмодзи в разработке', 'info');
    });
    
    // Chat menu
    DOM.chatMenuBtn?.addEventListener('click', (e) => {
        // TODO: Показать меню чата (настройки, участники, и т.д.)
        const rect = e.target.getBoundingClientRect();
        showNotification('Меню чата в разработке', 'info');
    });
    
    // Welcome button
    DOM.messagesContainer?.addEventListener('click', (e) => {
        if (e.target.closest('#welcomeNewChat')) {
            showModal(DOM.newChatModal);
        }
    });
    
    // Voice message play
    DOM.messagesContainer?.addEventListener('click', (e) => {
        const playBtn = e.target.closest('.voice-play-btn');
        if (playBtn) {
            const audio = new Audio(playBtn.dataset.url);
            audio.play();
            playBtn.innerHTML = '<i class="ri-pause-fill"></i>';
            audio.onended = () => {
                playBtn.innerHTML = '<i class="ri-play-fill"></i>';
            };
        }
    });
    
    // Window resize handler
    window.addEventListener('resize', () => {
        if (window.innerWidth >= 768) {
            DOM.appContainer.classList.remove('chat-active');
            DOM.sidebar.classList.remove('mobile-open');
        }
    });
    
    // Visibility change for read receipts
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && AppState.currentChat) {
            markChatAsRead(AppState.currentChat.id);
        }
    });
    
    // Online/offline detection
    window.addEventListener('online', () => {
        showNotification('Соединение восстановлено', 'success');
        // TODO: Sync offline messages
    });
    
    window.addEventListener('offline', () => {
        showNotification('Нет соединения. Сообщения сохранятся.', 'warning');
    });
}

// === Start ===
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
// Регистрация Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      console.log('✅ SW registered:', registration.scope);

      // Обработка сообщений от SW
      navigator.serviceWorker.addEventListener('message', event => {
        if (event.data.type === 'SYNC_OFFLINE_MESSAGES') {
          console.log('🔄 Triggering offline message sync...');
          // Здесь вызовите функцию отправки pending сообщений из IndexedDB
          // syncPendingMessages();
        }
      });

      // Request push permission on first interaction
      document.addEventListener('click', async function requestPush() {
        if (Notification.permission === 'default') {
          await Notification.requestPermission();
        }
        document.removeEventListener('click', requestPush);
      }, { once: true });

    } catch (err) {
      console.warn('⚠️ SW registration failed:', err);
    }
  });
}

// Регистрация Background Sync при отправке оффлайн-сообщения
async function queueOfflineMessage(msgData) {
  try {
    // Сохраняем в IndexedDB (псевдокод)
    // await idb.put('pending_messages', msgData);
    
    // Регистрируем синхронизацию
    const reg = await navigator.serviceWorker.ready;
    await reg.sync.register('sync-messages');
    console.log('📦 Message queued for background sync');
  } catch (err) {
    console.error('Background sync failed:', err);
  }
}

// === Export for testing ===
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AppState, DOM, sendMessage, openChat, renderMessage };
}