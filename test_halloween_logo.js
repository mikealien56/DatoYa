const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('seasonal_halloween_ui.js','utf8');
const css = fs.readFileSync('seasonal_halloween.css','utf8');
const assets = fs.readFileSync('seasonal_halloween_assets.js','utf8');

function runLogoScene(start='2026-10-21T12:00:00Z') {
  let current = start, interval;
  const set = new Set(), handlers = {};
  const classList = {
    contains:k=>set.has(k), toggle:(k,v)=>v?set.add(k):set.delete(k)
  };
  function elt(tag) {
    const attrs = new Map(), children = [];
    const e = {
      tagName:tag, className:'', innerHTML:'', children, parentNode:null,
      attrs, setAttribute:(k,v)=>attrs.set(k,v), getAttribute:k=>attrs.get(k),
      hasAttribute:k=>attrs.has(k), removeAttribute:k=>attrs.delete(k),
      appendChild:n=>{n.parentNode=e;children.push(n);return n;},
      insertBefore:(n,before)=>{n.parentNode=e;const pos=children.indexOf(before);children.splice(pos<0?0:pos,0,n);return n;},
      querySelector:sel=>children.find(n=>sel==='[data-dy-season-logo]'?n.hasAttribute('data-dy-season-logo'):sel==='[data-dy-season-brand]'&&n.hasAttribute('data-dy-season-brand'))||null,
      remove:()=>{if(e.parentNode){const a=e.parentNode.children,i=a.indexOf(e);if(i>=0)a.splice(i,1);e.parentNode=null;}}
    };
    Object.defineProperty(e,'firstChild',{get:()=>children[0]||null});
    return e;
  }
  const header = elt('a'), originalLogo=elt('img');
  originalLogo.src='/brand/datoya-logo-horizontal.png?v=20260917-3';
  header.appendChild(originalLogo);
  const hero=elt('div'), previousHeroText=elt('p');
  previousHeroText.innerHTML='Texto original del héroe';
  hero.appendChild(previousHeroText);
  const doc = {
    documentElement:{classList}, hidden:false, createElement:elt,
    querySelector:s=>s==='#topbar a.logo'?header:s==='.dy-home .dy-hero'?hero:null,
    querySelectorAll:s=>s==='[data-dy-season-logo],[data-dy-season-brand]'?
      [header,hero,...hero.children].flatMap(node=>node.children.filter(child=>child.hasAttribute('data-dy-season-logo')||child.hasAttribute('data-dy-season-brand'))):[],
    addEventListener:(k,v)=>{handlers['doc:'+k]=v;}
  };
  const NowDate=class extends Date { constructor(...args){super(...(args.length?args:[current]));}};
  const win={addEventListener:(k,v)=>{handlers[k]=v;},setInterval:(cb,ms)=>{interval={cb,ms};}};
  vm.runInNewContext(source,{document:doc,window:win,Intl,Date:NowDate,setTimeout:cb=>cb()}, {timeout:3000});
  return {set,header,hero,originalLogo,previousHeroText,handlers,win,time:v=>{current=v;},interval:()=>interval};
}

test('El logo original queda intacto y recibe telaraña/arañita temporal en la cabecera',()=>{
  const x=runLogoScene();
  assert.ok(x.set.has('dy-season-halloween'));
  assert.equal(x.header.children[0],x.originalLogo);
  assert.equal(x.originalLogo.src,'/brand/datoya-logo-horizontal.png?v=20260917-3');
  const decor=x.header.children.find(e=>e.hasAttribute('data-dy-season-logo'));
  assert.ok(decor);
  assert.match(decor.innerHTML,/dy-season-logo-web-art/);
  assert.match(decor.innerHTML,/ellipse|circle/);
  assert.equal(decor.getAttribute('aria-hidden'),'true');
});

test('Banner conserva la telaraña sin duplicar el logo, con el texto original intacto',()=>{
  const x=runLogoScene();
  assert.equal(x.hero.children.some(e=>e.hasAttribute('data-dy-season-brand')),false);
  const decoration=x.hero.children.find(e=>e.hasAttribute('data-dy-season-logo'));
  assert.ok(decoration);
  assert.match(decoration.innerHTML,/dy-season-logo-web-art/);
  assert.equal(decoration.getAttribute('aria-hidden'),'true');
  assert.equal(x.hero.children.includes(x.previousHeroText),true);
});

test('Volver al inicio no duplica la telaraña y recrea el adorno al renderizar',()=>{
  const x=runLogoScene();
  x.win.__datoyaSeasonalTheme.sync();
  x.handlers['datoya:market-home-rendered']();
  assert.equal(x.header.children.filter(e=>e.hasAttribute('data-dy-season-logo')).length,1);
  assert.equal(x.hero.children.filter(e=>e.hasAttribute('data-dy-season-logo')).length,1);
  const decoration=x.hero.children.find(e=>e.hasAttribute('data-dy-season-logo'));
  decoration.remove();
  x.handlers['datoya:market-home-rendered']();
  assert.equal(x.hero.children.filter(e=>e.hasAttribute('data-dy-season-logo')).length,1);
});

test('El 1 de noviembre Chile desaparecen los adornos, pero sigue el logo oficial',()=>{
  const x=runLogoScene();
  x.time('2026-11-01T03:00:00Z');
  x.win.__datoyaSeasonalTheme.sync();
  assert.equal(x.set.has('dy-season-halloween'),false);
  assert.equal(x.header.children.length,1);
  assert.equal(x.header.children[0],x.originalLogo);
  assert.equal(x.hero.children.includes(x.previousHeroText),true);
  assert.equal(x.hero.children.some(e=>e.hasAttribute('data-dy-season-logo')),false);
});

test('Accesibilidad, móviles, y recursos actualizados',()=>{
  assert.match(css,/Logo Halloween elegante/);
  assert.match(css,/pointer-events:none!important/);
  assert.match(css,/@media\(max-width:640px\)/);
  assert.match(css,/html:not\(\.dy-season-halloween\)/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(assets,/20261021-compact-hero3/);
  assert.doesNotMatch(source,/dy-season-hero-brand|dy-season-logo-bat/);
  assert.match(css,/Banner Halloween compacto/);
  assert.doesNotMatch(source,/fetch\(|\/api\/|payment|checkout/i);
});