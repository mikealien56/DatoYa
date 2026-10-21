const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const read=name=>fs.readFileSync(name,'utf8');
const admin=read('marketplace_admin_v2_ui.js');
const support=read('admin_support_cases_ui.js');
const mobile=read('mobile_app_layout.css');
const css=read('marketplace_admin_v2.css');
const contacts=read('founder_invite_contacts_bootstrap.js');
const production=read('production_start.js');

test('Los scripts de administración y el nuevo servidor no tienen errores de sintaxis',()=>{
  for(const file of ['marketplace_admin_v2_ui.js','admin_support_cases_ui.js','founder_invite_contacts_bootstrap.js']){
    assert.doesNotThrow(()=>new vm.Script(read(file),{filename:file}));
  }
});

test('Cerrar sesión debe permanecer visible en el encabezado móvil',()=>{
  assert.match(mobile,/DATOYA HEADER MOBILE EXIT V1/);
  assert.match(mobile,/#topbar #auth-area>a\[href="#"\]\[onclick\*="logout"\]\{display:inline-flex!important/);
  assert.match(mobile,/#topbar #auth-area \.dy-notification-bell/);
});

test('Filtros de soporte responsivos y con campos identificados',()=>{
  assert.match(support,/dy-support-filter-grid/);
  assert.match(support,/id="dy-support-search"/);
  assert.match(support,/id="dy-support-status"/);
  assert.match(support,/id="dy-support-category"/);
  assert.doesNotMatch(support,/grid-template-columns:minmax\(0,1fr\) 180px 190px/);
  assert.match(css,/@media\(max-width:580px\)/);
  assert.match(css,/\.dy-support-filter-grid\{grid-template-columns:minmax\(0,1fr\)/);
});

test('Invitaciones: elegir existente, buscar, guardar y completar correo',()=>{
  assert.match(admin,/id="dy-founder-select-saved"/);
  assert.doesNotMatch(admin,/id="dy-founder-search-saved"/);
  assert.match(admin,/id="dy-founder-manual-inputs"/);
  assert.match(admin,/id="dy-founder-selected-summary"/);
  assert.match(admin,/id="dy-founder-edit-selection"/);
  assert.match(admin,/<details class="dy-founder-invite-history">/);
  assert.match(admin,/manualInputs\.hidden=prefilled/);
  assert.match(admin,/selectionSummary\.hidden=!prefilled/);
  assert.match(css,/DATOYA FOUNDER INVITES COMPACT V2/);
  assert.match(admin,/id="dy-founder-contact-open"/);
  assert.match(admin,/id="dy-founder-contact-form"/);
  assert.match(admin,/const choices=\[/);
  assert.match(admin,/contacts\.map/);
  assert.match(admin,/invites\.filter/);
  assert.match(admin,/registered\.filter/);
  assert.match(admin,/selectBusiness\?\.addEventListener\('change'/);
  assert.match(admin,/name='business_name'|name="business_name"/);
  assert.match(admin,/api\('\/admin\/marketplace-v2\/invite-contacts'/);
  assert.match(admin,/api\('\/admin\/marketplace-v2\/founder-invites'/);
});

test('Los contactos son privados del admin, opcionales y persistentes',()=>{
  assert.match(production,/require\('\.\/founder_invite_contacts_bootstrap'\)/);
  assert.match(contacts,/CREATE TABLE IF NOT EXISTS founder_invite_contacts/);
  assert.match(contacts,/app\.get\('\/api\/admin\/marketplace-v2\/invite-contacts',auth,requireRole\('admin'\)/);
  assert.match(contacts,/app\.post\('\/api\/admin\/marketplace-v2\/invite-contacts',auth,requireRole\('admin'\)/);
  assert.match(contacts,/WHERE created_by_user_id=\?/);
  assert.match(contacts,/req\.user\.id/);
  assert.match(contacts,/email\|\|null/);
});
