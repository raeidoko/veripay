const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = Number(process.env.API_PORT || 8787);
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'veripay-db.json');
const AUTH_SECRET = process.env.AUTH_SECRET || 'veripay-local-dev-secret';

const sellers = [
  { id: 's-1', name: 'Amara Couture', handle: '@amara_couture', phone: '+234 803 111 2222', category: 'Fashion & Apparel', trustScore: 98, successfulSales: 142, activeEscrows: 3, disputeCount: 0, responseTime: '5 mins', rating: 4.9 },
  { id: 's-2', name: 'Gadget Hub Lagos', handle: '@gadgethub_lagos', phone: '+234 812 345 6789', category: 'Electronics & Gadgets', trustScore: 94, successfulSales: 310, activeEscrows: 5, disputeCount: 2, responseTime: '12 mins', rating: 4.6 },
  { id: 's-3', name: 'Thrift Wonders', handle: '@thrift_wonders_ng', phone: '+234 905 555 4433', category: 'Lifestyle & Thrift', trustScore: 87, successfulSales: 64, activeEscrows: 1, disputeCount: 3, responseTime: '25 mins', rating: 4.2 },
  { id: 's-4', name: 'Prestige Kicks', handle: '@prestige_kicks', phone: '+234 708 999 8877', category: 'Footwear & Luxury', trustScore: 99, successfulSales: 215, activeEscrows: 2, disputeCount: 1, responseTime: '3 mins', rating: 4.9 },
];

const users = [
  {
    id: 'user-buyer-1',
    name: 'Femi Adebayo',
    phone: '+234 802 888 7766',
    role: 'BUYER',
    password: '1234',
  },
  {
    id: 'user-seller-1',
    name: 'Amara Couture',
    phone: '+234 803 111 2222',
    role: 'SELLER',
    password: '1234',
  },
  {
    id: 'user-admin-1',
    name: 'VeriPay Operations',
    phone: '+234 800 000 0000',
    role: 'ARBITRATOR',
    password: '1234',
  },
];

