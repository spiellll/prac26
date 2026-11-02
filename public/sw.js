const CACHE='ritm-public-v2';
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(['/offline.html','/icon-192.png']))));
self.addEventListener('activate',event=>event.waitUntil(Promise.all([self.clients.claim(),caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('ritm-public-')&&k!==CACHE).map(k=>caches.delete(k))))])));
// Never cache the personal diary, authentication pages, or API responses.
self.addEventListener('fetch',event=>{if(event.request.mode==='navigate')event.respondWith(fetch(event.request).catch(()=>caches.match('/offline.html')))});
