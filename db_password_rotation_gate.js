'use strict';

const path=require('path');
const {execFileSync}=require('child_process');

if(String(process.env.DATOYA_DB_ROTATE_NOW||'')==='1'){
  const raw=String(process.env.DATABASE_URL||'');
  const nextPassword=String(process.env.DATOYA_DB_ROTATE_TO||'');
  if(!raw) throw new Error('Rotación DB: DATABASE_URL ausente');
  if(nextPassword.length<32) throw new Error('Rotación DB: contraseña nueva inválida');

  const current=new URL(raw);
  const host=String(current.hostname||'').toLowerCase();
  if(!host.endsWith('.neon.tech')) throw new Error('Rotación DB: el host actual no es Neon');
  if(decodeURIComponent(current.username||'')!=='datoya_owner') throw new Error('Rotación DB: rol inesperado');
  if(String(current.pathname||'')!=='/datoya') throw new Error('Rotación DB: base inesperada');

  const next=new URL(current.toString());
  next.password=nextPassword;

  execFileSync(process.execPath,[path.join(__dirname,'scripts','rotate_neon_password_once.js')],{
    stdio:'inherit',
    env:{
      ...process.env,
      DATOYA_DB_ROTATE_OLD_URL:current.toString(),
      DATOYA_DB_ROTATE_NEW_URL:next.toString()
    }
  });

  process.env.DATABASE_URL=next.toString();
  console.log('[DatoYa] Rotación PostgreSQL validada; arranque continúa con la nueva conexión.');
}
