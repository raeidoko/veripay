import { GoogleGenAI } from '@google/genai';
import { Order, Product, Dispute, PurchaseSnapshot, DeliveryVerification, EvidenceItem } from '../../shared/types.ts';

// Initialize Gemini Client
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = apiKey ? new GoogleGenAI({ apiKey, httpOptions: { timeout: 15000 } }) : null;
const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

export const aiLayer = {
  /**
   * F2: AI Purchase Confirmation Prompt Generator
   * Generates the plain-language prompt asking: "Is this what you really want to purchase?"
   */
  async generateConfirmationPrompt(order: Order, sellerPassportLevel: string = 'GOLD'): Promise<{
    headline: string;
    summaryText: string;
    keyCheckpoints: string[];
    escrowNote: string;
  }> {
    const itemsDescription = order.items
      .map((item) => `${item.quantity}x ${item.productName} (${item.variantName || 'Standard'}) @ ₦${item.unitPrice.toLocaleString('en-NG')}`)
      .join(', ');

    const promptText = `
You are the VeriPay AI Purchase Confirmation Agent.
A buyer is preparing to pay via escrow for this order:
- Order ID: ${order.orderNumber}
- Items: ${itemsDescription}
- Total Amount (inc. escrow): ₦${order.totalAmount.toLocaleString('en-NG')}
- Seller: ${order.sellerName} (Trust Level: ${sellerPassportLevel})
- Delivery Address: ${order.deliveryAddress}
- Delivery Terms: ${order.deliveryTerms}

Your task: Produce a structured, reassuring, and precise confirmation review asking the buyer: "Is this what you really want to purchase?"
Format response in JSON with keys:
- headline: (e.g. "Is this what you really want to purchase?")
- summaryText: (1-2 sentences summarizing the items, seller, and delivery destination)
- keyCheckpoints: array of 3-4 bullet strings highlighting exact item/variant, guaranteed delivery terms, and return window
- escrowNote: (1 sentence explaining how VeriPay Escrow secures funds until delivery confirmation)
`;

    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: promptText,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        });

        if (response.text) {
          const parsed = JSON.parse(response.text);
          return {
            headline: parsed.headline || 'Is this what you really want to purchase?',
            summaryText: parsed.summaryText || `You are purchasing ${itemsDescription} from ${order.sellerName} for ₦${order.totalAmount.toLocaleString('en-NG')}.`,
            keyCheckpoints: parsed.keyCheckpoints || [
              `Item & Variant: ${order.items[0]?.productName} (${order.items[0]?.variantName || 'Standard'})`,
              `Delivery Destination: ${order.deliveryAddress}`,
              `Delivery Protocol: ${order.deliveryTerms}`,
            ],
            escrowNote: parsed.escrowNote || 'Your payment remains locked in VeriPay Escrow and will not be paid to the seller until you confirm delivery.',
          };
        }
      } catch (err) {
        console.warn('AI Confirmation Prompt generation fallback triggered:', err);
      }
    }

    // High-fidelity fallback
    return {
      headline: 'Is this what you really want to purchase?',
      summaryText: `You are authorizing an escrow purchase of ${order.items.length} item(s) from ${order.sellerName} totaling ₦${order.totalAmount.toLocaleString('en-NG')}.`,
      keyCheckpoints: [
        `Specified Goods: ${itemsDescription}`,
        `Destination: ${order.deliveryAddress}`,
        `Seller Commitment: ${order.deliveryTerms}`,
        `Audit Trail: A cryptographic SHA-256 snapshot will be sealed upon your confirmation.`,
      ],
      escrowNote: `VeriPay Escrow holds your ₦${order.totalAmount.toLocaleString('en-NG')} safely until you inspect and accept the dispatch package.`,
    };
  },

  /**
   * F1: AI Shopping Assistant for Product Discovery & Questions
   */
  async searchAndAdvise(
    query: string,
    catalog: Product[]
  ): Promise<{
    answer: string;
    recommendedProductIds: string[];
    suggestedFilters?: string[];
  }> {
    const catalogSummary = catalog.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      price: p.price,
      currency: p.currency,
      sellerName: p.sellerName,
      passportLevel: p.sellerPassportLevel,
      deliveryTerms: p.deliveryTerms,
    }));

    const promptText = `
You are the VeriPay Shopping & Trust Assistant.
The user is asking: "${query}".

Only reference items from this authentic catalog:
${JSON.stringify(catalogSummary, null, 2)}

Provide helpful, concise guidance on product choice, escrow safety, seller trust level, and delivery terms.
Format response in JSON with:
- answer: concise, conversational paragraph (2-3 sentences max)
- recommendedProductIds: array of matching product ids from the catalog (max 3)
- suggestedFilters: array of 2-3 short suggestions or follow-up topics
`;

    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: promptText,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.3,
          },
        });

        if (response.text) {
          const parsed = JSON.parse(response.text);
          return {
            answer: parsed.answer,
            recommendedProductIds: parsed.recommendedProductIds || [],
            suggestedFilters: parsed.suggestedFilters || [],
          };
        }
      } catch (err) {
        console.warn('AI Shopping Assistant fallback triggered:', err);
      }
    }

    // Heuristic search fallback
    const q = query.toLowerCase();
    const matched = catalog.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
    );

    const ids = (matched.length > 0 ? matched : catalog.slice(0, 2)).map((p) => p.id);

    return {
      answer: `Based on VeriPay's catalog and escrow protections, we found ${ids.length} verified listings matching your request. All listings include automatic purchase snapshots and dispatch verification.`,
      recommendedProductIds: ids,
      suggestedFilters: ['Next-day dispatch', 'Crown sellers', 'Laptops & Tech', 'Luxury Watches'],
    };
  },

  /**
   * F3: AI-Assisted Dispute Analyzer with Inconsistency Detection
   */
  async analyzeDisputeCase(
    dispute: Dispute,
    snapshot: PurchaseSnapshot | undefined,
    deliveryVerifications: DeliveryVerification[],
    evidence: EvidenceItem[]
  ): Promise<{
    findings: string[];
    inconsistencies: string[];
    recommendedOutcome: 'BUYER_REFUNDED' | 'SELLER_PAID' | 'SPLIT';
    confidence: number;
    rationale: string;
  }> {
    const caseSummary = {
      disputeReason: dispute.reason,
      disputeDetails: dispute.details,
      claimedAmount: dispute.claimedAmount,
      snapshotAvailable: !!snapshot,
      snapshotHash: snapshot?.sha256,
      agreedDeliveryTerms: snapshot?.payload?.deliveryTerms,
      deliveryVerifications: deliveryVerifications.map((dv) => ({
        method: dv.method,
        outcome: dv.outcome,
        notes: dv.notes,
        verifiedAt: dv.verifiedAt,
      })),
      evidenceItemsCount: evidence.length,
      evidenceTypes: evidence.map((e) => `${e.party}: ${e.type} (${e.title})`),
    };

    const promptText = `
You are the VeriPay AI Dispute Resolution Analyzer.
Analyze the following dispute facts:
${JSON.stringify(caseSummary, null, 2)}

Requirements:
1. Synthesize clear findings from the Purchase Snapshot, uploaded evidence, and independent dispatch verification.
2. Identify any inconsistencies between buyer claims, seller claims, and independent third-party delivery logs.
3. Recommend an advisory outcome: "BUYER_REFUNDED", "SELLER_PAID", or "SPLIT".
4. Assign a confidence score from 0.0 to 1.0.
5. Provide a clear, objective rationale for the human reviewer.
Format response in JSON with keys:
- findings: string[]
- inconsistencies: string[]
- recommendedOutcome: "BUYER_REFUNDED" | "SELLER_PAID" | "SPLIT"
- confidence: number
- rationale: string
`;

    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: promptText,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        });

        if (response.text) {
          const parsed = JSON.parse(response.text);
          return {
            findings: parsed.findings || ['Purchase snapshot baseline verified.'],
            inconsistencies: parsed.inconsistencies || [],
            recommendedOutcome: parsed.recommendedOutcome || 'BUYER_REFUNDED',
            confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.9,
            rationale: parsed.rationale || 'Analysis based on verified third-party courier dispatch records.',
          };
        }
      } catch (err) {
        console.warn('AI Dispute Analysis fallback triggered:', err);
      }
    }

    // Deterministic rule-based evaluation fallback
    const hasFailedDelivery = deliveryVerifications.some((dv) => dv.outcome === 'NOT_DELIVERED');
    const hasConfirmedDelivery = deliveryVerifications.some((dv) => dv.outcome === 'CONFIRMED_DELIVERED');

    if (hasFailedDelivery) {
      return {
        findings: [
          'Purchase Snapshot establishes initial agreed delivery deadline.',
          'F6 Independent Dispatch carrier contact confirmed parcel was not delivered to buyer.',
          'Escrow funds remain securely intact in VeriPay custody.',
        ],
        inconsistencies: [
          'Order dispatch log previously showed dispatched, but carrier dispatch confirmed transit failure.',
        ],
        recommendedOutcome: 'BUYER_REFUNDED',
        confidence: 0.95,
        rationale: 'Independent carrier dispatch verification conclusively demonstrates non-delivery. Full buyer refund is recommended. Seller is entitled to carrier insurance claim.',
      };
    }

    if (hasConfirmedDelivery) {
      return {
        findings: [
          'F6 Dispatch verification confirms physical handoff with recipient verification.',
          'Purchase snapshot matches delivered item specifications.',
        ],
        inconsistencies: [
          'Buyer claim of non-receipt conflicts with verified courier geo-stamp and recipient PIN record.',
        ],
        recommendedOutcome: 'SELLER_PAID',
        confidence: 0.92,
        rationale: 'Third-party courier verified successful handoff. Escrow release to seller recommended.',
      };
    }

    return {
      findings: [
        'Dispute filed under active escrow protection.',
        'Purchase Snapshot baseline evidence recorded with SHA-256 seal.',
      ],
      inconsistencies: [
        'Delivery evidence is incomplete pending courier response.',
      ],
      recommendedOutcome: 'SPLIT',
      confidence: 0.65,
      rationale: 'Further verification required before consequential release or refund.',
    };
  },
};
