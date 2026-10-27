import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { workspaces } from '../src/shared/workspaces.ts';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { users as seededUsers } from '../src/server/db/store.ts';
const cookies = new Map<string, string>();
const testPassword = 'VeriPayTest123!';

const port = 19371;
const base = `http://127.0.0.1:${port}/api`;
let server: ChildProcess;
let personas: any[];
let products: any[];
let uploadTestDirectory: string;
const persona = (role: string) => personas.find(u => u.role === role);

async function request(path: string, userId?: string, body?: unknown, method = body === undefined ? 'GET' : 'POST') {
  const response = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(userId ? { 'X-Veripay-Persona': userId, Cookie: cookies.get(userId) || '' } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(10000),
  });
  return { status: response.status, data: await response.json() };
}

before(async () => {
  const tempRoot = path.join(process.cwd(), 'tmp');
  await mkdir(tempRoot, { recursive: true });
  uploadTestDirectory = await mkdtemp(path.join(tempRoot, 'test-product-uploads-'));
  server = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
    cwd: process.cwd(), env: { ...process.env, PORT: String(port), NODE_ENV: 'production', AI_PROVIDER: 'rules', VERIPAY_UPLOAD_DIR: uploadTestDirectory, VERIPAY_ADMIN_DATA_DIR: path.join(uploadTestDirectory,'governance'), VERIPAY_DEMO_PASSWORD: testPassword },
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Test server did not start')), 30000);
    let output = '';
    server.stdout!.on('data', chunk => {
      output += chunk;
      if (output.includes('Server running on port')) { clearTimeout(timeout); resolve(); }
    });
    server.once('error', error => { clearTimeout(timeout); reject(error); });
    server.once('exit', code => { clearTimeout(timeout); reject(new Error(`Test server exited: ${code}`)); });
  });
  for (const user of seededUsers) {
    const response = await fetch(base + '/auth/login', {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({email:user.email,password:testPassword}),
    });
    assert.equal(response.status, 200);
    cookies.set(user.id, response.headers.get('set-cookie')!.split(';')[0]);
  }
  personas = (await request('/users', 'user_admin_1')).data;
  products = (await request('/products')).data;
});

after(async () => {
  if (server && server.exitCode === null) {
    await new Promise<void>(resolve => { server.once('exit', () => resolve()); server.kill(); });
  }
  if (uploadTestDirectory) {
    const root = path.resolve(process.cwd(), 'tmp');
    const target = path.resolve(uploadTestDirectory);
    assert.equal(path.dirname(target), root);
    assert.ok(path.basename(target).startsWith('test-product-uploads-'));
    await rm(target, { recursive: true, force: true });
  }
});

test('each role has its own landing page and feature menu', () => {
  assert.equal(workspaces.buyer.home, 'catalog');
  assert.equal(workspaces.seller.home, 'seller_store');
  assert.equal(workspaces.admin.home, 'admin');
  assert.ok(workspaces.admin.tabs.some(t => t.id === 'disputes'));
  assert.ok(personas.every(u => ['buyer', 'seller', 'admin'].includes(u.role)));
  assert.ok(!personas.some(u => u.id === 'user_reviewer_1'));

  for (const role of ['buyer', 'seller'] as const) {
    assert.ok(!workspaces[role].tabs.some(t => t.id === 'risk'));
  }
  assert.ok(!workspaces.seller.tabs.some(t => t.id === 'catalog'));
});

test('missing or unknown sessions cannot access protected features', async () => {
  assert.equal((await request('/orders')).status, 401);
  assert.equal((await request('/orders', 'user_reviewer_1')).status, 401);
  assert.equal((await request('/audit-logs', 'unknown')).status, 401);
});

test('buyers and sellers only receive their own orders and disputes, despite spoofed query roles', async () => {
  for (const user of personas.filter(u => ['buyer', 'seller'].includes(u.role))) {
    const result = await request('/orders?role=admin&userId=user_admin_1', user.id);
    assert.equal(result.status, 200);
    assert.ok(result.data.every((o: any) => o[user.role === 'buyer' ? 'buyerId' : 'sellerId'] === user.id));
    const disputes = await request('/disputes', user.id);
    assert.equal(disputes.status, 200);
    assert.ok(disputes.data.every((d: any) => result.data.some((o: any) => o.id === d.orderId)));
    const allOrders = (await request('/orders', persona('admin').id)).data;
    const foreign = allOrders.find((o: any) => o[user.role === 'buyer' ? 'buyerId' : 'sellerId'] !== user.id);
    if (foreign) assert.equal((await request(`/orders/${foreign.id}`, user.id)).status, 403);
  }
});

