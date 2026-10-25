import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { request as httpRequest } from 'node:http';
import path from 'node:path';

const base = 'http://127.0.0.1:19373/api';
const password = 'BackendTestPassword123!';
let directory: string;
let server: ChildProcess;
let catalog: any[];
const cookies: Record<string,string> = {};
const ids = { buyer:'user_buyer_1', seller:'user_seller_1', admin:'user_admin_1' };
let funded: any;
let listing: any;
let durableOrder: any;
const dbPath = () => path.join(directory, 'governance', 'veripay.sqlite');
async function api(route: string, role = 'buyer', body?: unknown, method = body === undefined ? 'GET' : 'POST') {
  const result = await fetch(base + route, { method, headers:{'Content-Type':'application/json', ...(cookies[role] ? {Cookie:cookies[role]} : {})},
    ...(body === undefined ? {} : {body:JSON.stringify(body)}), signal:AbortSignal.timeout(15000) });
  return {status:result.status, data:await result.json()};
}
async function login() {
  for (const [role,email] of Object.entries({buyer:'amara.okafor@example.com',seller:'contact@lagosluxuryhub.ng',admin:'tunde.risk@veripay.ng'})) {
    const result = await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
    assert.equal(result.status,200);
    cookies[role] = result.headers.get('set-cookie')!.split(';')[0];
  }
}
async function start(sandbox = 'true', filename = dbPath()) {
  server = spawn(process.execPath,['--import','tsx','server.ts'],{cwd:process.cwd(),env:{...process.env,PORT:'19373',NODE_ENV:'production',GEMINI_API_KEY:'',VERIPAY_SANDBOX_PAYMENTS:sandbox,VERIPAY_DB_PATH:filename,VERIPAY_ADMIN_DATA_DIR:path.join(directory,'governance'),VERIPAY_UPLOAD_DIR:path.join(directory,'uploads'),VERIPAY_DEMO_PASSWORD:password},windowsHide:true,stdio:['ignore','pipe','pipe']});
  await new Promise<void>((resolve,reject) => {
    let output = '';
    const timeout = setTimeout(() => reject(new Error('Backend did not start: '+output)),30000);
    server.stderr!.on('data',chunk=>{output+=chunk;});
    server.stdout!.on('data',chunk=>{output+=chunk;if(output.includes('Server running on port')){clearTimeout(timeout);resolve();}});
    server.once('error',error=>{clearTimeout(timeout);reject(error);});
    server.once('exit',code=>{clearTimeout(timeout);reject(new Error(`Backend exited ${code}: ${output}`));});
  });
  await login();
}
async function stop() {
  if(server && server.exitCode === null) await new Promise<void>(resolve=>{server.once('exit',()=>resolve());server.kill();});
}
async function create(product = catalog.find(product=>product.sellerId===ids.seller), quantity = 1) {
  const result = await api('/orders','buyer',{deliveryAddress:'15 Test Street, Lagos',items:[{productId:product.id,quantity}]});
  assert.equal(result.status,201,JSON.stringify(result.data));
  return result.data;
}
async function confirm(order: any) {
  const result = await api(`/orders/${order.id}/confirm`,'buyer',{buyerResponse:'YES_CONFIRMED',confirmationText:'Forged agreement from the browser'});
  assert.equal(result.status,200,JSON.stringify(result.data));
  assert.doesNotMatch(result.data.confirmationText,/Forged/);
}
async function pay(order: any) {
  await confirm(order);
  const result = await api(`/orders/${order.id}/pay`,'buyer',{});
  assert.equal(result.status,200,JSON.stringify(result.data));
}
function database(action: (db: DatabaseSync)=>void) {
  const db = new DatabaseSync(dbPath());
  try { action(db); } finally { db.close(); }
}
before(async()=>{
  await mkdir(path.join(process.cwd(),'tmp'),{recursive:true});
  directory = await mkdtemp(path.join(process.cwd(),'tmp','backend-test-'));
  await start();
  catalog = (await api('/products')).data;
});
after(async()=>{
  await stop();
  if (directory) {
    assert.equal(path.dirname(path.resolve(directory)),path.resolve(process.cwd(),'tmp'));
    assert.ok(path.basename(directory).startsWith('backend-test-'));
    await rm(directory,{recursive:true,force:true});
  }
});

