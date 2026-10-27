import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAiLayer, keywordSearch, type AIProvider } from '../src/server/services/aiLayer.ts';
import type { Dispute, Product, Order, DeliveryVerification } from '../src/shared/types.ts';
const catalog = [
  { id: 'shoe', name: 'Red shoes', description: 'Leather footwear', category: 'Fashion' },
  { id: 'bag', name: 'Leather bag', description: 'Travel bag', category: 'Fashion' },
] as Product[];
const dispute = { reason: 'NON_DELIVERY', details: 'Not received', claimedAmount: 100 } as Dispute;
const verification = (outcome: DeliveryVerification['outcome']) => ({ outcome } as DeliveryVerification);
const provider = (value: unknown): AIProvider => ({ modelVersion: 'test-model', generate: async () => JSON.stringify(value) });
const analyze = (layer = createAiLayer(), reason = dispute.reason, checks: DeliveryVerification[] = []) => layer.analyzeDisputeCase({ ...dispute, reason }, undefined, checks, []);

test('rules rank individual query words and return no invented matches', async () => {
  assert.deepEqual(keywordSearch('leather shoes', catalog).map(p => p.id), ['shoe', 'bag']);
  const result = await createAiLayer().searchAndAdvise('spaceship', catalog);
  assert.equal(result.source, 'keyword');
  assert.deepEqual(result.recommendedProductIds, []);
  assert.deepEqual(keywordSearch('', catalog), catalog);
});
test('missing or contradictory evidence requires review; delivery cannot resolve quality', async () => {
  assert.equal((await analyze()).recommendedOutcome, 'NEEDS_REVIEW');
  assert.equal((await analyze(undefined, 'NON_DELIVERY', [verification('NOT_DELIVERED')])).recommendedOutcome, 'BUYER_REFUNDED');
  assert.equal((await analyze(undefined, 'NON_DELIVERY', [verification('NOT_DELIVERED'), verification('CONFIRMED_DELIVERED')])).recommendedOutcome, 'NEEDS_REVIEW');
  const result = await analyze(undefined, 'ITEM_NOT_AS_DESCRIBED', [verification('CONFIRMED_DELIVERED')]);
  assert.equal(result.recommendedOutcome, 'NEEDS_REVIEW');
  assert.equal(result.infoRequests?.length, 2);
  assert.equal(result.source, 'rules');
  assert.doesNotMatch(JSON.stringify(result), /PIN|geo-stamp|matches delivered/);
});
test('confirmation preserves all order facts without a model', async () => {
  const order = { items: [{ quantity: 2, productName: 'Shoes', unitPrice: 5000 }], currency: 'NGN', totalAmount: 10200, sellerName: 'Example Seller', deliveryAddress: 'Lagos', deliveryTerms: 'Three days after dispatch' } as Order;
  const result = await createAiLayer().generateConfirmationPrompt(order);
  assert.equal(result.headline, 'Is this what you really want to purchase?');
  assert.match(result.summaryText, /2 x Shoes.*NGN 5,000.00.*Example Seller.*NGN 10,200.00/);
  assert.ok(result.keyCheckpoints.includes('Agreed delivery terms: Three days after dispatch'));
});
test('search filters fabricated IDs and duplicates; malformed output falls back', async () => {
  const layer = createAiLayer(provider({ answer: 'Try these.', recommendedProductIds: ['shoe', 'fake', 'shoe'] }));
  assert.deepEqual((await layer.searchAndAdvise('shoes', catalog)).recommendedProductIds, ['shoe']);
  const bad = await createAiLayer(provider({ answer: {}, recommendedProductIds: 'shoe' })).searchAndAdvise('spaceship', catalog);
  assert.equal(bad.source, 'keyword');
});
test('dispute validation caps fields, clamps confidence and records actual provenance', async () => {
  const value = { findings: ['Observed'], inconsistencies: [], rationale: 'x'.repeat(1500), recommendedOutcome: 'NEEDS_REVIEW', confidence: 3, infoRequests: [{ requestedFrom: 'BUYER', question: 'q'.repeat(400) }] };
  const result = await analyze(createAiLayer(provider(value)));
  assert.equal(result.source, 'ai');
  assert.equal(result.modelVersion, 'test-model');
  assert.equal(result.confidence, 1);
  assert.equal(result.rationale.length, 1200);
  assert.equal(result.infoRequests?.[0].question.length, 300);
  for (const invalid of [{ ...value, recommendedOutcome: 'SEND_MONEY' }, { ...value, infoRequests: [{ requestedFrom: 'ADMIN', question: 'hi' }] }, { ...value, findings: 'bad' }]) {
    assert.equal((await analyze(createAiLayer(provider(invalid)))).modelVersion, 'veripay-rules-v2');
  }
});
test('provider errors, fenced JSON and deadlines are handled', async () => {
  const throwing: AIProvider = { modelVersion: 'test', generate: async () => { throw new Error('offline'); } };
  assert.equal((await analyze(createAiLayer(throwing))).source, 'rules');
  let signal: AbortSignal;
  const hanging: AIProvider = { modelVersion: 'test', generate: async request => { signal = request.signal; return new Promise(() => {}); } };
  assert.equal((await analyze(createAiLayer(hanging, 10))).source, 'rules');
  assert.equal(signal!.aborted, true);
  const fenced: AIProvider = { modelVersion: 'test', generate: async () => '```json\n{"answer":"Try shoes.","recommendedProductIds":["shoe"]}\n```' };
  assert.equal((await createAiLayer(fenced).searchAndAdvise('shoes', catalog)).source, 'ai');
});