test('shopping, risk, audit and dispute actions are restricted by role', async () => {
  for (const user of personas) {
    assert.equal((await request('/admin/risk/queue', user.id)).status, user.role === 'admin' ? 200 : 403);
    assert.equal((await request('/audit-logs', user.id)).status, user.role === 'admin' ? 200 : 403);
    if (user.role !== 'buyer') assert.equal((await request('/orders', user.id, {})).status, 403);
    if (user.role !== 'seller') assert.equal((await request('/seller/products', user.id, {})).status, 403);
  }
  const disputes = (await request('/disputes', persona('admin').id)).data;
  assert.ok(disputes.length > 0);
  assert.equal((await request(`/disputes/${disputes[0].id}/decision`, persona('buyer').id, {})).status, 403);
  assert.equal((await request(`/disputes/${disputes[0].id}/delivery-verification`, persona('buyer').id, {})).status, 403);
});

test('seller ownership cannot be changed by spoofed payloads', async () => {
  const seller = persona('seller');
  const foreignProduct = products.find(p => p.sellerId !== seller.id);
  assert.equal((await request(`/seller/products/${foreignProduct.id}`, seller.id, { sellerId: foreignProduct.sellerId, updates: {price: 1} }, 'PUT')).status, 403);
  const created = await request('/seller/products', seller.id, {
    sellerId: foreignProduct.sellerId, sellerName: 'Spoofed', name: 'Test listing', price: 10000, variants: [],
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.sellerId, seller.id);
  assert.equal(created.data.sellerName, seller.name);
});

test('purchase and fulfilment actions require the correct role and order owner', async () => {
  const buyer = persona('buyer');
  const product = products[0];
  const created = await request('/orders', buyer.id, {
    buyerId: 'user_flagged_99', buyerName: 'Spoofed', deliveryAddress: 'Local test address',
    items: [{ productId: product.id, quantity: 1 }],
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.buyerId, buyer.id);
  const order = created.data;
  assert.equal((await request(`/orders/${order.id}/pay`, product.sellerId, {})).status, 403);
  assert.equal((await request(`/orders/${order.id}/dispatch-contact`, buyer.id, {})).status, 403);
  const otherBuyer = personas.find(u => u.role === 'buyer' && u.id !== buyer.id);
  assert.equal((await request(`/orders/${order.id}/confirm`, otherBuyer.id, {})).status, 403);
  assert.equal((await request(`/orders/${order.id}/confirm`, buyer.id, {buyerResponse:'YES_CONFIRMED'})).status, 200);
  assert.equal((await request(`/orders/${order.id}/pay`, buyer.id, {})).status, 200);
  const contact = { type:'RIDER', name:'Test Courier', phone:'+2348031234567', sellerId: buyer.id };
  assert.equal((await request(`/orders/${order.id}/dispatch-contact`, product.sellerId, contact)).status, 200);
  assert.equal((await request(`/orders/${order.id}/dispatch`, product.sellerId, {})).status, 200);
  assert.equal((await request(`/orders/${order.id}/delivery-confirm`, buyer.id, {})).data.state, 'COMPLETED');
});

test('private trust factors belong to the active user or staff', async () => {
  const buyer = persona('buyer');
  assert.equal((await request(`/me/passport/factors?userId=${buyer.id}`, buyer.id)).status, 200);
  assert.equal((await request('/me/passport/factors?userId=user_seller_1', buyer.id)).status, 403);
  assert.equal((await request('/me/passport/factors?userId=user_seller_1', persona('admin').id)).status, 200);
});

test('admin handles dispute decisions and is recorded as the acting admin', async () => {
  const admin = persona('admin');
  const disputes = (await request('/disputes', admin.id)).data;
  const result = await request('/disputes/' + disputes[0].id + '/decision', admin.id, {
    decision: 'BUYER_REFUNDED', rationale: 'Admin verified the delivery failure against the supplied evidence.',
    reviewerId: 'user_reviewer_1', reviewerName: 'Spoofed reviewer',
  });
  assert.equal(result.status, 200);
  assert.equal(result.data.decidedBy, admin.name);
  const logs = (await request('/audit-logs', admin.id)).data;
  const decision = logs.find((entry: any) => entry.action === 'DISPUTE_DECIDED');
  assert.equal(decision.actorId, admin.id);
  assert.equal(decision.actorRole, 'admin');
});

test('buyers can review before purchase, update their review, and see accurate averages', async () => {
  const product = products[1];
  const buyer = persona('buyer');
  const otherBuyer = personas.find(u => u.role === 'buyer' && u.id !== buyer.id);
  const path = `/products/${product.id}/reviews`;
  assert.deepEqual((await request(path)).data, { reviews: [], rating: 0, reviewsCount: 0 });
  const created = await request(path, buyer.id, {
    rating: 5, comment: '  I like the design and listed specifications.  ', buyerId: 'spoofed', buyerName: 'Spoofed',
  });
  assert.equal(created.status, 200);
  assert.equal(created.data.rating, 5);
  assert.equal(created.data.reviewsCount, 1);
  const original = created.data.reviews[0];
  assert.equal(original.buyerId, buyer.id);
  assert.equal(original.buyerName, buyer.name);
  assert.equal(original.comment, 'I like the design and listed specifications.');
  const updated = await request(path, buyer.id, {rating: 3, comment: 'Updated opinion after looking at the specifications.'});
  assert.equal(updated.data.reviewsCount, 1);
  assert.equal(updated.data.reviews[0].id, original.id);
  assert.equal(updated.data.reviews[0].createdAt, original.createdAt);
  const second = await request(path, otherBuyer.id, {rating: 4, comment: 'Considering buying this product for the design.'});
  assert.equal(second.status, 200);
  assert.equal(second.data.reviewsCount, 2);
  assert.equal(second.data.rating, 3.5);
  const refreshed = await request(`/products/${product.id}`);
  assert.equal(refreshed.data.rating, 3.5);
  assert.equal(refreshed.data.reviewsCount, 2);
  assert.equal((await request(path)).data.reviewsCount, 2);
});

test('review submissions validate inputs and reject non-buyers and missing products', async () => {
  const path = `/products/${products[1].id}/reviews`;
  const buyer = persona('buyer');
  const valid = {rating: 4, comment: 'A useful product design.'};
  assert.equal((await request(path, undefined, valid)).status, 401);
  for (const role of ['seller', 'admin']) assert.equal((await request(path, persona(role).id, valid)).status, 403);
  for (const rating of [0, 6, 2.5, '5', null]) assert.equal((await request(path, buyer.id, {...valid, rating})).status, 400);
  for (const comment of ['', '  ', 'ab', 'x'.repeat(1001), null]) assert.equal((await request(path, buyer.id, {...valid, comment})).status, 400);
  assert.equal((await request('/products/missing/reviews')).status, 404);
  assert.equal((await request('/products/missing/reviews', buyer.id, valid)).status, 404);
  assert.equal((await request(path)).data.reviewsCount, 2);
});

const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/a9sAAAAASUVORK5CYII=', 'base64');
async function uploadImage(userId: string | undefined, bytes: Buffer, mimeType = 'image/png') {
  return fetch(base + '/seller/product-images', {
    method: 'POST', headers: { 'Content-Type': mimeType, ...(userId ? { 'X-Veripay-Persona': userId, Cookie: cookies.get(userId) || '' } : {}) },
    body: new Uint8Array(bytes), signal: AbortSignal.timeout(10000),
  });
}

test('sellers can upload, serve and attach product images, including replacement images', async () => {
  const seller = persona('seller');
  const upload = await uploadImage(seller.id, tinyPng);
  assert.equal(upload.status, 201);
  const { imageUrl } = await upload.json();
  assert.match(imageUrl, /^\/uploads\/products\/[\da-f-]+\.png$/);
  const image = await fetch(`http://127.0.0.1:${port}${imageUrl}`);
  assert.equal(image.status, 200);
  assert.equal(image.headers.get('content-type'), 'image/png');
  assert.equal(image.headers.get('x-content-type-options'), 'nosniff');
  assert.deepEqual(Buffer.from(await image.arrayBuffer()), tinyPng);
  const created = await request('/seller/products', seller.id, {
    name: 'Product with uploaded image', price: 15000, imageUrl, variants: [],
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.imageUrl, imageUrl);
  const ownedProduct = products.find(p => p.sellerId === seller.id);
  const updated = await request(`/seller/products/${ownedProduct.id}`, seller.id, {updates: {imageUrl}}, 'PUT');
  assert.equal(updated.status, 200);
  assert.equal((await request(`/products/${ownedProduct.id}`,seller.id)).data.imageUrl, imageUrl);
  const otherSeller = personas.find(u => u.role === 'seller' && u.id !== seller.id);
  assert.equal((await request(`/seller/products/${ownedProduct.id}`, otherSeller.id, {updates: {imageUrl}}, 'PUT')).status, 403);
});

test('image uploads reject non-sellers, unsupported files, invalid signatures and oversized files', async () => {
  assert.equal((await uploadImage(undefined, tinyPng)).status, 401);
  for (const role of ['buyer', 'admin']) assert.equal((await uploadImage(persona(role).id, tinyPng)).status, 403);
  const seller = persona('seller');
  assert.equal((await uploadImage(seller.id, Buffer.from('<svg/>'), 'image/svg+xml')).status, 415);
  assert.equal((await uploadImage(seller.id, Buffer.from('not a real image'))).status, 400);
  assert.equal((await uploadImage(seller.id, tinyPng, 'image/jpeg')).status, 400);
  assert.equal((await uploadImage(seller.id, Buffer.alloc(0))).status, 400);
  const tooBig = await uploadImage(seller.id, Buffer.alloc(5 * 1024 * 1024 + 1));
  assert.equal(tooBig.status, 413);
  assert.match((await tooBig.json()).error, /5 MB/);
});

async function login(email: string, password: string) {
  return fetch(base + '/auth/login', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email,password})});
}

