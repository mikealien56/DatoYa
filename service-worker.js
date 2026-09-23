const CACHE='datoya-shell-v51';
const SHELL=['/','/styles.css','/app.js','/local_market_home.css','/hero_polish.css','/home_premium.css','/marketplace_account.css','/marketplace_admin_market.css','/marketplace_business.css','/marketplace_public_beta.css','/marketplace_commerce.css','/marketplace_demo_showcase.css','/marketplace_demo_pitch.css','/marketplace_about.css','/marketplace_growth.css','/marketplace_hours.css','/marketplace_guided_demo.css','/marketplace_delivery.css','/marketplace_promo_analytics.css','/marketplace_integrations.css','/business_hub.css','/marketplace_admin_v2.css','/mobile_app_layout.css','/beta_private_ui.css','/local_market_home.js','/local_market_home_guard.js','/local_location_ui.js','/marketplace_navigation_fix.js','/marketplace_topnav_fix.js','/home_premium_ui.js','/marketplace_account_ui.js','/marketplace_weekly_ui.js','/marketplace_admin_market_ui.js','/marketplace_weekly_home.js','/marketplace_business_ui.js','/marketplace_business_admin_ui.js','/marketplace_public_beta_ui.js','/marketplace_commerce_ui.js','/marketplace_impulse_home.js','/marketplace_commerce_admin_ui.js','/khipu_payments_ui.js','/marketplace_demo_showcase_ui.js','/marketplace_demo_pitch_ui.js','/marketplace_about_ui.js','/marketplace_growth_ui.js','/marketplace_hours_ui.js','/marketplace_guided_demo_ui.js','/marketplace_delivery_ui.js','/marketplace_promo_analytics_ui.js','/marketplace_integrations_ui.js','/marketplace_legacy_route_guard.js','/legal_final_ui.js','/business_hub_ui.js','/marketplace_admin_v2_ui.js','/beta_private_ui.js','/brand/datoya-logo-horizontal.png','/brand/pwa/icon-192.png','/brand/pwa/icon-512.png','/brand/pwa/icon-maskable-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==location.origin)return;
  // Las respuestas autenticadas nunca deben persistir en Cache Storage.
  if(url.pathname.startsWith('/api/')){event.respondWith(fetch(event.request));return;}
  event.respondWith(fetch(event.request).then(response=>{
    if(response.ok&&!response.redirected)caches.open(CACHE).then(cache=>cache.put(event.request,response.clone()));
    return response;
  }).catch(()=>caches.match(event.request).then(hit=>hit||(event.request.mode==='navigate'?caches.match('/'):undefined))));
});


self.addEventListener('push',event=>{
  let data={};
  try{data=event.data?event.data.json():{}}catch(_){data={body:event.data?event.data.text():'Tienes una novedad en DatoYa'}}
  const title=String(data.title||'DatoYa');
  const options={
    body:String(data.body||'Tienes una novedad en DatoYa'),
    icon:data.icon||'/brand/pwa/icon-192.png',
    badge:data.badge||'/brand/pwa/icon-192.png',
    tag:data.tag||undefined,
    data:{url:String(data.url||'#/notificaciones')}
  };
  event.waitUntil(self.registration.showNotification(title,options));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const raw=event.notification&&event.notification.data&&event.notification.data.url?String(event.notification.data.url):'#/notificaciones';
  const target=new URL(raw,self.location.origin).href;
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    for(const client of list){
      if('navigate' in client&&'focus' in client)return client.navigate(target).then(()=>client.focus()).catch(()=>client.focus());
    }
    return self.clients.openWindow?self.clients.openWindow(target):undefined;
  }));
});
