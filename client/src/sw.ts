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
    const payload = event.data?.json();
    const { title, body, data } = payload;
    
    event.waitUntil(
      self.registration.showNotification(title || 'New Notification', {
        body: body || '',
        icon: '/logo-128.png',
        badge: '/badge-96.png',
        data: {
          ...(data || {}),
          _title: title,
          _body: body
        },
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
  
  const data = event.notification.data;
  let targetUrl = data?.url || '/';
  
  // If it's a local URL, append the message content as query params
  if (targetUrl.startsWith('/') || targetUrl.startsWith(self.location.origin)) {
    const url = new URL(targetUrl, self.location.origin);
    if (data._title) url.searchParams.set('notif_title', data._title);
    if (data._body) url.searchParams.set('notif_body', data._body);
    targetUrl = url.toString();
  }
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open at this URL, focus it (and update its URL to show the message)
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