test('sign-in issues a protected session cookie, restores the account, and sign-out revokes it', async () => {
  const buyer = persona('buyer');
  const signedIn = await login('  ' + buyer.email.toUpperCase() + '  ', testPassword);
  assert.equal(signedIn.status, 200);
  const cookieHeader = signedIn.headers.get('set-cookie')!;
  assert.match(cookieHeader, /HttpOnly/i);
  assert.match(cookieHeader, /SameSite=Lax/i);
  assert.match(cookieHeader, /Max-Age=28800/i);
  const cookie = cookieHeader.split(';')[0];
  assert.equal((await signedIn.json()).user.id, buyer.id);
  const me = await fetch(base + '/auth/me', {headers:{Cookie:cookie}});
  assert.equal(me.status, 200);
  assert.equal((await me.json()).user.id, buyer.id);
  const oldHeaderOnly = await fetch(base + '/orders', {headers:{'X-Veripay-Persona':'user_admin_1'}});
  assert.equal(oldHeaderOnly.status, 401);
  const spoofed = await fetch(base + '/admin/risk/queue', {headers:{Cookie:cookie,'X-Veripay-Persona':'user_admin_1'}});
  assert.equal(spoofed.status, 403);
  assert.equal((await request('/users')).status, 401);
  assert.equal((await request('/users', buyer.id)).status, 403);
  const out = await fetch(base + '/auth/logout', {method:'POST',headers:{Cookie:cookie}});
  assert.equal(out.status, 200);
  assert.match(out.headers.get('set-cookie')!, /Expires=Thu, 01 Jan 1970/i);
  assert.equal((await fetch(base + '/auth/me', {headers:{Cookie:cookie}})).status, 401);
  assert.equal((await fetch(base + '/orders', {headers:{Cookie:cookie}})).status, 401);
});

