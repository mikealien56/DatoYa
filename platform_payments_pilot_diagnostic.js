'use strict';
// Read-only, operator-controlled payment reconciliation diagnostic.
// Never creates a checkout, updates money states, or logs personal/payment credentials.
const {db}=require('./db'),mp=require('./platform_payments_service');
async function run(){
 if(process.env.MP_PLATFORM_PILOT_DIAGNOSTIC!=='true')return;
 const cfg=mp.config();
 if(!cfg.checkout||!cfg.pilotOnly||!cfg.pilotUserId)return;
 const row=db.prepare("SELECT id,reference,kind,user_id,amount,status,preference_id FROM platform_service_payments WHERE user_id=? AND kind='club' AND status='pending' AND preference_id IS NOT NULL ORDER BY id DESC LIMIT 1").get(cfg.pilotUserId);
 if(!row)return console.info('[DatoYa][MP diagnose] no pending pilot');
 const report={stage:'start',kind:row.kind,pending:true,amount:Number(row.amount),mode:cfg.mode};
 try{
  report.stage='preference';
  const pref=await mp.request('GET','/checkout/preferences/'+encodeURIComponent(row.preference_id));
  report.preferenceMatch=mp.verifyPreference(pref,row);
  report.prefFields={hasItems:Array.isArray(pref.items),hasExternalReference:!!pref.external_reference,hasId:!!pref.id};
  if(!report.preferenceMatch){console.warn('[DatoYa][MP diagnose]',JSON.stringify(report));return;}
  report.stage='payments_search';
  const found=await mp.request('GET','/v1/payments/search?external_reference='+row.reference);
  report.foundPayments=Array.isArray(found.results)?found.results.length:0;
  if(!Array.isArray(found.results)){report.hasResultsArray=false;console.warn('[DatoYa][MP diagnose]',JSON.stringify(report));return;}
  for(const item of found.results.slice(0,5)){
    if(!/^[0-9]{1,25}$/.test(String(item.id)))continue;
    report.stage='payment_get';
    const payment=await mp.request('GET','/v1/payments/'+item.id);
    const check=mp.verifyPayment(payment,row);
    report.payment={status:check.status,valid:check.valid,approved:check.approved,review:check.review,
      refMatches:String(payment.external_reference)===String(row.reference),
      collectorMatches:String(payment.collector_id)===String(cfg.collector),
      amountMatches:Number(payment.transaction_amount)===Number(row.amount),
      currencyMatches:payment.currency_id==='CLP',
      modeMatches:payment.live_mode===(cfg.mode==='production'),
      orderIDPresent:!!payment.order?.id,
      merchantOrderIDPresent:!!payment.order?.id,
      hasMerchantOrderField:!!payment.order};
    if(!check.approved)continue;
    if(!/^[0-9]{1,25}$/.test(String(payment.order?.id||'')))continue;
    report.stage='merchant_order';
    const order=await mp.request('GET','/merchant_orders/'+payment.order.id);
    report.merchantOrderMatches=mp.verifyMerchantOrder(order,row,payment.id);
    report.orderFields={hasId:!!order.id,hasPreferenceId:!!order.preference_id,
      referenceMatches:String(order.external_reference)===String(row.reference),
      prefMatches:String(order.preference_id)===String(row.preference_id),
      amountMatches:Number(order.total_amount)===Number(row.amount),
      paymentIdMatches:Array.isArray(order.payments)&&order.payments.some(x=>String(x.id)===String(payment.id)),
      statuses:Array.isArray(order.payments)?order.payments.map(x=>String(x.status)).slice(0,4):[]};
    break;
  }
  report.stage='complete';
  console.info('[DatoYa][MP diagnose]',JSON.stringify(report));
 }catch(e){
  report.failure={stage:report.stage,httpStatus:Number(e?.status)||null,errorClass:String(e?.name||'Error')};
  console.warn('[DatoYa][MP diagnose]',JSON.stringify(report));
 }
}
// Diagnostic only. Delayed until server listeners and migrations have completed.
if(process.env.MP_PLATFORM_PILOT_DIAGNOSTIC==='true')setTimeout(()=>run().catch(e=>console.warn('[DatoYa][MP diagnose] unexpected',String(e?.name||'Error'))),4500).unref?.();
module.exports={run};
