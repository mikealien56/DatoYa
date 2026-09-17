const CACHE='datoya-shell-v17';
const SHELL=['/','/styles.css','/app.js','/local_market_home.css','/hero_polish.css','/home_premium.css','/marketplace_account.css','/marketplace_admin_market.css','/marketplace_business.css','/marketplace_public_beta.css','/marketplace_commerce.css','/local_market_home.js','/local_market_home_guard.js','/local_location_ui.js','/marketplace_navigation_fix.js','/marketplace_topnav_fix.js','/home_premium_ui.js','/marketplace_account_ui.js','/marketplace_weekly_ui.js','/marketplace_admin_market_ui.js','/marketplace_weekly_home.js','/marketplace_business_ui.js','/marketplace_business_admin_ui.js','/marketplace_public_beta_ui.js','/marketplace_commerce_ui.js','/marketplace_impulse_home.js','/marketplace_commerce_admin_ui.js','/brand/datoya-logo-horizontal.png','/brand/pwa/icon-192.png','/brand/pwa/icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==location.origin)return;
  event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response;}).catch(()=>caches.match(event.request).then(hit=>hit||caches.match('/'))));
});