const initialState = {
  notifications: [
    {
      id: 'n-initial-1',
      transactionId: 'VP-10924',
      title: 'Payout Disbursed Successfully',
      message: 'OPay released NGN 45,000 securely to Prestige Kicks wallet for high-top sneakers.',
      type: 'success',
      timestamp: 'July 1, 2:45 PM',
      read: true,
    },
    {
      id: 'n-initial-2',
      transactionId: 'VP-11048',
      title: 'Dispute Under Arbitration Review',
      message: 'The unboxing video submitted by Femi Adebayo for iPad Air is currently being audited.',
      type: 'warning',
      timestamp: 'July 2, 10:00 AM',
      read: false,
    },
  ],
  transactions: [
    {
      id: 'VP-10924',
      productName: 'Ovation High-Top Sneakers (White/Coral)',
      category: 'Footwear & Luxury',
      amount: 45000,
      sellerId: 's-4',
      sellerName: 'Prestige Kicks',
      sellerHandle: '@prestige_kicks',
      sellerPhone: '+234 708 999 8877',
      buyerName: 'Femi Adebayo',
      buyerPhone: '+234 802 888 7766',
      deliveryPartner: 'GIG Logistics',
      trackingNumber: 'GIG-7492-930',
      deliveryTimelineDays: 3,
      terms: 'Must be size 43, original box, and tags intact. Deliver to Lekki Phase 1.',
      status: 'COMPLETED',
      createdAt: '2026-06-29T10:30:00Z',
      timeline: [
        { id: 't1-1', status: 'DRAFT', title: 'Agreement Created', description: 'Femi Adebayo created an escrow agreement with Prestige Kicks.', timestamp: '2026-06-29T10:30:00Z', actor: 'BUYER' },
        { id: 't1-2', status: 'PAYMENT_SECURED', title: 'Payment Deposited into Escrow', description: 'OPay secured NGN 45,000 in VeriPay Escrow. Seller notified.', timestamp: '2026-06-29T11:15:00Z', actor: 'SYSTEM' },
        { id: 't1-3', status: 'DISPATCHED', title: 'Shipped via GIG Logistics', description: 'Seller dispatched package. Tracking #GIG-7492-930 created.', timestamp: '2026-06-30T09:00:00Z', actor: 'SELLER' },
        { id: 't1-4', status: 'DELIVERED', title: 'Package Delivered', description: 'GIG Logistics courier delivered package. Buyer confirmed receipt.', timestamp: '2026-07-01T14:20:00Z', actor: 'LOGISTICS' },
        { id: 't1-5', status: 'COMPLETED', title: 'Funds Released to Seller', description: 'Buyer confirmed successful delivery. NGN 45,000 released to Prestige Kicks wallet.', timestamp: '2026-07-01T14:45:00Z', actor: 'BUYER' },
      ],
    },
    {
      id: 'VP-11048',
      productName: 'Refurbished iPad Air 2022 (64GB, Space Gray)',
      category: 'Electronics & Gadgets',
      amount: 280000,
      sellerId: 's-2',
      sellerName: 'Gadget Hub Lagos',
      sellerHandle: '@gadgethub_lagos',
      sellerPhone: '+234 812 345 6789',
      buyerName: 'Femi Adebayo',
      buyerPhone: '+234 802 888 7766',
      deliveryPartner: 'DHL Express',
      trackingNumber: 'DHL-8392-104',
      deliveryTimelineDays: 2,
      terms: 'No scratches on screen, battery health > 85%, charger included. 48hr testing window.',
      status: 'DISPUTED',
      createdAt: '2026-06-30T14:15:00Z',
      dispute: {
        id: 'disp-11048',
        openedBy: 'BUYER',
        reason: 'Wrong Product / Damaged Item',
        description: 'The iPad arrived with a deep vertical scratch across the screen. The seller claimed it was pristine. I refuse to accept this unless we do a partial refund or full return.',
        buyerEvidence: [
          { id: 'ev-1', type: 'image', name: 'scratch_screen.jpg', url: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=500&auto=format&fit=crop' },
          { id: 'ev-2', type: 'image', name: 'unboxing_photo.jpg', url: 'https://images.unsplash.com/photo-1589739900243-4b52cd9b104e?w=500&auto=format&fit=crop' },
        ],
        sellerEvidence: [
          { id: 'ev-3', type: 'image', name: 'shipping_package_ready.jpg', url: 'https://images.unsplash.com/photo-1612115539055-fa8ef2c44247?w=500&auto=format&fit=crop' },
        ],
        buyerMessage: 'I would like a return or NGN 40,000 partial refund to replace the screen glass.',
        sellerMessage: 'The device was perfectly clean when packed. It must have been damaged in transit or the buyer caused it after opening.',
        arbitrationStatus: 'UNDER_REVIEW',
        verdictDescription: 'OPay Arbitration Team is reviewing the DHL logistics insurance and the unboxing photo provided by the buyer.',
        createdAt: '2026-07-02T10:00:00Z',
      },
      timeline: [
        { id: 't2-1', status: 'DRAFT', title: 'Agreement Created', description: 'Femi Adebayo created an escrow agreement with Gadget Hub Lagos.', timestamp: '2026-06-30T14:15:00Z', actor: 'BUYER' },
        { id: 't2-2', status: 'PAYMENT_SECURED', title: 'Payment Secured in Escrow', description: 'OPay secured NGN 280,000 in VeriPay Escrow. Seller preparing shipment.', timestamp: '2026-06-30T15:00:00Z', actor: 'SYSTEM' },
        { id: 't2-3', status: 'DISPATCHED', title: 'Shipped via DHL Express', description: 'Seller dispatched iPad. Tracking #DHL-8392-104.', timestamp: '2026-07-01T10:30:00Z', actor: 'SELLER' },
        { id: 't2-4', status: 'DELIVERED', title: 'Delivered to Buyer', description: 'DHL Courier confirmed delivery. Femi Adebayo received package.', timestamp: '2026-07-02T09:15:00Z', actor: 'LOGISTICS' },
        { id: 't2-5', status: 'DISPUTED', title: 'Dispute Filed by Buyer', description: 'Femi Adebayo filed a dispute: Deep vertical scratch on screen.', timestamp: '2026-07-02T10:00:00Z', actor: 'BUYER' },
      ],
    },
    {
      id: 'VP-11239',
      productName: 'Custom Ankara Ballgown & Headtie',
      category: 'Fashion & Apparel',
      amount: 65000,
      sellerId: 's-1',
      sellerName: 'Amara Couture',
      sellerHandle: '@amara_couture',
      sellerPhone: '+234 803 111 2222',
      buyerName: 'Femi Adebayo',
      buyerPhone: '+234 802 888 7766',
      deliveryPartner: 'Fez Delivery',
      trackingNumber: 'FEZ-4820-192',
      deliveryTimelineDays: 4,
      terms: 'Custom measurements provided. Matching purple headtie must be included. Ship by Thursday.',
      status: 'IN_TRANSIT',
      createdAt: '2026-07-01T08:00:00Z',
      timeline: [
        { id: 't3-1', status: 'DRAFT', title: 'Agreement Created', description: 'Femi Adebayo created an escrow agreement with Amara Couture.', timestamp: '2026-07-01T08:00:00Z', actor: 'BUYER' },
        { id: 't3-2', status: 'PAYMENT_SECURED', title: 'Payment Secured', description: 'OPay secured NGN 65,000 in VeriPay Escrow. Amara Couture initiated fitting/tailoring check.', timestamp: '2026-07-01T09:12:00Z', actor: 'SYSTEM' },
        { id: 't3-3', status: 'DISPATCHED', title: 'Dispatched via Fez Delivery', description: 'Amara Couture shipped gown. Transit package is active.', timestamp: '2026-07-02T16:40:00Z', actor: 'SELLER' },
      ],
    },
    {
      id: 'VP-11352',
      productName: 'Premium Vintage Retro Oversized Shirts (Bundle of 3)',
      category: 'Lifestyle & Thrift',
      amount: 18500,
      sellerId: 's-3',
      sellerName: 'Thrift Wonders',
      sellerHandle: '@thrift_wonders_ng',
      sellerPhone: '+234 905 555 4433',
      buyerName: 'Femi Adebayo',
      buyerPhone: '+234 802 888 7766',
      deliveryPartner: 'Gokada Express',
      trackingNumber: '',
      deliveryTimelineDays: 1,
      terms: 'One silk floral pattern, two solid linen (white & olive green). Size L.',
      status: 'PENDING_PAYMENT',
      createdAt: '2026-07-03T09:00:00Z',
      timeline: [
        { id: 't4-1', status: 'DRAFT', title: 'Agreement Initialized', description: 'Escrow agreement initialized by buyer. Awaiting payment to secure funds.', timestamp: '2026-07-03T09:00:00Z', actor: 'BUYER' },
      ],
    },
  ],
};

async function readState() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    const state = JSON.parse(raw);
    return {
      notifications: Array.isArray(state.notifications) ? state.notifications : initialState.notifications,
      transactions: Array.isArray(state.transactions) ? state.transactions : initialState.transactions,
      updatedAt: state.updatedAt,
      revision: state.revision,
    };
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await writeState(initialState);
    return initialState;
  }
}