test('sign-in validates credentials, blocks cross-site writes, and limits repeated failures', async () => {
  const buyer = persona('buyer');
  const wrong = await login(buyer.email, 'incorrect-password');
  assert.equal(wrong.status, 401);
  assert.equal((await wrong.json()).error, 'Email or password is incorrect');
  const unknown = await login('nobody@example.com', 'incorrect-password');
  assert.equal((await unknown.json()).error, 'Email or password is incorrect');
  assert.equal((await login('', '')).status, 400);
  const crossSite = await fetch(base + '/auth/login', {method:'POST',headers:{'Content-Type':'application/json',Origin:'https://another.example'},body:JSON.stringify({email:buyer.email,password:testPassword})});
  assert.equal(crossSite.status, 403);
  for (let i = 0; i < 4; i++) assert.equal((await login(buyer.email, 'incorrect-password')).status, 401);
  const limited = await login(buyer.email, 'incorrect-password');
  assert.equal(limited.status, 429);
  assert.ok(limited.headers.get('retry-after'));
  const hints = await request('/auth/demo-accounts');
  assert.equal(hints.data.demoPassword, null);
});

test('admin control endpoints reject buyers, sellers and anonymous callers', async () => {
  assert.equal((await request('/admin/control')).status,401);
  for(const role of ['buyer','seller']) {
    const id=persona(role).id;
    assert.equal((await request('/admin/control',id)).status,403);
    assert.equal((await request('/admin/settings',id,{purchasesPaused:true,requireProductApproval:false,announcement:'Spoofed'})).status,403);
  }
  const result=await request('/admin/control',persona('admin').id);
  assert.equal(result.status,200);
  assert.ok(result.data.totals.pendingUsers>=1);
});

