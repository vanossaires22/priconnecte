/**
 * Priconnecte — Supabase Configuration
 * Заполните значениями из вашего проекта:
 * 1. Зайдите в https://app.supabase.com
 * 2. Выберите проект → Settings → API
 * 3. Скопируйте "Project URL" и "anon / public" ключ
 */
const SUPABASE_CONFIG = {
    // URL вашего проекта (без слэша в конце)
    url: 'lyfnstflvgrlikpyhftw',
    
    // Публичный anon ключ (безопасно использовать в браузере)
    anonKey: 'sb_secret_7ylnq2dP3bIwtn3wImQIAA_UTvcrTkJ',
    
    // Настройки
    options: {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true
        },
        db: {
            schema: 'public'
        },
        realtime: {
            params: {
                eventsPerSecond: 10
            }
        }
    },
    
    // Имена таблиц в вашей БД
    tables: {
        users: 'users',
        profiles: 'profiles',
        chats: 'chats',
        chat_members: 'chat_members',
        messages: 'messages',
        media: 'media_files',
        settings: 'user_settings'
    },
    
    // Storage бакеты
    storage: {
        avatars: 'avatars',
        media: 'chat_media',
        voice: 'voice_messages'
    }
};

// Экспорт для модулей (если используете сборщик)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SUPABASE_CONFIG;
}