test('health, API errors, wallets and ledger enforce authentication and roles',async()=>{
  const health = await api('/health','anonymous');
  assert.equal(health.data.storage.engine,'sqlite');
  assert.equal(health.data.payments,'sandbox');
  assert.equal((await api('/wallet','anonymous')).status,401);
  assert.equal((await api('/wallet/topup','seller',{amount:10})).status,403);
  assert.equal((await api('/unknown','buyer')).status,404);
  for(const amount of [-1,0,1.001,'10',null,1e20]) assert.equal((await api('/wallet/topup','buyer',{amount})).status,400);
  const wallet = (await api('/wallet')).data;
  assert.equal((await api('/wallet/topup','buyer',{amount:123.45})).data.available,wallet.available+123.45);
  const malformed = await fetch(base+'/orders',{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookies.buyer},body:'{broken'});
  assert.equal(malformed.status,400);
  assert.equal(typeof (await malformed.json()).error,'string');
});

test('checkout rejects malformed quantities, unavailable variants, mixed sellers and duplicate stock claims',async()=>{
  const count = (await api('/orders')).data.length;
  const product = catalog[0];
  const other = catalog.find(item=>item.sellerId!==product.sellerId);
  for(const items of [null,[],[null],[{productId:product.id,quantity:-1}],[{productId:product.id,quantity:0.5}], [{productId:'missing',quantity:1}], [{productId:product.id,quantity:1,variantName:'missing'}], [{productId:product.id,quantity:1},{productId:other.id,quantity:1}], [{productId:product.id,quantity:product.stock},{productId:product.id,quantity:1}]]) {
    assert.equal((await api('/orders','buyer',{deliveryAddress:'Valid address',items})).status,400);
  }
  assert.equal((await api('/orders','buyer',{items:[{productId:product.id,quantity:1}]})).status,400);
  assert.equal((await api('/orders')).data.length,count);
});

test('concurrent payments fund escrow and decrement stock exactly once',async()=>{
  funded = await create();
  assert.equal((await api(`/orders/${funded.id}/pay`,'buyer',{})).status,400);
  assert.equal((await api(`/orders/${funded.id}/confirm`,'buyer',{})).status,400);
  assert.equal((await api(`/orders/${funded.id}/delivery-confirm`,'buyer',{})).status,400);
  await confirm(funded);
  assert.equal((await api(`/orders/${funded.id}/confirm`,'buyer',{buyerResponse:'YES_CONFIRMED'})).status,400);
  const wallet = (await api('/wallet')).data;
  const stock = (await api(`/products/${funded.items[0].productId}`)).data.stock;
  const payments = await Promise.all([api(`/orders/${funded.id}/pay`,'buyer',{}),api(`/orders/${funded.id}/pay`,'buyer',{})]);
  assert.deepEqual(payments.map(item=>item.status).sort(),[200,400]);
  assert.equal((await api('/wallet')).data.available,Math.round((wallet.available-funded.totalAmount)*100)/100);
  assert.equal((await api('/wallet')).data.held,Math.round((wallet.held+funded.totalAmount)*100)/100);
  assert.equal((await api(`/products/${funded.items[0].productId}`)).data.stock,stock-1);
  assert.equal((await api(`/orders/${funded.id}/snapshot`)).data.intact,true);
  assert.equal((await api('/wallet/ledger')).data.filter((entry:any)=>entry.orderId===funded.id&&entry.reason==='ESCROW_FUNDED').length,1);
});

test('dispatch requires a contact; completed escrow cannot be settled again',async()=>{
  assert.equal((await api(`/orders/${funded.id}/dispatch`,'seller',{})).status,422);
  assert.equal((await api(`/orders/${funded.id}/dispatch-contact`,'seller',{type:'BOGUS',name:'Test rider',phone:'08031234567'})).status,400);
  assert.equal((await api(`/orders/${funded.id}/dispatch-contact`,'seller',{type:'RIDER',name:'Test rider',phone:'08031234567'})).status,200);
  const dispatch = await api(`/orders/${funded.id}/dispatch`,'seller',{});
  assert.equal(dispatch.status,200);
  assert.ok(Date.parse(dispatch.data.expectedDeliveryAt)>Date.parse(dispatch.data.dispatchedAt));
  assert.equal((await api(`/orders/${funded.id}/dispatch`,'seller',{})).status,409);
  const balance = (await api('/wallet','seller')).data.available;
  assert.equal((await api(`/orders/${funded.id}/delivery-confirm`,'buyer',{})).status,200);
  assert.equal((await api(`/orders/${funded.id}/delivery-confirm`,'buyer',{})).status,400);
  assert.equal((await api('/wallet','seller')).data.available,Math.round((balance+funded.subtotal)*100)/100);
  assert.equal((await api(`/orders/${funded.id}/receipt`)).status,200);
  assert.equal((await api('/disputes','buyer',{orderId:funded.id,reason:'NON_DELIVERY',details:'Invalid late dispute',claimedAmount:funded.totalAmount})).status,400);
});