let approvalDocumentId:string;
test('pending users submit private documents and cannot trade until an admin approves them', async () => {
  const pending=personas.find(user=>user.id==='user_suspect_2');
  const admin=persona('admin');
  assert.equal((await request('/orders',pending.id,{items:[{productId:products[0].id,quantity:1}]})).status,403);
  assert.equal((await request(`/admin/users/${pending.id}/status`,admin.id,{status:'APPROVED',notes:'Checked the account'})).status,400);
  const uploaded=await fetch(base+'/verification/documents',{method:'POST',headers:{Cookie:cookies.get(pending.id)!,'Content-Type':'image/png','X-Document-Type':'IDENTITY','X-File-Name':'test-identity.png'},body:new Uint8Array(tinyPng)});
  assert.equal(uploaded.status,201);
  const doc=await uploaded.json(); approvalDocumentId=doc.id;
  const filePath=`/verification/documents/${doc.id}/file`;
  assert.equal((await fetch(base+filePath)).status,401);
  assert.equal((await fetch(base+filePath,{headers:{Cookie:cookies.get(persona('buyer').id)!}})).status,403);
  const ownerFile=await fetch(base+filePath,{headers:{Cookie:cookies.get(pending.id)!}});
  assert.equal(ownerFile.status,200);
  assert.deepEqual(Buffer.from(await ownerFile.arrayBuffer()),tinyPng);
  assert.equal((await fetch(base+filePath,{headers:{Cookie:cookies.get(admin.id)!}})).status,200);
  assert.equal((await request(`/admin/documents/${doc.id}/review`,pending.id,{status:'APPROVED',notes:'Self approval'})).status,403);
  assert.equal((await request(`/admin/documents/${doc.id}/review`,admin.id,{status:'APPROVED',notes:'Identity image manually reviewed'})).status,200);
  const approved=await request(`/admin/users/${pending.id}/status`,admin.id,{status:'APPROVED',notes:'Identity document approved by administrator'});
  assert.equal(approved.status,200); assert.equal(approved.data.accountStatus,'APPROVED');
  assert.equal((await request('/verification',pending.id)).data.user.accountStatus,'APPROVED');
  assert.equal((await request(`/admin/documents/${doc.id}/review`,admin.id,{status:'REJECTED',notes:'Trying to decide twice'})).status,400);
});

test('admin can reject documents, suspend users immediately, and cannot disable the admin', async () => {
  const buyer=personas.find(user=>user.id==='user_flagged_99');
  const admin=persona('admin');
  const uploaded=await fetch(base+'/verification/documents',{method:'POST',headers:{Cookie:cookies.get(buyer.id)!,'Content-Type':'image/png','X-Document-Type':'ADDRESS','X-File-Name':'address.png'},body:new Uint8Array(tinyPng)});
  const doc=await uploaded.json();
  assert.equal((await request(`/admin/documents/${doc.id}/review`,admin.id,{status:'REJECTED',notes:'Address is not readable. Submit a clearer copy.'})).status,200);
  const mine=await request('/verification',buyer.id);
  assert.equal(mine.data.documents[0].status,'REJECTED');
  assert.equal((await request(`/admin/users/${admin.id}/status`,admin.id,{status:'SUSPENDED',notes:'Self lockout'})).status,400);
  assert.equal((await request(`/admin/users/${buyer.id}/status`,admin.id,{status:'SUSPENDED',notes:'Account access suspended for manual investigation'})).status,200);
  assert.equal((await request('/orders',buyer.id)).status,401);
  assert.equal((await login(buyer.email,testPassword)).status,403);
});

let moderatedProductId:string;
test('listings require admin approval and hidden products cannot be purchased or self-published', async () => {
  const seller=persona('seller'); const admin=persona('admin');
  const created=await request('/seller/products',seller.id,{name:'Approval workflow listing',price:10000,category:'Electronics',stock:2,variants:[]});
  assert.equal(created.status,201); const product=created.data; moderatedProductId=product.id;
  assert.equal(product.moderationStatus,'PENDING');
  assert.equal((await request(`/products/${product.id}`)).status,404);
  assert.equal((await request(`/seller/products/${product.id}`,seller.id,{updates:{moderationStatus:'PUBLISHED'}},'PUT')).data.moderationStatus,'PENDING');
  assert.equal((await request(`/admin/products/${product.id}/moderate`,admin.id,{status:'PUBLISHED',notes:'Product details and image reviewed'})).status,200);
  assert.equal((await request(`/products/${product.id}`)).status,200);
  assert.equal((await request(`/admin/products/${product.id}/moderate`,admin.id,{status:'HIDDEN',notes:'Listing hidden pending additional seller information'})).status,200);
  assert.equal((await request(`/products/${product.id}`)).status,404);
  assert.equal((await request('/orders',persona('buyer').id,{items:[{productId:product.id,quantity:1}],deliveryAddress:'Test address'})).status,400);
});