async function writeState(state) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, `${JSON.stringify({
    notifications: state.notifications,
    transactions: state.transactions,
    revision: state.revision,
    updatedAt: new Date().toISOString(),
  }, null, 2)}\n`);
}

function makeId(prefix) {
  if (prefix === 'VP') return `VP-${Math.floor(10000 + Math.random() * 90000)}`;
  return `${prefix}-${crypto.randomUUID()}`;
}

function nowIso() {
  return new Date().toISOString();
}

function timestampLabel() {
  const now = new Date();
  return `${now.toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })}, ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
}

function createNotification(transactionId, title, message, type) {
  return {
    id: makeId('n'),
    transactionId,
    title,
    message,
    type,
    timestamp: timestampLabel(),
    read: false,
  };
}

function createTimelineEvent(status, title, description, actor) {
  return {
    id: makeId('ev'),
    status,
    title,
    description,
    timestamp: nowIso(),
    actor,
  };
}

function createTransaction(txData) {
  const seller = sellers.find((item) => item.id === txData.sellerId) || sellers[0];
  const transaction = {
    id: makeId('VP'),
    productName: txData.productName || 'Custom Product',
    category: txData.category || seller.category || 'General',
    amount: Number(txData.amount || 0),
    sellerId: seller.id,
    sellerName: txData.sellerName || seller.name,
    sellerHandle: txData.sellerHandle || seller.handle,
    sellerPhone: txData.sellerPhone || seller.phone,
    buyerName: txData.buyerName || 'Femi Adebayo',
    buyerPhone: txData.buyerPhone || '',
    deliveryPartner: txData.deliveryPartner || 'GIG Logistics',
    trackingNumber: '',
    deliveryTimelineDays: Number(txData.deliveryTimelineDays || 3),
    terms: txData.terms || 'Inspect on arrival.',
    status: 'PENDING_PAYMENT',
    createdAt: nowIso(),
    timeline: [
      createTimelineEvent('DRAFT', 'Escrow Agreement Drafted', `Agreement drafted by buyer with terms: ${txData.terms || 'Inspect on arrival.'}`, 'BUYER'),
    ],
  };

  return transaction;
}

async function saveAndSendState(res, state, statusCode = 200) {
  await writeState({ ...state, revision: crypto.randomUUID() });
  sendJson(res, statusCode, await readState());
}

function updateTransaction(state, id, updater) {
  let updatedTransaction = null;
  const transactions = state.transactions.map((transaction) => {
    if (transaction.id !== id) return transaction;
    updatedTransaction = updater(transaction);
    return updatedTransaction;
  });

  return { ...state, transactions, updatedTransaction };
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function publicUser(user) {
  const { password, ...safeUser } = user;
  return safeUser;
}

function base64Url(input) {
  return Buffer.from(JSON.stringify(input)).toString('base64url');
}

function sign(value) {
  return crypto.createHmac('sha256', AUTH_SECRET).update(value).digest('base64url');
}

function createToken(user) {
  const payload = base64Url({
    sub: user.id,
    role: user.role,
    exp: Date.now() + 1000 * 60 * 60 * 12,
  });
  return `${payload}.${sign(payload)}`;
}

function verifyToken(token) {
  if (!token || !token.includes('.')) return null;
  const [payload, signature] = token.split('.');
  if (sign(payload) !== signature) return null;

  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!claims.exp || claims.exp < Date.now()) return null;
    return users.find((user) => user.id === claims.sub) || null;
  } catch {
    return null;
  }
}

function getAuthUser(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  return verifyToken(token);
}

function requireAuth(req, res) {
  const user = getAuthUser(req);
  if (!user) {
    sendJson(res, 401, { error: 'Authentication required.' });
    return null;
  }
  return user;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const { pathname } = url;

    if (pathname === '/api/health') {
      sendJson(res, 200, { ok: true, service: 'veripay-api' });
      return;
    }

    if (pathname === '/api/auth/login' && req.method === 'POST') {
      const body = await readBody(req);
      const normalizedPhone = String(body.phone || '').replace(/\s+/g, ' ').trim();
      const user = users.find((item) => item.phone === normalizedPhone && item.password === String(body.password || ''));
      if (!user) {
        sendJson(res, 401, { error: 'Invalid phone number or PIN.' });
        return;
      }

      sendJson(res, 200, {
        token: createToken(user),
        user: publicUser(user),
      });
      return;
    }

    if (pathname === '/api/auth/me' && req.method === 'GET') {
      const user = requireAuth(req, res);
      if (!user) return;
      sendJson(res, 200, { user: publicUser(user) });
      return;
    }

    const authUser = requireAuth(req, res);
    if (!authUser) return;

    if (pathname === '/api/sellers' && req.method === 'GET') {
      sendJson(res, 200, { sellers });
      return;
    }

    if (pathname === '/api/transactions' && req.method === 'GET') {
      const state = await readState();
      sendJson(res, 200, { transactions: state.transactions });
      return;
    }

    if (pathname === '/api/transactions' && req.method === 'POST') {
      const state = await readState();
      const txData = await readBody(req);

      if (!txData.productName || Number(txData.amount || 0) <= 0 || !txData.terms) {
        sendJson(res, 400, { error: 'productName, positive amount, and terms are required.' });
        return;
      }

      const transaction = createTransaction(txData);
      const notification = createNotification(
        transaction.id,
        'Escrow Order Created',
        `Agreement established with ${transaction.sellerName}. Awaiting payment to hold funds.`,
        'info',
      );

      await saveAndSendState(res, {
        ...state,
        transactions: [transaction, ...state.transactions],
        notifications: [notification, ...state.notifications],
      }, 201);
      return;
    }

    if (pathname === '/api/transactions/qr' && req.method === 'POST') {
      const state = await readState();
      const body = await readBody(req);
      const seller = sellers.find((item) => item.id === body.sellerId);
      if (!seller) {
        sendJson(res, 404, { error: 'Seller not found.' });
        return;
      }

      const randomProduct = seller.id === 's-1' ? 'Luxury Fitting Ankara' : seller.id === 's-2' ? 'Beats Solo3 Wireless' : 'Vintage Band Bundle';
      const randomAmount = seller.id === 's-1' ? 45000 : seller.id === 's-2' ? 120000 : 15000;
      const transaction = createTransaction({
        productName: randomProduct,
        category: seller.category,
        amount: randomAmount,
        sellerId: seller.id,
        sellerName: seller.name,
        sellerHandle: seller.handle,
        sellerPhone: seller.phone,
        buyerName: 'Femi Adebayo',
        buyerPhone: '+234 802 888 7766',
        deliveryPartner: 'GIG Logistics',
        deliveryTimelineDays: 3,
        terms: `Prefilled scan transaction for ${randomProduct}. Secured via VeriPay.`,
      });
      transaction.timeline = [
        createTimelineEvent('PENDING_PAYMENT', 'QR Code Payment Scan', 'Femi Adebayo scanned merchant QR code to establish this order.', 'BUYER'),
      ];

      const notification = createNotification(
        transaction.id,
        'Escrow Established via QR Scan',
        `Order of NGN ${randomAmount.toLocaleString('en-NG')} initialized. Complete wallet authorization to fund.`,
        'info',
      );

      await saveAndSendState(res, {
        ...state,
        transactions: [transaction, ...state.transactions],
        notifications: [notification, ...state.notifications],
      }, 201);
      return;
    }

    const transactionAction = pathname.match(/^\/api\/transactions\/([^/]+)\/([^/]+)$/);
    if (transactionAction && req.method === 'POST') {
      const [, transactionId, action] = transactionAction;
      const state = await readState();
      const body = await readBody(req);
      const transaction = state.transactions.find((item) => item.id === transactionId);

      if (!transaction) {
        sendJson(res, 404, { error: 'Transaction not found.' });
        return;
      }

      if (action === 'pay') {
        const next = updateTransaction(state, transactionId, (item) => ({
          ...item,
          status: 'PAYMENT_SECURED',
          timeline: [
            ...item.timeline,
            createTimelineEvent('PAYMENT_SECURED', 'Funds Secured in Escrow', 'OPay successfully secured funds in VeriPay holding vault. Merchant notified.', 'SYSTEM'),
          ],
        }));
        await saveAndSendState(res, {
          ...next,
          notifications: [
            createNotification(transactionId, 'Payment Deposited into Escrow', 'OPay secured full payment in escrow vault. Merchant can now ship safely.', 'success'),
            ...state.notifications,
          ],
        });
        return;
      }

      if (action === 'confirm-delivery') {
        const next = updateTransaction(state, transactionId, (item) => ({
          ...item,
          status: 'COMPLETED',
          timeline: [
            ...item.timeline,
            createTimelineEvent('COMPLETED', 'Verification Complete - Funds Released', 'Buyer confirmed item matching terms. Escrow closed. Funds transferred to seller wallet.', 'BUYER'),
          ],
        }));
        await saveAndSendState(res, {
          ...next,
          notifications: [
            createNotification(transactionId, 'Transaction Complete!', `NGN ${transaction.amount.toLocaleString('en-NG')} was successfully credited to ${transaction.sellerName}.`, 'success'),
            ...state.notifications,
          ],
        });
        return;
      }

      if (action === 'dispute') {
        if (!body.reason || !body.description) {
          sendJson(res, 400, { error: 'reason and description are required.' });
          return;
        }

        const next = updateTransaction(state, transactionId, (item) => ({
          ...item,
          status: 'DISPUTED',
          dispute: {
            id: `disp-${transactionId}`,
            openedBy: 'BUYER',
            reason: body.reason,
            description: body.description,
            buyerEvidence: [
              { id: makeId('ev-buyer'), type: 'image', name: 'unboxing_damaged_report.jpg', url: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=500&auto=format&fit=crop' },
            ],
            sellerEvidence: [],
            arbitrationStatus: 'UNDER_REVIEW',
            createdAt: nowIso(),
          },
          timeline: [
            ...item.timeline,
            createTimelineEvent('DISPUTED', 'Formal Escrow Dispute Filed', `Dispute opened by buyer. Reason: ${body.reason}. Case moved to OPay Arbitration.`, 'BUYER'),
          ],
        }));
        await saveAndSendState(res, {
          ...next,
          notifications: [
            createNotification(transactionId, 'Arbitration Claim Filed', 'OPay Dispute Mediator has been notified. Disputed funds are locked in holding.', 'error'),
            ...state.notifications,
          ],
        });
        return;
      }

      if (action === 'resolve-dispute') {
        if (!['BUYER_REFUNDED', 'SELLER_PAID'].includes(body.verdict)) {
          sendJson(res, 400, { error: 'verdict must be BUYER_REFUNDED or SELLER_PAID.' });
          return;
        }

        const finalStatus = body.verdict === 'BUYER_REFUNDED' ? 'REFUNDED' : 'COMPLETED';
        const next = updateTransaction(state, transactionId, (item) => ({
          ...item,
          status: finalStatus,
          dispute: item.dispute ? {
            ...item.dispute,
            arbitrationStatus: body.verdict,
            verdictDescription: body.verdict === 'BUYER_REFUNDED'
              ? 'Based on continuous unboxing video evidence and incomplete seller-side check-off records, the case was resolved in favor of the buyer. Full refund issued.'
              : 'Logistics partner confirmed package checks and parcel weight matched packing. Merchant paid out.',
          } : item.dispute,
          timeline: [
            ...item.timeline,
            createTimelineEvent(
              finalStatus,
              body.verdict === 'BUYER_REFUNDED' ? 'Arbitrator Ruled - Buyer Refunded' : 'Arbitrator Ruled - Seller Paid',
              body.verdict === 'BUYER_REFUNDED'
                ? 'OPay Arbitration Team closed file. Full escrow deposit value refunded back to buyer OPay wallet.'
                : 'OPay Arbitration Team audited parcel logs. Funds safely disbursed to Merchant wallet balance.',
              'SYSTEM',
            ),
          ],
        }));

        await saveAndSendState(res, {
          ...next,
          notifications: [
            createNotification(
              transactionId,
              body.verdict === 'BUYER_REFUNDED' ? 'Arbitrator Verdict - Refunded' : 'Arbitrator Verdict - Paid Out',
              body.verdict === 'BUYER_REFUNDED'
                ? 'Claim resolved. Full refund of order value processed to buyer OPay wallet.'
                : 'Claim resolved. Hold removed. Order value released to merchant wallet.',
              'success',
            ),
            ...state.notifications,
          ],
        });
        return;
      }

      sendJson(res, 404, { error: 'Unknown transaction action.' });
      return;
    }

    const markRead = pathname.match(/^\/api\/notifications\/([^/]+)\/read$/);
    if (markRead && req.method === 'POST') {
      const state = await readState();
      await saveAndSendState(res, {
        ...state,
        notifications: state.notifications.map((item) => item.id === markRead[1] ? { ...item, read: true } : item),
      });
      return;
    }

    if (pathname === '/api/notifications' && req.method === 'DELETE') {
      const state = await readState();
      await saveAndSendState(res, { ...state, notifications: [] });
      return;
    }

    if (pathname === '/api/state' && req.method === 'GET') {
      sendJson(res, 200, await readState());
      return;
    }

    if (pathname === '/api/state' && req.method === 'PUT') {
      const nextState = await readBody(req);
      if (!Array.isArray(nextState.transactions) || !Array.isArray(nextState.notifications)) {
        sendJson(res, 400, { error: 'State must include transactions and notifications arrays.' });
        return;
      }

      await writeState({
        transactions: nextState.transactions,
        notifications: nextState.notifications,
        revision: crypto.randomUUID(),
      });
      sendJson(res, 200, await readState());
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: 'Internal server error' });
  }
});

server.listen(PORT, () => {
  console.log(`VeriPay API listening on http://localhost:${PORT}`);
});
