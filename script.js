document.addEventListener('DOMContentLoaded', () => {
    // Состояние
    const state = {
        currentUser: null,
        contacts: [],
        chats: {},
        messages: {},
        currentChatId: null,
        settings: { theme: 'dark', notifications: true }
    };

    // Элементы
    const elements = {
        authContainer: document.getElementById('authContainer'),
        appContainer: document.getElementById('appContainer'),
        loginForm: document.getElementById('loginForm'),
        registerForm: document.getElementById('registerForm'),
        authTabs: document.querySelectorAll('.auth-tab'),
        contactsList: document.getElementById('contactsList'),
        messagesContainer: document.getElementById('messagesContainer'),
        messageInput: document.getElementById('messageInput'),
        sendBtn: document.getElementById('sendBtn'),
        searchInput: document.getElementById('searchInput'),
        sidebar: document.getElementById('sidebar'),
        videoRecording: document.getElementById('videoRecording'),
        voiceRecording: document.getElementById('voiceRecording')
    };

    // Инициализация
    init();

    function init() {
        checkAuth();
        setupEventListeners();
        loadSampleData();
    }

    function checkAuth() {
        const user = localStorage.getItem('currentUser');
        if (user) {
            state.currentUser = JSON.parse(user);
            showApp();
        }
    }

    function showApp() {
        elements.authContainer.classList.add('hidden');
        elements.appContainer.classList.remove('hidden');
        document.getElementById('userName').textContent = state.currentUser.name;
        document.getElementById('userAvatar').src = state.currentUser.avatar || 'https://i.pravatar.cc/150?img=68';
        renderContacts();
    }

    function setupEventListeners() {
        // Авторизация
        elements.authTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                elements.authTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                if (tab.dataset.tab === 'login') {
                    elements.loginForm.classList.remove('hidden');
                    elements.registerForm.classList.add('hidden');
                } else {
                    elements.loginForm.classList.add('hidden');
                    elements.registerForm.classList.remove('hidden');
                }
            });
        });

        elements.loginForm.addEventListener('submit', handleLogin);
        elements.registerForm.addEventListener('submit', handleRegister);
        document.getElementById('logoutBtn').addEventListener('click', logout);

        // Профиль
        document.getElementById('userProfileBtn').addEventListener('click', () => {
            document.getElementById('profileName').value = state.currentUser.name;
            document.getElementById('profileAvatarPreview').src = state.currentUser.avatar;
            openModal('profileModal');
        });
        document.getElementById('closeProfile').addEventListener('click', () => closeModal('profileModal'));
        document.getElementById('saveProfile').addEventListener('click', saveProfile);
        document.getElementById('avatarUpload').addEventListener('change', handleAvatarUpload);

        // Чаты
        document.getElementById('newChatBtn').addEventListener('click', openNewChatModal);
        document.getElementById('closeNewChat').addEventListener('click', () => closeModal('newChatModal'));
        document.getElementById('createChat').addEventListener('click', createChat);
        document.getElementById('chatType').addEventListener('change', (e) => {
            document.getElementById('chatDescriptionGroup').style.display = e.target.value === 'channel' ? 'block' : 'none';
        });

        // Контакты
        document.getElementById('addContactBtn').addEventListener('click', () => openModal('addContactModal'));
        document.getElementById('closeAddContact').addEventListener('click', () => closeModal('addContactModal'));
        document.getElementById('addContact').addEventListener('click', addContact);
        document.getElementById('contactSearch').addEventListener('input', searchContacts);

        // Сообщения
        elements.sendBtn.addEventListener('click', sendMessage);
        elements.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });

        // Поиск
        elements.searchInput.addEventListener('input', filterContacts);

        // Табы
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                filterByTab(tab.dataset.tab);
            });
        });

        // Голосовые
        const voiceBtn = document.getElementById('voiceBtn');
        voiceBtn.addEventListener('mousedown', startVoiceRecording);
        voiceBtn.addEventListener('mouseup', stopVoiceRecording);
        voiceBtn.addEventListener('mouseleave', stopVoiceRecording);
        document.getElementById('stopRecording').addEventListener('click', stopVoiceRecording);

        // Видео
        document.getElementById('videoBtn').addEventListener('click', startVideoRecording);
        document.getElementById('cancelVideo').addEventListener('click', cancelVideoRecording);

        // Звонки
        document.getElementById('callBtn').addEventListener('click', () => startCall('audio'));
        document.getElementById('videoCallBtn').addEventListener('click', () => startCall('video'));
        document.getElementById('endCall').addEventListener('click', endCall);

        // Настройки
        document.getElementById('settingsBtn').addEventListener('click', () => openModal('settingsModal'));
        document.getElementById('closeSettings').addEventListener('click', () => closeModal('settingsModal'));
        document.getElementById('themeSelect').addEventListener('change', (e) => {
            document.documentElement.setAttribute('data-theme', e.target.value);
        });

        // Мобильное меню
        document.getElementById('openSidebar').addEventListener('click', () => {
            elements.sidebar.classList.add('active');
        });

        // Контекстное меню
        document.addEventListener('click', () => {
            document.getElementById('messageContextMenu').classList.remove('active');
        });

        document.getElementById('messageContextMenu').querySelectorAll('.context-item').forEach(item => {
            item.addEventListener('click', (e) => {
                handleContextMenu(e.target.dataset.action);
            });
        });
    }

    // Авторизация
    function handleLogin(e) {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        
        const users = JSON.parse(localStorage.getItem('users') || '[]');
        const user = users.find(u => u.email === email && u.password === password);
        
        if (user) {
            state.currentUser = user;
            localStorage.setItem('currentUser', JSON.stringify(user));
            showApp();
            showNotification('Добро пожаловать!');
        } else {
            showNotification('Неверный email или пароль', 'error');
        }
    }

    function handleRegister(e) {
        e.preventDefault();
        const name = document.getElementById('regName').value;
        const email = document.getElementById('regEmail').value;
        const password = document.getElementById('regPassword').value;
        
        const users = JSON.parse(localStorage.getItem('users') || '[]');
        
        if (users.find(u => u.email === email)) {
            showNotification('Пользователь уже существует', 'error');
            return;
        }
        
        const newUser = {
            id: Date.now(),
            name,
            email,
            password,
            avatar: `https://i.pravatar.cc/150?img=${Math.floor(Math.random() * 70)}`,
            status: 'Онлайн'
        };
        
        users.push(newUser);
        localStorage.setItem('users', JSON.stringify(users));
        
        state.currentUser = newUser;
        localStorage.setItem('currentUser', JSON.stringify(newUser));
        showApp();
        showNotification('Регистрация успешна!');
    }

    function logout() {
        localStorage.removeItem('currentUser');
        location.reload();
    }

    // Профиль
    function saveProfile() {
        const name = document.getElementById('profileName').value;
        if (name) {
            state.currentUser.name = name;
            localStorage.setItem('currentUser', JSON.stringify(state.currentUser));
            
            // Обновить в базе
            const users = JSON.parse(localStorage.getItem('users') || '[]');
            const index = users.findIndex(u => u.id === state.currentUser.id);
            if (index > -1) {
                users[index] = state.currentUser;
                localStorage.setItem('users', JSON.stringify(users));
            }
            
            document.getElementById('userName').textContent = name;
            closeModal('profileModal');
            showNotification('Профиль сохранён');
        }
    }

    function handleAvatarUpload(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                state.currentUser.avatar = event.target.result;
                document.getElementById('profileAvatarPreview').src = event.target.result;
                document.getElementById('userAvatar').src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    }

    // Чаты
    function openNewChatModal() {
        const select = document.getElementById('contactsSelect');
        select.innerHTML = '';
        state.contacts.forEach(contact => {
            const div = document.createElement('div');
            div.className = 'contact-option';
            div.innerHTML = `<img src="${contact.avatar}"><span>${contact.name}</span>`;
            div.addEventListener('click', () => div.classList.toggle('selected'));
            select.appendChild(div);
        });
        openModal('newChatModal');
    }

    function createChat() {
        const type = document.getElementById('chatType').value;
        const name = document.getElementById('newChatName').value;
        const confidential = document.getElementById('confidentialChat').checked;
        
        if (!name) return;
        
        const newId = Date.now();
        const selected = document.querySelectorAll('.contact-option.selected');
        
        const chat = {
            id: newId,
            name,
            type,
            confidential,
            avatar: type === 'private' ? (selected[0]?.querySelector('img').src || 'https://i.pravatar.cc/150?img=1') : 'https://i.pravatar.cc/150?img=8',
            unread: 0,
            pinned: false,
            archived: false
        };
        
        state.chats[newId] = chat;
        state.messages[newId] = [];
        
        if (type === 'private' && selected[0]) {
            const contactName = selected[0].querySelector('span').textContent;
            // Добавить контакт если нет
            if (!state.contacts.find(c => c.name === contactName)) {
                state.contacts.push({
                    id: newId,
                    name: contactName,
                    avatar: selected[0].querySelector('img').src
                });
            }
        }
        
        saveData();
        renderContacts();
        closeModal('newChatModal');
        document.getElementById('newChatName').value = '';
        showNotification('Чат создан');
    }

    // Контакты
    function searchContacts() {
        const query = document.getElementById('contactSearch').value.toLowerCase();
        const results = document.getElementById('contactSearchResults');
        results.innerHTML = '';
        
        if (query.length < 2) return;
        
        // Имитация поиска
        const mockUsers = [
            { name: 'Анна Смирнова', username: '@anna' },
            { name: 'Максим Петров', username: '@max' },
            { name: 'Елена Козлова', username: '@elena' }
        ];
        
        const filtered = mockUsers.filter(u => u.name.toLowerCase().includes(query) || u.username.includes(query));
        
        filtered.forEach(user => {
            const div = document.createElement('div');
            div.className = 'contact-option';
            div.innerHTML = `
                <img src="https://i.pravatar.cc/150?img=${Math.floor(Math.random() * 70)}">
                <div>
                    <div style="font-weight:600">${user.name}</div>
                    <div style="font-size:0.8rem;color:var(--text-secondary)">${user.username}</div>
                </div>
            `;
            div.addEventListener('click', () => {
                addContactByUser(user);
            });
            results.appendChild(div);
        });
    }

    function addContactByUser(user) {
        const newContact = {
            id: Date.now(),
            name: user.name,
            username: user.username,
            avatar: `https://i.pravatar.cc/150?img=${Math.floor(Math.random() * 70)}`,
            status: 'offline'
        };
        
        state.contacts.push(newContact);
        saveData();
        renderContacts();
        closeModal('addContactModal');
        document.getElementById('contactSearch').value = '';
        document.getElementById('contactUsername').value = '';
        showNotification('Контакт добавлен');
    }

    function addContact() {
        const username = document.getElementById('contactUsername').value;
        if (!username) return;
        
        const newContact = {
            id: Date.now(),
            name: username,
            username,
            avatar: `https://i.pravatar.cc/150?img=${Math.floor(Math.random() * 70)}`,
            status: 'offline'
        };
        
        state.contacts.push(newContact);
        saveData();
        renderContacts();
        closeModal('addContactModal');
        document.getElementById('contactUsername').value = '';
        showNotification('Контакт добавлен');
    }

    // Рендер
    function renderContacts(filter = 'all') {
        elements.contactsList.innerHTML = '';
        
        Object.values(state.chats).forEach(chat => {
            if (filter === 'channels' && chat.type !== 'channel') return;
            if (filter === 'archived' && !chat.archived) return;
            if (filter === 'all' && chat.archived) return;
            
            const div = document.createElement('div');
            div.className = `contact-item ${state.currentChatId === chat.id ? 'active' : ''}`;
            div.innerHTML = `
                <img src="${chat.avatar}">
                <div class="contact-info">
                    <h4>${chat.name} ${chat.type === 'channel' ? '📢' : ''} ${chat.confidential ? '🔒' : ''}</h4>
                    <p>${getLastMessage(chat.id)}</p>
                </div>
            `;
            div.addEventListener('click', () => selectChat(chat.id));
            elements.contactsList.appendChild(div);
        });
    }

    function getLastMessage(chatId) {
        const msgs = state.messages[chatId] || [];
        if (msgs.length === 0) return 'Нет сообщений';
        const last = msgs[msgs.length - 1];
        return last.text || (last.type === 'voice' ? '🎤 Голосовое' : '📹 Видео');
    }

    function filterContacts() {
        const query = elements.searchInput.value.toLowerCase();
        const items = elements.contactsList.querySelectorAll('.contact-item');
        items.forEach(item => {
            const name = item.querySelector('h4').textContent.toLowerCase();
            item.style.display = name.includes(query) ? 'flex' : 'none';
        });
    }

    function filterByTab(tab) {
        renderContacts(tab);
    }

    function selectChat(chatId) {
        state.currentChatId = chatId;
        const chat = state.chats[chatId];
        
        document.getElementById('currentChatName').textContent = chat.name;
        document.getElementById('currentAvatar').src = chat.avatar;
        document.getElementById('currentStatus').textContent = chat.type === 'channel' ? 'Канал' : 'Онлайн';
        
        renderMessages();
        if (window.innerWidth <= 768) {
            elements.sidebar.classList.remove('active');
        }
    }

    function renderMessages() {
        elements.messagesContainer.innerHTML = '';
        if (!state.currentChatId) return;
        
        const msgs = state.messages[state.currentChatId] || [];
        msgs.forEach(msg => appendMessage(msg));
        scrollToBottom();
    }

    function appendMessage(msg) {
        const div = document.createElement('div');
        div.className = `message ${msg.type}`;
        div.innerHTML = `
            ${msg.text}
            <div class="message-time">${msg.time}</div>
        `;
        div.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const menu = document.getElementById('messageContextMenu');
            menu.style.left = e.pageX + 'px';
            menu.style.top = e.pageY + 'px';
            menu.classList.add('active');
            menu.dataset.messageId = msg.id;
        });
        elements.messagesContainer.appendChild(div);
    }

    function sendMessage() {
        const text = elements.messageInput.value.trim();
        if (!text || !state.currentChatId) return;
        
        const msg = {
            id: Date.now(),
            text,
            type: 'outgoing',
            time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
            date: new Date().toISOString()
        };
        
        if (!state.messages[state.currentChatId]) {
            state.messages[state.currentChatId] = [];
        }
        state.messages[state.currentChatId].push(msg);
        
        appendMessage(msg);
        elements.messageInput.value = '';
        scrollToBottom();
        saveData();
        
        // Ответ бота
        setTimeout(() => {
            const botMsg = {
                id: Date.now() + 1,
                text: 'Получил ваше сообщение!',
                type: 'incoming',
                time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})
            };
            state.messages[state.currentChatId].push(botMsg);
            appendMessage(botMsg);
            scrollToBottom();
            saveData();
            renderContacts();
        }, 1000);
        
        renderContacts();
    }

    function handleContextMenu(action) {
        const menu = document.getElementById('messageContextMenu');
        const msgId = parseInt(menu.dataset.messageId);
        const msgs = state.messages[state.currentChatId];
        const index = msgs.findIndex(m => m.id === msgId);
        
        if (action === 'delete' && index > -1) {
            msgs.splice(index, 1);
            saveData();
            renderMessages();
            renderContacts();
        }
    }

    // Голосовые
    let mediaRecorder;
    let audioChunks = [];

    function startVoiceRecording() {
        navigator.mediaDevices.getUserMedia({audio: true}).then(stream => {
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
            mediaRecorder.start();
            elements.voiceRecording.classList.add('active');
            startRecordingTimer();
        }).catch(() => showNotification('Нет доступа к микрофону', 'error'));
    }

    function stopVoiceRecording() {
        if (!mediaRecorder || mediaRecorder.state === 'inactive') return;
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(t => t.stop());
        elements.voiceRecording.classList.remove('active');
        
        setTimeout(() => {
            const audioBlob = new Blob(audioChunks, {type: 'audio/webm'});
            const msg = {
                id: Date.now(),
                type: 'voice',
                text: '🎤 Голосовое сообщение',
                time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})
            };
            if (!state.messages[state.currentChatId]) state.messages[state.currentChatId] = [];
            state.messages[state.currentChatId].push(msg);
            appendMessage(msg);
            scrollToBottom();
            saveData();
            renderContacts();
        }, 100);
    }

    function startRecordingTimer() {
        let seconds = 0;
        const timer = setInterval(() => {
            seconds++;
            const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
            const secs = (seconds % 60).toString().padStart(2, '0');
            document.getElementById('recordingTime').textContent = `${mins}:${secs}`;
            if (!elements.voiceRecording.classList.contains('active')) clearInterval(timer);
        }, 1000);
    }

    // Видео
    let videoStream;

    function startVideoRecording() {
        navigator.mediaDevices.getUserMedia({video: true, audio: true}).then(stream => {
            videoStream = stream;
            const preview = document.getElementById('videoPreview');
            preview.srcObject = stream;
            elements.videoRecording.classList.add('active');
            startVideoTimer();
        }).catch(() => showNotification('Нет доступа к камере', 'error'));
    }

    function cancelVideoRecording() {
        if (videoStream) {
            videoStream.getTracks().forEach(t => t.stop());
            elements.videoRecording.classList.remove('active');
        }
    }

    function startVideoTimer() {
        let seconds = 0;
        const timer = setInterval(() => {
            seconds++;
            const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
            const secs = (seconds % 60).toString().padStart(2, '0');
            document.getElementById('videoTime').textContent = `${mins}:${secs}`;
        }, 1000);
        
        // Автоотправка через 5 сек
        setTimeout(() => {
            if (videoStream) {
                sendVideoMessage();
            }
        }, 5000);
    }

    function sendVideoMessage() {
        if (videoStream) {
            videoStream.getTracks().forEach(t => t.stop());
            elements.videoRecording.classList.remove('active');
            
            const msg = {
                id: Date.now(),
                type: 'video',
                text: '📹 Видео сообщение',
                time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})
            };
            if (!state.messages[state.currentChatId]) state.messages[state.currentChatId] = [];
            state.messages[state.currentChatId].push(msg);
            appendMessage(msg);
            scrollToBottom();
            saveData();
            renderContacts();
            showNotification('Видео отправлено');
        }
    }

    // Звонки
    function startCall(type) {
        if (!state.currentChatId) {
            showNotification('Выберите чат', 'error');
            return;
        }
        
        const chat = state.chats[state.currentChatId];
        document.getElementById('callAvatar').src = chat.avatar;
        document.getElementById('callUserName').textContent = chat.name;
        document.getElementById('callStatus').textContent = type === 'video' ? 'Видеозвонок...' : 'Аудиозвонок...';
        
        openModal('callModal');
        
        if (type === 'video') {
            navigator.mediaDevices.getUserMedia({video: true, audio: true}).then(stream => {
                document.getElementById('localVideo').srcObject = stream;
            });
        } else {
            navigator.mediaDevices.getUserMedia({audio: true});
        }
        
        // Имитация ответа
        setTimeout(() => {
            document.getElementById('callStatus').textContent = 'Соединение...';
        }, 2000);
    }

    function endCall() {
        closeModal('callModal');
        const localVideo = document.getElementById('localVideo');
        if (localVideo.srcObject) {
            localVideo.srcObject.getTracks().forEach(t => t.stop());
        }
        showNotification('Звонок завершён');
    }

    // Утилиты
    function openModal(id) {
        document.getElementById(id).classList.add('active');
    }

    function closeModal(id) {
        document.getElementById(id).classList.remove('active');
    }

    function scrollToBottom() {
        elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
    }

    function showNotification(text, type = 'info') {
        const container = document.getElementById('notificationsContainer');
        const div = document.createElement('div');
        div.className = 'notification';
        div.textContent = text;
        div.style.borderLeft = `4px solid ${type === 'error' ? 'var(--danger)' : 'var(--success)'}`;
        container.appendChild(div);
        setTimeout(() => div.remove(), 3000);
    }

    function saveData() {
        localStorage.setItem('messengerData', JSON.stringify({
            contacts: state.contacts,
            chats: state.chats,
            messages: state.messages
        }));
    }

    function loadSampleData() {
        const data = localStorage.getItem('messengerData');
        if (data) {
            const parsed = JSON.parse(data);
            state.contacts = parsed.contacts || [];
            state.chats = parsed.chats || {};
            state.messages = parsed.messages || {};
        } else {
            // Демо данные
            state.contacts = [
                {id: 1, name: 'Анна', avatar: 'https://i.pravatar.cc/150?img=32', status: 'online'},
                {id: 2, name: 'Максим', avatar: 'https://i.pravatar.cc/150?img=11', status: 'offline'}
            ];
            state.chats = {
                1: {id: 1, name: 'Анна', type: 'private', confidential: false, avatar: 'https://i.pravatar.cc/150?img=32'},
                2: {id: 2, name: 'Новости', type: 'channel', confidential: false, avatar: 'https://i.pravatar.cc/150?img=8'}
            };
            state.messages = {
                1: [{id: 1, text: 'Привет!', type: 'incoming', time: '10:00'}]
            };
            saveData();
        }
        renderContacts();
    }
});
