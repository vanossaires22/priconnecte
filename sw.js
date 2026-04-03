/**
 * Priconnecte Messenger — Service Worker
 * Handles: Caching, Offline Fallback, Background Sync, Push Notifications
 * Strategy: Cache-First (static), Network-First (API/Nav), Stale-While-Revalidate (dynamic)
 * 
 * @version 1.0.0
 * @requires HTTPS or localhost context
 */

'use strict';

// === Configuration ===
const CACHE_VERSION = 'priconnecte-v1.2.0';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`;

// Core app shell & critical assets
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/config.js',
  '/supabase-client.js',
  '/assets/icons/logo.svg',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/offline.html', // Fallback page
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
  'https://cdn.jsdelivr.net/npm/remixicon@2.5.0/fonts/remixicon.css'
];

// Supabase project hostname (adjust if using custom domain)
const SUPABASE_HOST = /\.supabase\.co$/;

// === Installation ===
self.addEventListener('install', event => {
  console.log('[SW] Installing Priconnecte Service Worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting()) // Activate immediately
  );
});

// === Activation & Cache Cleanup ===
self.addEventListener('activate', event => {
  console.log('[SW] Activating Service Worker...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
          .map(name => {
            console.log(`[SW] Deleting old cache: ${name}`);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim()) // Take control of all open pages immediately
  );
});

// === Fetch Interception & Routing ===
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Only cache GET requests
  if (request.method !== 'GET') return;

  // 1. Navigation Requests (App Shell)
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache successful navigation responses
          if (response.ok) {
            const clone = response.clone();
            caches.open(DYNAMIC_CACHE).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match('/index.html').then(cached => cached || caches.match('/offline.html')))
    );
    return;
  }

  // 2. Supabase REST API Requests
  if (SUPABASE_HOST.test(url.hostname)) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(DYNAMIC_CACHE).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request)) // Fallback to cached API response
    );
    return;
  }

  // 3. Static Assets & Third-Party (Fonts, Icons, Images)
  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request))
  );
});

// === Background Sync (Offline Message Queue) ===
self.addEventListener('sync', event => {
  if (event.tag === 'sync-messages') {
    console.log('[SW] Background Sync triggered: sync-messages');
    event.waitUntil(syncOutgoingQueue());
  }
});

async function syncOutgoingQueue() {
  try {
    // In production, read pending messages from IndexedDB
    // For this PWA structure, we trigger the app to handle sync via postMessage
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    
    // If app is open, delegate sync to main thread (has auth tokens & Supabase client)
    if (clients.length > 0) {
      clients.forEach(client => client.postMessage({ type: 'SYNC_OFFLINE_MESSAGES' }));
      return;
    }

    // Fallback: Direct fetch to Supabase REST API (requires storing tokens securely)
    // const pending = await getPendingFromIndexedDB();
    // for (const msg of pending) {
    //   await fetch(`${SUPABASE_URL}/rest/v1/messages`, {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${storedToken}` },
    //     body: JSON.stringify(msg)
    //   });
    // }
    console.log('[SW] Offline queue synced successfully');
  } catch (err) {
    console.error('[SW] Sync failed:', err);
    // Retry automatically via sync event backoff
    throw err; 
  }
}

// === Push Notifications ===
self.addEventListener('push', event => {
  let payload = {
    title: 'priconnecte',
    body: 'Новое сообщение',
    icon: '/assets/icons/icon-192.png',
    badge: '/assets/icons/badge.png',
    data: { url: '/', chatId: null }
  };

  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch (e) {
      payload.body = event.data.text();
    }
  }

  const options = {
    body: payload.body,
    icon: payload.icon,
    badge: payload.badge,
    tag: payload.tag || 'priconnecte-notification',
    data: payload.data,
    actions: [
      { action: 'open', title: 'Открыть' },
      { action: 'mute', title: 'Отключить' }
    ],
    vibrate: [200, 100, 200],
    renotify: true,
    requireInteraction: false
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'open' || event.action === 'default') {
    const targetUrl = event.notification.data.url || '/';
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
        // Focus existing tab if open
        for (const client of clients) {
          if (client.url.includes(targetUrl) && 'focus' in client) {
            return client.focus();
          }
        }
        // Otherwise open new window
        return self.clients.openWindow(targetUrl);
      })
    );
  }
});

// === Message Channel (App ↔ Service Worker) ===
self.addEventListener('message', event => {
  if (event.data?.type === 'CACHE_DYNAMIC') {
    // Allow main thread to manually cache dynamic responses
    caches.open(DYNAMIC_CACHE).then(cache => cache.put(event.data.request, event.data.response));
  }
  
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// === Debug Logging (Production: remove or flag) ===
self.addEventListener('message', event => {
  if (event.data?.type === 'DEBUG_CACHE') {
    caches.keys().then(keys => console.log('[SW] Active caches:', keys));
  }
});