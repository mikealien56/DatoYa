const CACHE='datoya-shell-v7';
const SHELL=['/','/styles.css','/app.js','/local_market_home.css','/hero_polish.css','/local_market_home.js','/local_market_home_guard.js','/local_location_ui.js','/marketplace_navigation_fix.js','/brand/datoya-logo-horizontal.png','/brand/pwa/icon-192.png','/brand/pwa/icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==location.origin)return;
  event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response;}).catch(()=>caches.match(event.request).then(hit=>hit||caches.match('/'))));
});
