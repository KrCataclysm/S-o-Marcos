// Service worker mínimo: existe só para tornar o site instalável como PWA.
// Não cacheia nada — cada requisição vai direto pra rede, e qualquer cache
// de uma versão anterior é apagado na ativação. Isso evita alguém ficar
// preso numa versão antiga do painel enquanto ele já está em uso.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  // Só toca em GET (navegação/assets). POST (chamadas RPC do Supabase) passa
  // direto pelo navegador sem passar pelo service worker — reenviar um
  // Request com corpo por aqui pode falhar por causa do stream já consumido.
  if (event.request.method !== 'GET') return;
  event.respondWith(fetch(event.request));
});