test('admin controls purchases, announcements and review visibility with audit records', async () => {
  const admin=persona('admin'); const buyer=persona('buyer');
  assert.equal((await request('/admin/settings',admin.id,{purchasesPaused:true,requireProductApproval:true,announcement:'Scheduled marketplace maintenance'})).status,200);
  assert.equal((await request('/platform')).data.announcement,'Scheduled marketplace maintenance');
  assert.equal((await request('/orders',buyer.id,{items:[{productId:products[0].id,quantity:1}]})).status,403);
  assert.equal((await request('/admin/settings',admin.id,{purchasesPaused:false,requireProductApproval:true,announcement:'Marketplace open'})).status,200);
  const reviews=(await request('/admin/control',admin.id)).data.reviews;
  assert.ok(reviews.length>0);
  const review=reviews[0];
  assert.equal((await request(`/admin/reviews/${review.id}/moderate`,admin.id,{hidden:true,notes:'Review hidden during moderation'})).status,200);
  assert.ok(!(await request(`/products/${review.productId}/reviews`,admin.id)).data.reviews.some((item:any)=>item.id===review.id));
  const logs=(await request('/audit-logs',admin.id)).data;
  assert.ok(logs.some((entry:any)=>entry.action==='ACCOUNT_APPROVED'));
  assert.ok(logs.some((entry:any)=>entry.action==='DOCUMENT_APPROVED'));
});

test('approval decisions, documents, settings and created listings survive a fresh process', () => {
  const script = `import {platformService} from './src/server/services/platformService.ts'; const s=platformService.control();console.log(JSON.stringify({account:s.users.find(u=>u.id==='user_suspect_2').accountStatus,document:s.documents.find(d=>d.id==='${approvalDocumentId}').status,announcement:s.settings.announcement,product:s.products.find(p=>p.id==='${moderatedProductId}').moderationStatus}));`;
  const output=execFileSync(process.execPath,['--import','tsx','--input-type=module','-e',script],{cwd:process.cwd(),env:{...process.env,VERIPAY_ADMIN_DATA_DIR:path.join(uploadTestDirectory,'governance')},encoding:'utf8',windowsHide:true});
  assert.deepEqual(JSON.parse(output.trim()),{account:'APPROVED',document:'APPROVED',announcement:'Marketplace open',product:'HIDDEN'});
});

test('development file serving cannot bypass private document and governance authorization', async () => {
  const dev=spawn(process.execPath,['--import','tsx','server.ts'],{cwd:process.cwd(),env:{...process.env,PORT:'19372',NODE_ENV:'development',AI_PROVIDER:'rules',VERIPAY_DEMO_PASSWORD:testPassword,VERIPAY_ADMIN_DATA_DIR:path.join(uploadTestDirectory,'governance')},stdio:['ignore','pipe','pipe'],windowsHide:true});
  try {
    await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Dev server did not start')),30000);let output='';dev.stdout!.on('data',chunk=>{output+=chunk;if(output.includes('Server running on port')){clearTimeout(timer);resolve();}});dev.once('error',error=>{clearTimeout(timer);reject(error);});dev.once('exit',code=>{clearTimeout(timer);reject(new Error('Dev server exited '+code));});});
    const statePath=path.join(uploadTestDirectory,'governance','state.json');
    const relative='/'+path.relative(process.cwd(),statePath).replaceAll('\\','/');
    const normal=await fetch('http://127.0.0.1:19372'+relative);
    assert.equal(normal.status,403);
    const absolute=await fetch('http://127.0.0.1:19372/@fs/'+statePath.replaceAll('\\','/'));
    assert.equal(absolute.status,403);
    assert.equal((await fetch(`http://127.0.0.1:19372/api/verification/documents/${approvalDocumentId}/file`)).status,401);
  } finally {
    if(dev.exitCode===null) await new Promise<void>(resolve=>{dev.once('exit',()=>resolve());dev.kill();});
  }
});

