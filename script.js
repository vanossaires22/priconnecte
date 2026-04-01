document.addEventListener('DOMContentLoaded', () => {
    // Элементы DOM
    const contactsList = document.getElementById('contactsList');
    const messagesContainer = document.getElementById('messagesContainer');
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const currentChatName = document.getElementById('currentChatName');
    const currentAvatar = document.getElementById('currentAvatar');
    const currentStatus = document.getElementById('currentStatus');
    const sidebar = document.getElementById('sidebar');
    const openSidebarBtn = document.getElementById('openSidebar');
    const closeSidebarBtn = document.getElementById('closeSidebar');
    const typingIndicator = document.createElement('div');

    // Состояние
    let currentChatId = null;
    let messages = {}; // Хранилище сообщений по ID чата

    // Данные контактов (имитация базы данных)
    const contacts = [
        { id: 1, name: 'Анна Смирнова', avatar: 'https://i.pravatar.cc/150?img=32', lastMessage: 'Привет! Как дела?' },
        { id: 2, name: 'Максим Дизайнер', avatar: 'https://i.pravatar.cc/150?img=11', lastMessage: 'Скинул макеты' },
        { id: 3, name: 'Поддержка', avatar: 'https://i.pravatar.cc/150?img=5', lastMessage: 'Ваш тикет создан' },
        { id: 4, name: 'Илон Маск', avatar: 'https://i.pravatar.cc/150?img=60', lastMessage: 'Полетим на Марс?' },
    ];

    // Фразы для бота
    const botResponses = [
        'Интересно! Расскажи подробнее.',
        'Я пока только бот, но я тебя понимаю 😄',
        'Звучит круто!',
        'Ага, понял.',
        'Может, выпьем кофе?',
        'Ха-ха, смешно!',
        'Я сохраню это в памяти.'
    ];

    // Инициализация
    init();

    function init() {
        loadMessages();
        renderContacts();
        setupEventListeners();
        setupTypingIndicator();
    }

    // Загрузка сообщений из LocalStorage
    function loadMessages() {
        const stored = localStorage.getItem('messenger_data');
        if (stored) {
            messages = JSON.parse(stored);
        }
    }

    // Сохранение сообщений
    function saveMessages() {
        localStorage.setItem('messenger_data', JSON.stringify(messages));
    }

    // Рендер контактов
    function renderContacts() {
        contactsList.innerHTML = '';
        contacts.forEach(contact => {
            const item = document.createElement('div');
            item.className = `contact-item ${currentChatId === contact.id ? 'active' : ''}`;
            item.onclick = () => selectChat(contact);
            
            // Получаем последнее сообщение для превью
            const chatMessages = messages[contact.id] || [];
            const lastMsg = chatMessages.length > 0 ? chatMessages[chatMessages.length - 1].text : 'Нет сообщений';

            item.innerHTML = `
                <img src="${contact.avatar}" alt="${contact.name}">
                <div class="contact-info">
                    <h4>${contact.name}</h4>
                    <p>${lastMsg}</p>
                </div>
            `;
            contactsList.appendChild(item);
        });
    }

    // Выбор чата
    function selectChat(contact) {
        currentChatId = contact.id;
        currentChatName.textContent = contact.name;
        currentAvatar.src = contact.avatar;
        currentStatus.textContent = 'Онлайн';
        
        // Обновляем активный класс в списке
        renderContacts();
        
        // Рендерим сообщения
        renderMessages();
        
        // На мобильном закрываем сайдбар
        if (window.innerWidth <= 768) {
            sidebar.classList.remove('active');
        }
        
        messageInput.focus();
    }

    // Рендер сообщений
    function renderMessages() {
        messagesContainer.innerHTML = '';
        
        if (!currentChatId) {
            messagesContainer.innerHTML = `
                <div class="welcome-message">
                    <i class="ri-chat-smile-2-line"></i>
                    <p>Выберите контакт, чтобы начать общение</p>
                </div>`;
            return;
        }

        const chatMessages = messages[currentChatId] || [];
        
        chatMessages.forEach(msg => {
            appendMessageToDOM(msg.text, msg.type, msg.time);
        });

        scrollToBottom();
    }

    // Добавление сообщения в DOM
    function appendMessageToDOM(text, type, time) {
        const div = document.createElement('div');
        div.className = `message ${type}`;
        div.innerHTML = `
            ${text}
            <span class="message-time">${time}</span>
        `;
        messagesContainer.appendChild(div);
    }

    // Отправка сообщения
    function sendMessage() {
        const text = messageInput.value.trim();
        if (!text || !currentChatId) return;

        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // Добавляем сообщение пользователя
        const userMsg = { text, type: 'outgoing', time };
        if (!messages[currentChatId]) messages[currentChatId] = [];
        messages[currentChatId].push(userMsg);
        
        appendMessageToDOM(text, 'outgoing', time);
        saveMessages();
        renderContacts(); // Обновить превью последнего сообщения
        messageInput.value = '';
        scrollToBottom();

        // Имитация ответа бота
        simulateBotResponse();
    }

    // Имитация ответа
    function simulateBotResponse() {
        showTyping(true);
        
        setTimeout(() => {
            showTyping(false);
            const randomResponse = botResponses[Math.floor(Math.random() * botResponses.length)];
            const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            const botMsg = { text: randomResponse, type: 'incoming', time };
            messages[currentChatId].push(botMsg);
            
            appendMessageToDOM(randomResponse, 'incoming', time);
            saveMessages();
            renderContacts();
            scrollToBottom();
        }, 1500 + Math.random() * 2000); // Случайная задержка 1.5-3.5 сек
    }

    // Индикатор набора
    function setupTypingIndicator() {
        typingIndicator.className = 'typing-indicator';
        typingIndicator.innerHTML = '<span></span><span></span><span></span>';
        messagesContainer.appendChild(typingIndicator);
    }

    function showTyping(show) {
        typingIndicator.style.display = show ? 'block' : 'none';
        if (show) scrollToBottom();
    }

    // Скролл вниз
    function scrollToBottom() {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Обработчики событий
    function setupEventListeners() {
        sendBtn.addEventListener('click', sendMessage);
        
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });

        // Мобильное меню
        openSidebarBtn.addEventListener('click', () => {
            sidebar.classList.add('active');
        });

        closeSidebarBtn.addEventListener('click', () => {
            sidebar.classList.remove('active');
        });
    }
});
