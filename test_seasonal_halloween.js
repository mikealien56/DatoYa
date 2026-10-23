const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('seasonal_halloween_ui.js','utf8');
const css=fs.readFileSync('seasonal_halloween.css','utf8');
const startup=fs.readFileSync('production_start.js','utf8');
const assets=fs.readFileSync('seasonal_halloween_assets.js','utf8');
const sw=fs.readFileSync('service-worker.js','utf8');
function scene(start='2026-10-21T12:00:00Z'){
  let now=start;
  const set=new Set(),timers=[],handlers={};
  const classList={add:name=>set.add(name),remove:name=>set.delete(name),contains:name=>set.has(name),toggle:(name,on)=>on?set.add(name):set.delete(name)};
  const nodes={};
  const original={
    '.dy-hero .dy-kicker':'📍 Descubre lo mejor de tu zona',
    '.dy-hero h1':'Negocios locales <span>cerca de ti</span>',
    '.dy-hero-copy > p':'Encuentra negocios, productos y ofertas cerca de ti.',
    '.dy-hero .dy-visual-overlay .dy-live-pill':'DatoYa'
  };
  for(const [key,html] of Object.entries(original)){
    const attrs=new Map();
    nodes['.dy-home '+key]={innerHTML:html,hasAttribute:k=>attrs.has(k),setAttribute:(k,v)=>attrs.set(k,v),getAttribute:k=>attrs.get(k),removeAttribute:k=>attrs.delete(k),attrs};
  }
  const document={
    documentElement:{classList},
    querySelector:key=>nodes[key]||null,
    querySelectorAll:key=>key==='.dy-home [data-dy-season-original]'?Object.values(nodes).filter(n=>n.hasAttribute('data-dy-season-original')):[],
    hidden:false,
    addEventListener:(type,fn)=>{handlers['doc:'+type]=fn;}
  };
  const MockDate=class extends Date{constructor(...args){super(...(args.length?args:[now]));}};
  const window={addEventListener:(type,fn)=>{handlers[type]=fn;},setInterval:(fn,ms)=>{timers.push({fn,ms});return 1}};
  const context={document,window,Date:MockDate,Intl,setTimeout:fn=>fn()};
  vm.runInNewContext(source,context,{timeout:4000,filename:'seasonal_halloween_ui.js'});
  return {window,nodes,original,timers,handlers,set,isActive:()=>set.has('dy-season-halloween'),time:value=>{now=value}};
}
test('El tema se activa en octubre 2026 y se apaga el 1 de noviembre según Chile',()=>{
  const s=scene();
  const active=s.window.__datoyaSeasonalTheme.isActiveAt;
  for(const value of ['2026-10-01T03:00:00Z','2026-10-21T15:00:00Z','2026-11-01T02:59:59Z']){
    assert.equal(active(new Date(value)),true,'Se esperaba Halloween en '+value);
  }
  for(const value of ['2026-10-01T02:59:59Z','2026-11-01T03:00:00Z','2026-11-04T12:00:00Z','2027-10-31T12:00:00Z']){
    assert.equal(active(new Date(value)),false,'No debe seguir Halloween en '+value);
  }
});
test('La portada cambia solo textos comerciales y se restaura sin recargar en noviembre',()=>{
  const s=scene();assert.equal(s.isActive(),true);
  assert.equal(s.nodes['.dy-home .dy-hero h1'].innerHTML,'Halloween llegó <span>a DatoYa 🎃</span>');
  assert.equal(s.nodes['.dy-home .dy-hero .dy-kicker'].innerHTML,'🎃 EDICIÓN HALLOWEEN · OCTUBRE 2026');
  assert.equal(s.timers.length,1);assert.equal(s.timers[0].ms,60000);
  s.time('2026-11-01T03:00:00Z');s.timers[0].fn();
  assert.equal(s.isActive(),false);
  for(const [key,html] of Object.entries(s.original)){
    const n=s.nodes['.dy-home '+key];
    assert.equal(n.innerHTML,html,'Restauración de '+key);
    assert.equal(n.hasAttribute('data-dy-season-original'),false);
  }
});
test('El tema vuelve a aplicarse cuando la portada se vuelve a renderizar',()=>{
  const s=scene();
  const title=s.nodes['.dy-home .dy-hero h1'];
  title.innerHTML=s.original['.dy-hero h1'];
  title.attrs.clear();
  s.handlers['datoya:market-home-rendered']();
  assert.match(title.innerHTML,/Halloween llegó/);
});
test('Tema visual abarca inicio, categorías, avisos, negocios, cuentas y panel admin',()=>{
  for(const selector of ['.dy-hero','.dy-category','.dy-business-card','.dy-live-card','.dy-beta-page','.dy-notification.unread','.dy-account-page','.dy-admin-v2','.dy-commerce-page']){
    assert.ok(css.includes(selector),'No hay estilos para '+selector);
  }
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(css,/html\.dy-season-halloween/);
  assert.doesNotMatch(source,/\/api\/|fetch\(|payment|checkout|commission|order\/create/i);
});
test('Los assets se cargan en último lugar y en caché de la PWA',()=>{
  assert.match(startup,/require\('\.\/pwa_install_assets'\);require\('\.\/seasonal_halloween_assets'\)/);
  assert.match(assets,/seasonal_halloween\.css/);
  assert.match(assets,/seasonal_halloween_ui\.js/);
  assert.match(sw,/const CACHE='datoya-shell-v(1[2-9][0-9]|[2-9][0-9]{2,})'/);
  assert.match(sw,/\/seasonal_halloween\.css/);
  assert.match(sw,/\/seasonal_halloween_ui\.js/);
});

test('Banner compacto de Halloween muestra más contenido y no repite la marca',()=>{
  assert.match(css,/Banner Halloween compacto/);
  assert.match(css,/\.dy-hero > \.dy-season-hero-web/);
  assert.match(css,/\.dy-search-submit/);
  assert.doesNotMatch(source,/dy-season-hero-brand|dy-season-logo-bat/);
});
