'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const script=fs.readFileSync('pwa_install_ui.js','utf8');
const styles=fs.readFileSync('pwa_install.css','utf8');
const assets=fs.readFileSync('pwa_install_assets.js','utf8');
const entry=fs.readFileSync('production_start.js','utf8');
const manifest=JSON.parse(fs.readFileSync('manifest.webmanifest','utf8'));
const sw=fs.readFileSync('service-worker.js','utf8');
test('manifest provides official standalone experience and brand icons',()=>{
 assert.equal(manifest.name.startsWith('DatoYa'),true);
 assert.equal(manifest.short_name,'DatoYa');
 assert.equal(manifest.start_url,'/#/');
 assert.equal(manifest.scope,'/');
 assert.equal(manifest.display,'standalone');
 assert.ok(manifest.icons.some(icon=>icon.sizes==='192x192'));
 assert.ok(manifest.icons.some(icon=>icon.sizes==='512x512'));
});
test('site ships native install prompt and a manual browser fallback, not an APK',()=>{
 assert.match(script,/beforeinstallprompt/);
 assert.match(script,/appinstalled/);
 assert.match(script,/installPrompt\.prompt\(\)/);
 assert.match(script,/Agregar a pantalla/);
 assert.match(script,/navigator\.serviceWorker\.register/);
 assert.match(script,/isInstalled/);
 assert.match(script,/datoya-native-app/);
 assert.match(script,/dy-pwa-install-panel/);
 assert.doesNotMatch(script,/\.apk\b|fuentes desconocidas|ignora las advertencias/i);
});
test('CSS and deployment install assets are present and versioned',()=>{
 assert.match(styles,/#dy-pwa-install-dialog\[hidden\]/);
 assert.match(styles,/\[hidden\]\{display:none!important\}/);
 assert.match(assets,/pwa_install_ui\.js/);
 assert.match(assets,/pwa_install\.css/);
 assert.match(assets,/20261020-install1/);
 assert.match(entry,/require\('\.\/pwa_install_assets'\)/);
 assert.match(sw,/datoya-shell-v117/);
 assert.match(sw,/\/pwa_install_ui\.js/);
 assert.match(sw,/\/pwa_install\.css/);
});
