/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const rawData = event.data?.text();
    console.log('Push received, raw data:', rawData);
    
    const payload = event.data?.json();
    console.log('Parsed payload:', payload);
    
    const { title, body, data } = payload;
    
    event.waitUntil(
      self.registration.showNotification(title || 'New Notification', {
        body: body || '',
        icon: '/logo-128.png',
        badge: '/badge-96.png',
        data: data || {},
        requireInteraction: true
      })
    );
  } catch (err) {
    console.error('Error parsing push data:', err);
    event.waitUntil(
      self.registration.showNotification('Notification received', {
        body: event.data?.text() || 'No content'
      })
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const url = event.notification.data?.url || '/';
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