test('admin user profiles group only records belonging to the selected buyer or seller', async () => {
  const admin=persona('admin');
  const control=(await request('/admin/control',admin.id)).data;
  const allOrders=(await request('/orders',admin.id)).data;
  const allDisputes=(await request('/disputes',admin.id)).data;
  for (const user of personas) {
    const result=await request(`/admin/users/${user.id}/profile`,admin.id);
    assert.equal(result.status,200);
    const profile=result.data;
    assert.equal(profile.user.id,user.id);
    assert.deepEqual(profile.documents.map((item:any)=>item.id).sort(),control.documents.filter((item:any)=>item.userId===user.id).map((item:any)=>item.id).sort());
    assert.deepEqual(profile.products.map((item:any)=>item.id).sort(),control.products.filter((item:any)=>item.sellerId===user.id).map((item:any)=>item.id).sort());
    assert.deepEqual(profile.reviewsWritten.map((item:any)=>item.id).sort(),control.reviews.filter((item:any)=>item.buyerId===user.id).map((item:any)=>item.id).sort());
    const ownProductIds=new Set(profile.products.map((item:any)=>item.id));
    assert.deepEqual(profile.reviewsReceived.map((item:any)=>item.id).sort(),control.reviews.filter((item:any)=>ownProductIds.has(item.productId)).map((item:any)=>item.id).sort());
    const ownOrders=allOrders.filter((item:any)=>item.buyerId===user.id||item.sellerId===user.id);
    assert.deepEqual(profile.orders.map((item:any)=>item.id).sort(),ownOrders.map((item:any)=>item.id).sort());
    const ownOrderIds=new Set(ownOrders.map((item:any)=>item.id));
    assert.deepEqual(profile.disputes.map((item:any)=>item.id).sort(),allDisputes.filter((item:any)=>ownOrderIds.has(item.orderId)).map((item:any)=>item.id).sort());
  }
  const sellerProfile=(await request(`/admin/users/${products[1].sellerId}/profile`,admin.id)).data;
  assert.ok(sellerProfile.reviewsReceived.some((item:any)=>item.productId===products[1].id));
  assert.ok(sellerProfile.reviewsReceived.some((item:any)=>item.hidden));
  const buyerProfile=(await request(`/admin/users/${persona('buyer').id}/profile`,admin.id)).data;
  assert.ok(buyerProfile.reviewsWritten.length>0);
  assert.equal(buyerProfile.products.length,0);
  assert.equal(buyerProfile.reviewsReceived.length,0);
  const pendingProfile=(await request('/admin/users/user_suspect_2/profile',admin.id)).data;
  assert.ok(pendingProfile.documents.some((item:any)=>item.id===approvalDocumentId));
  assert.ok(pendingProfile.activity.some((item:any)=>item.action==='ACCOUNT_APPROVED'));
  assert.equal((await request('/admin/users/no-such-user/profile',admin.id)).status,404);
});

test('user profile and document previews remain protected and support in-page viewing', async () => {
  const path='/admin/users/user_suspect_2/profile';
  assert.equal((await request(path)).status,401);
  for(const role of ['buyer','seller']) assert.equal((await request(path,persona(role).id)).status,403);
  const url=base+`/verification/documents/${approvalDocumentId}/file?preview=1`;
  assert.equal((await fetch(url)).status,401);
  assert.equal((await fetch(url,{headers:{Cookie:cookies.get(persona('buyer').id)!}})).status,403);
  for (const id of ['user_suspect_2',persona('admin').id]) {
    const response=await fetch(url,{headers:{Cookie:cookies.get(id)!}});
    assert.equal(response.status,200);
    assert.match(response.headers.get('content-type')!,/image\/png/);
    assert.equal(response.headers.get('content-disposition'),'inline');
    assert.equal(response.headers.get('cache-control'),'no-store');
    assert.match(response.headers.get('content-security-policy')!,/sandbox/);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()),tinyPng);
  }
  const pdf=Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF');
  const upload=await fetch(base+'/verification/documents',{method:'POST',headers:{Cookie:cookies.get('user_suspect_2')!,'Content-Type':'application/pdf','X-Document-Type':'BUSINESS','X-File-Name':'test-business-certificate.pdf'},body:new Uint8Array(pdf)});
  assert.equal(upload.status,201);
  const doc=await upload.json();
  const preview=await fetch(base+`/verification/documents/${doc.id}/file?preview=1`,{headers:{Cookie:cookies.get(persona('admin').id)!}});
  assert.equal(preview.status,200);
  assert.match(preview.headers.get('content-type')!,/application\/pdf/);
  assert.deepEqual(Buffer.from(await preview.arrayBuffer()),pdf);
  const profile=(await request(path,persona('admin').id)).data;
  assert.ok(profile.documents.some((item:any)=>item.id===doc.id&&item.kind==='BUSINESS'));
});