test('dispute decisions validate outcomes, protect recommendations and settle refunds and splits once',async()=>{
  for(const decision of ['BUYER_REFUNDED','SPLIT']) {
    const order = await create(catalog.find(product=>product.name.includes('Weekender')));
    await pay(order);
    const opened = await api('/disputes','buyer',{orderId:order.id,reason:'NON_DELIVERY',details:'The package was never received by the buyer.',claimedAmount:order.totalAmount});
    assert.equal(opened.status,201,JSON.stringify(opened.data));
    assert.equal(opened.data.aiRecommendation,undefined);
    const disputeId = opened.data.id;
    assert.ok((await api(`/disputes/${disputeId}`,'admin')).data.aiRecommendation);
    assert.equal((await api('/disputes','buyer',{orderId:order.id,reason:'NON_DELIVERY',details:'Duplicate dispute attempt',claimedAmount:order.totalAmount})).status,400);
    assert.equal((await api(`/disputes/${disputeId}/decision`,'admin',{decision:'INVALID',rationale:'Invalid outcome should not settle escrow.'})).status,400);
    assert.equal((await api(`/disputes/${disputeId}`,'admin')).data.state,'REVIEWER_QUEUE');
    const info = await api(`/disputes/${disputeId}/info-requests`,'admin',{requestedFrom:'BUYER',question:'Please confirm the delivery address.'});
    assert.equal(info.status,201);
    assert.equal((await api(`/disputes/${disputeId}/respond`,'seller',{requestId:info.data.id,responseText:'Spoofed buyer response'})).status,403);
    assert.equal((await api(`/disputes/${disputeId}/respond`,'buyer',{requestId:info.data.id,responseText:'The delivery address is correct.'})).status,200);
    const wallet = (await api('/wallet')).data;
    const results = await Promise.all([1,2].map(()=>api(`/disputes/${disputeId}/decision`,'admin',{decision,rationale:'Reviewer confirmed evidence and approved this outcome.'})));
    assert.deepEqual(results.map(result=>result.status).sort(),[200,400]);
    const refund = decision === 'BUYER_REFUNDED' ? order.totalAmount : Math.floor(Math.round(order.totalAmount*100)/2)/100;
    assert.equal((await api('/wallet')).data.available,Math.round((wallet.available+refund)*100)/100);
    const ledger = (await api('/wallet/ledger','admin')).data.filter((entry:any)=>entry.orderId===order.id);
    const escrowIn = ledger.filter((entry:any)=>entry.to===`escrow:${order.id}`).reduce((sum:number,entry:any)=>sum+entry.amountKobo,0);
    const escrowOut = ledger.filter((entry:any)=>entry.from===`escrow:${order.id}`).reduce((sum:number,entry:any)=>sum+entry.amountKobo,0);
    assert.equal(escrowIn,escrowOut);
    assert.equal((await api(`/disputes/${disputeId}/evidence`,'buyer',{type:'PHOTO',title:'Late evidence',description:'Cannot add evidence after decision.'})).status,400);
  }
});

test('releasing an unpaid risk hold never invents a payment',async()=>{
  const risk = (await api('/admin/risk/queue','admin')).data.assessments.find((item:any)=>item.state==='HELD');
  assert.ok(risk);
  const ledger = (await api('/wallet/ledger','admin')).data;
  assert.equal((await api(`/admin/risk/${risk.id}/resolve`,'admin',{action:'RELEASE_HOLD',resolutionNotes:'Reviewed the identity evidence for this test.'})).status,200);
  const result = await api(`/orders/${risk.subjectId}`,'admin');
  assert.ok(['AWAITING_CONFIRMATION','PENDING_PAYMENT'].includes(result.data.order.state));
  assert.deepEqual((await api('/wallet/ledger','admin')).data,ledger);
});

