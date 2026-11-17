// Service worker del panel: muestra las notificaciones de reservas, cambios y cancelaciones.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { titulo: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.titulo || 'Novedad en la agenda', {
    body: d.cuerpo || '',
    icon: 'img/icono-192.png',
    badge: 'img/icono-192.png',
    tag: 'agenda-' + Date.now(),
    data: { url: d.url || 'admin.html#/novedades' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const destino = new URL(e.notification.data?.url || 'admin.html#/novedades', self.registration.scope).href;
  e.waitUntil((async () => {
    const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const v of ventanas) { if (v.url.includes('admin.html')) { await v.navigate(destino); return v.focus(); } }
    return self.clients.openWindow(destino);
  })());
});