const registeredAccounts:{id:string;email:string;password:string;role:string}[]=[];
test('buyer and seller registration creates pending, unverified accounts linked to the admin workflow',async()=>{
  for(const role of ['buyer','seller']) {
    const email=`new-${role}@example.com`;const password='UniqueRegistration456!';
    const response=await fetch(base+'/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:role==='seller'?'New Seller Shop':'New Buyer',email,phone:'0803 999 4455',password,role,accountStatus:'APPROVED',identityVerified:true,identityMethods:['NIN'],id:'spoofed'})});
    assert.equal(response.status,201);
    const {user}=await response.json();
    assert.equal(user.role,role);assert.equal(user.accountStatus,'PENDING');assert.equal(user.identityVerified,false);assert.deepEqual(user.identityMethods,[]);assert.notEqual(user.id,'spoofed');
    assert.equal(user.phone,'+2348039994455');
    assert.ok(!('password' in user));assert.ok(!('hash' in user));
    const cookie=response.headers.get('set-cookie')!.split(';')[0];
    assert.match(response.headers.get('set-cookie')!,/HttpOnly/);
    const headers={Cookie:cookie};
    assert.equal((await (await fetch(base+'/auth/me',{headers})).json()).user.id,user.id);
    assert.equal((await fetch(base+'/admin/control',{headers})).status,403);
    const tradingRoute=role==='buyer'?'/orders':'/seller/products';
    assert.equal((await fetch(base+tradingRoute,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:'{}'})).status,403);
    const file=await fetch(base+'/verification/documents',{method:'POST',headers:{...headers,'Content-Type':'image/png','X-Document-Type':'IDENTITY','X-File-Name':'new-account-document.png'},body:new Uint8Array(tinyPng)});
    assert.equal(file.status,201);
    const profile=await request(`/admin/users/${user.id}/profile`,persona('admin').id);
    assert.equal(profile.status,200);assert.equal(profile.data.documents.length,1);
    assert.equal(profile.data.user.role,role);
    const signedIn=await login(email.toUpperCase(),password);assert.equal(signedIn.status,200);
    assert.equal((await login(email,'VeriPayTest123!')).status,401);
    registeredAccounts.push({id:user.id,email,password,role});
  }
  const accounts=(await request('/users',persona('admin').id)).data;
  assert.ok(registeredAccounts.every(account=>accounts.some((user:any)=>user.id===account.id)));
});

test('registration validates fields, rejects duplicates, and cannot create admin accounts',async()=>{
  const valid={name:'Example Buyer',email:'invalid-check@example.com',phone:'08031234567',password:'ValidPassword123!',role:'buyer'};
  const invalid=[{...valid,role:'admin'},{...valid,name:'a'},{...valid,email:'invalid-email'},{...valid,phone:'123'},{...valid,password:'short'},{...valid,email:registeredAccounts[0].email.toUpperCase()}];
  for(const input of invalid) {
    const response=await fetch(base+'/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
    assert.equal(response.status,400);assert.ok((await response.json()).error);
  }
});

test('registered accounts and their own password hashes persist across a fresh process',()=>{
  const script=`import {registrationService} from './src/server/services/registrationService.ts';import {users} from './src/server/db/store.ts';import {scryptSync,timingSafeEqual} from 'node:crypto';const ids=${JSON.stringify(registeredAccounts.map(account=>account.id))};console.log(JSON.stringify(ids.map(id=>{const user=users.find(u=>u.id===id);const credential=registrationService.credential(id);return {role:user.role,status:user.accountStatus,valid:timingSafeEqual(scryptSync('UniqueRegistration456!',credential.salt,64),credential.hash)};})));`;
  const output=execFileSync(process.execPath,['--import','tsx','--input-type=module','-e',script],{cwd:process.cwd(),env:{...process.env,VERIPAY_ADMIN_DATA_DIR:path.join(uploadTestDirectory,'governance')},encoding:'utf8',windowsHide:true});
  assert.deepEqual(JSON.parse(output.trim()),[{role:'buyer',status:'PENDING',valid:true},{role:'seller',status:'PENDING',valid:true}]);
});