test('database failure rolls back wallet, ledger and audit changes before returning a response',async()=>{
  const wallet = (await api('/wallet')).data;
  const ledger = (await api('/wallet/ledger')).data;
  const audit = (await api('/audit-logs','admin')).data;
  database(db=>db.exec("CREATE TRIGGER simulate_disk_failure BEFORE UPDATE ON documents WHEN NEW.name='finance' BEGIN SELECT RAISE(ABORT, 'test write failure'); END;"));
  try { assert.equal((await api('/wallet/topup','buyer',{amount:100})).status,503); }
  finally { database(db=>db.exec('DROP TRIGGER simulate_disk_failure')); }
  assert.deepEqual((await api('/wallet')).data,wallet);
  assert.deepEqual((await api('/wallet/ledger')).data,ledger);
  assert.deepEqual((await api('/audit-logs','admin')).data,audit);
});

test('database seals prevent changing or deleting snapshots, audit entries and ledger entries',()=>{
  database(db=>{
    for(const table of ['audit_seals','purchase_seals','ledger_seals']) {
      assert.throws(()=>db.exec(`UPDATE ${table} SET payload='{}'`),/immutable/);
      assert.throws(()=>db.exec(`DELETE FROM ${table}`),/immutable/);
    }
    assert.equal((db.prepare('PRAGMA integrity_check').get() as any).integrity_check,'ok');
  });
});

test('an interrupted document upload does not block subsequent API requests',async()=>{
  await new Promise<void>(resolve=>{
    const req = httpRequest(base+'/verification/documents',{method:'POST',headers:{Cookie:cookies.buyer,'Content-Type':'image/png','Content-Length':100000}},res=>res.resume());
    req.on('error',()=>resolve());
    req.write(Buffer.alloc(100));
    setTimeout(()=>{req.destroy();resolve();},30);
  });
  assert.equal((await api('/wallet')).status,200);
});

test('orders, inventory, reviews, credentials, trust, audit and wallets survive restart',async()=>{
  listing = (await api('/seller/products','seller',{name:'Persistent test listing',price:100,stock:2,variants:[]})).data;
  assert.ok(listing.id);
  assert.equal((await api(`/admin/products/${listing.id}/moderate`,'admin',{status:'PUBLISHED',notes:'Approved persistent test listing.'})).status,200);
  durableOrder = await create(listing);
  await pay(durableOrder);
  assert.equal((await api(`/products/${listing.id}/reviews`,'buyer',{rating:5,comment:'A persistent test review.'})).status,200);
  const before = {wallet:(await api('/wallet')).data,orders:(await api('/orders')).data,trust:(await api(`/users/${ids.seller}/passport`)).data,audit:(await api('/audit-logs','admin')).data,ledger:(await api('/wallet/ledger')).data};
  await stop();
  await start();
  assert.deepEqual((await api('/wallet')).data,before.wallet);
  assert.deepEqual((await api('/orders')).data,before.orders);
  assert.deepEqual((await api(`/users/${ids.seller}/passport`)).data,before.trust);
  assert.deepEqual((await api('/audit-logs','admin')).data,before.audit);
  assert.deepEqual((await api('/wallet/ledger')).data,before.ledger);
  assert.equal((await api(`/products/${listing.id}`)).data.stock,1);
  assert.equal((await api(`/products/${listing.id}/reviews`)).data.reviews[0].comment,'A persistent test review.');
  assert.equal((await api(`/orders/${durableOrder.id}/snapshot`)).data.intact,true);
});

test('maintenance reconciles the ledger and creates a backup that can run the app',async()=>{
  const env = {...process.env,VERIPAY_DB_PATH:dbPath()};
  const run = (...args:string[])=>execFileSync(process.execPath,['--import','tsx','scripts/database.ts',...args],{cwd:process.cwd(),env,encoding:'utf8',windowsHide:true});
  assert.match(run('check'),/reconciliation passed/);
  const backup = path.join(directory,'backup.sqlite');
  assert.match(run('backup',backup),/backup saved/);
  const wallet = (await api('/wallet')).data;
  await stop();
  await start('true',backup);
  assert.deepEqual((await api('/wallet')).data,wallet);
  assert.equal((await api(`/products/${listing.id}`)).data.stock,1);
  assert.equal((await api(`/orders/${durableOrder.id}/snapshot`)).data.intact,true);
});

test('sandbox can be disabled without pretending a real payment provider exists',async()=>{
  await stop();
  await start('false');
  assert.equal((await api('/health')).data.payments,'unconfigured');
  assert.equal((await api('/wallet/topup','buyer',{amount:100})).status,400);
  const order = await create(listing);
  await confirm(order);
  const payment = await api(`/orders/${order.id}/pay`,'buyer',{});
  assert.equal(payment.status,400);
  assert.match(payment.data.error,/provider is not configured/);
});
