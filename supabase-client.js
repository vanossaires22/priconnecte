/**
 * Priconnecte — Supabase Client Wrapper
 * Инициализация клиента и вспомогательные функции
 */

// Инициализация клиента (глобальная переменная)
const supabase = window.supabase.createClient(
    SUPABASE_CONFIG.url,
    SUPABASE_CONFIG.anonKey,
    SUPABASE_CONFIG.options
);

// === Утилиты для работы с БД ===

const DB = {
    /**
     * Получить текущего пользователя
     */
    async getCurrentUser() {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) throw error;
        return user;
    },

    /**
     * Получить профиль пользователя из таблицы profiles
     */
    async getProfile(userId) {
        const { data, error } = await supabase
            .from(SUPABASE_CONFIG.tables.profiles)
            .select('*')
            .eq('user_id', userId)
            .single();
        if (error && error.code !== 'PGRST116') throw error;
        return data;
    },

    /**
     * Обновить профиль
     */
    async updateProfile(userId, updates) {
        const { data, error } = await supabase
            .from(SUPABASE_CONFIG.tables.profiles)
            .upsert({ user_id: userId, ...updates, updated_at: new Date() });
        if (error) throw error;
        return data;
    },

    /**
     * Загрузить аватар в Storage
     */
    async uploadAvatar(file, userId) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}/${Date.now()}.${fileExt}`;
        const filePath = `${SUPABASE_CONFIG.storage.avatars}/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from(SUPABASE_CONFIG.storage.avatars)
            .upload(fileName, file, { upsert: true });
        
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from(SUPABASE_CONFIG.storage.avatars)
            .getPublicUrl(fileName);

        return publicUrl;
    },

    /**
     * Получить список чатов пользователя
     */
    async getUserChats(userId, tab = 'all') {
        let query = supabase
            .from(SUPABASE_CONFIG.tables.chat_members)
            .select(`
                chat_id,
                role,
                chats (
                    id,
                    name,
                    type,
                    avatar_url,
                    last_message,
                    updated_at
                )
            `)
            .eq('user_id', userId);

        if (tab === 'channels') {
            query = query.eq('chats.type', 'channel');
        } else if (tab === 'archived') {
            query = query.eq('chats.is_archived', true);
        } else {
            query = query.eq('chats.is_archived', false);
        }

        const { data, error } = await query.order('updated_at', { ascending: false });
        if (error) throw error;
        return data;
    },

    /**
     * Получить сообщения чата с пагинацией
     */
    async getMessages(chatId, limit = 50, before = null) {
        let query = supabase
            .from(SUPABASE_CONFIG.tables.messages)
            .select(`
                id,
                chat_id,
                sender_id,
                content,
                content_type,
                reply_to_id,
                created_at,
                updated_at,
                profiles!messages_sender_id_fkey (
                    id,
                    display_name,
                    avatar_url
                )
            `)
            .eq('chat_id', chatId)
            .order('created_at', { ascending: true })
            .limit(limit);

        if (before) {
            query = query.lt('created_at', before);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data;
    },

    /**
     * Отправить сообщение (с поддержкой Realtime)
     */
    async sendMessage(chatId, senderId, content, options = {}) {
        const payload = {
            chat_id: chatId,
            sender_id: senderId,
            content: content,
            content_type: options.type || 'text',
            reply_to_id: options.replyTo || null,
            is_edited: false,
            created_at: new Date()
        };

        const { data, error } = await supabase
            .from(SUPABASE_CONFIG.tables.messages)
            .insert(payload)
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    /**
     * Подписаться на сообщения чата (Realtime)
     */
    subscribeToMessages(chatId, callback) {
        const channel = supabase
            .channel(`messages:${chatId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: SUPABASE_CONFIG.tables.messages,
                    filter: `chat_id=eq.${chatId}`
                },
                (payload) => callback(payload.new)
            )
            .subscribe();
        
        return () => supabase.removeChannel(channel);
    },

    /**
     * Подписаться на статус пользователя (онлайн/офлайн)
     */
    subscribeToPresence(userId, callback) {
        const channel = supabase
            .channel(`presence:${userId}`)
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState();
                callback(state[userId]?.[0] || null);
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({ online_at: new Date().toISOString() });
                }
            });
        
        return () => supabase.removeChannel(channel);
    },

    /**
     * Создать новый чат
     */
    async createChat(creatorId, name, type, members = [], isEncrypted = false) {
        // 1. Создаём чат
        const { data: chat, error: chatError } = await supabase
            .from(SUPABASE_CONFIG.tables.chats)
            .insert({
                name: name,
                type: type,
                creator_id: creatorId,
                is_encrypted: isEncrypted,
                created_at: new Date()
            })
            .select()
            .single();
        
        if (chatError) throw chatError;

        // 2. Добавляем участников
        const memberRecords = [
            { chat_id: chat.id, user_id: creatorId, role: 'admin' },
            ...members.map(id => ({ chat_id: chat.id, user_id: id, role: 'member' }))
        ];

        const { error: membersError } = await supabase
            .from(SUPABASE_CONFIG.tables.chat_members)
            .insert(memberRecords);
        
        if (membersError) throw membersError;

        return chat;
    },

    /**
     * Удалить сообщение (мягкое удаление)
     */
    async deleteMessage(messageId, userId) {
        const { error } = await supabase
            .from(SUPABASE_CONFIG.tables.messages)
            .update({ 
                deleted: true, 
                deleted_at: new Date(),
                deleted_by: userId 
            })
            .eq('id', messageId)
            .eq('sender_id', userId); // Только отправитель может удалять
        
        if (error) throw error;
    }
};

// === Auth Helpers ===

const Auth = {
    /**
     * Вход по email/паролю
     */
    async signIn(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        if (error) throw error;
        return data;
    },

    /**
     * Регистрация нового пользователя
     */
    async signUp(email, password, name) {
        // 1. Создаём auth user
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { display_name: name }
            }
        });
        if (authError) throw authError;

        // 2. Создаём профиль в public.profiles (триггер может делать это автоматически)
        if (authData.user) {
            await DB.updateProfile(authData.user.id, {
                display_name: name,
                avatar_url: null,
                status: 'Онлайн',
                theme: 'dark',
                notifications_enabled: true
            });
        }

        return authData;
    },

    /**
     * Выйти
     */
    async signOut() {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    },

    /**
     * Слушать изменения состояния аутентификации
     */
    onAuthStateChange(callback) {
        return supabase.auth.onAuthStateChange((event, session) => {
            callback(event, session?.user || null);
        });
    }
};

// Экспорт глобально для script.js
window.DB = DB;
window.Auth = Auth;
window.supabase = supabase;

console.log('✅ Supabase client initialized:', SUPABASE_CONFIG.url);