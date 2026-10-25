import { Product, ProductVariant } from '../../shared/types.ts';
import { products, trustProfiles, users } from '../db/store.ts';
import { platformService } from './platformService.ts';
import { auditLogService } from './auditLogService.ts';
import { productReviewService } from './productReviewService.ts';
import { randomUUID } from 'node:crypto';
import { text, whole } from '../utils/validation.ts';
import { kobo } from './walletService.ts';

function validateProduct(data: any) {
  data.name = text(data.name, 'Product name', 2, 200);
  data.category = text(data.category || 'General', 'Category', 1, 100);
  data.description = text(data.description || data.name, 'Description', 2, 5000);
  data.deliveryTerms = text(data.deliveryTerms || 'Delivery arranged with the seller', 'Delivery terms', 3, 2000);
  kobo(data.price);
  whole(data.stock, 'Stock');
  whole(data.estimatedDays ?? 2, 'Delivery days', 1, 365);
  if (data.imageUrl && (typeof data.imageUrl !== 'string' || data.imageUrl.length > 2000 || !/^(?:https?:\/\/|\/(?!\/))/i.test(data.imageUrl))) throw new Error('Invalid product image URL');
  if (!Array.isArray(data.variants) || data.variants.length > 100) throw new Error('Invalid product variants');
  const names = new Set<string>();
  for (const variant of data.variants) {
    if (!variant || typeof variant !== 'object') throw new Error('Invalid product variant');
    variant.name = text(variant.name, 'Variant name', 1, 100);
    variant.id = text(variant.id, 'Variant ID', 1, 100);
    variant.sku = text(variant.sku || variant.id, 'SKU', 1, 100);
    if (names.has(variant.name)) throw new Error('Variant names must be unique');
    names.add(variant.name);
    if (typeof variant.priceDelta !== 'number' || !Number.isFinite(variant.priceDelta)) throw new Error('Invalid variant price');
    kobo(data.price + variant.priceDelta);
    whole(variant.stock, 'Variant stock');
  }
}

export const catalogService = {
  isPublic(product: Product) {
    const seller = users.find(user => user.id === product.sellerId);
    return product.moderationStatus !== 'PENDING' && product.moderationStatus !== 'HIDDEN' && seller?.accountStatus === 'APPROVED' && !seller.isRestricted;
  },
  getProducts(params?: { category?: string; query?: string; sellerId?: string; includeHidden?: boolean }): Product[] {
    let result = [...products];
    if (!params?.includeHidden) result = result.filter(product => this.isPublic(product));

    if (params?.category && params.category !== 'All') {
      result = result.filter((p) => p.category.toLowerCase() === params.category!.toLowerCase());
    }

    if (params?.query) {
      const q = params.query.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.sellerName.toLowerCase().includes(q)
      );
    }

    if (params?.sellerId) {
      result = result.filter((p) => p.sellerId === params.sellerId);
    }

    // Refresh seller passport level from current trust profiles
    return result.map((p) => {
      const profile = trustProfiles[p.sellerId];
      const { rating, reviewsCount } = productReviewService.getSummary(p.id);
      return {
        ...p,
        rating,
        reviewsCount,
        sellerPassportLevel: profile ? profile.level : p.sellerPassportLevel,
        sellerIdentityVerified: profile ? profile.identityVerified : p.sellerIdentityVerified,
      };
    });
  },

  getProductById(id: string): Product | undefined {
    const product = products.find((p) => p.id === id);
    if (!product) return undefined;
    const profile = trustProfiles[product.sellerId];
    const { rating, reviewsCount } = productReviewService.getSummary(id);
    return {
      ...product,
      rating,
      reviewsCount,
      sellerPassportLevel: profile ? profile.level : product.sellerPassportLevel,
      sellerIdentityVerified: profile ? profile.identityVerified : product.sellerIdentityVerified,
    };
  },

  createProduct(
    seller: { id: string; name: string },
    data: {
      name: string;
      category: string;
      description: string;
      price: number;
      stock: number;
      imageUrl: string;
      deliveryTerms: string;
      estimatedDays: number;
      variants?: ProductVariant[];
    }
  ): Product {
    validateProduct({...data, variants:data.variants || []});
    const profile = trustProfiles[seller.id];
    const newProduct: Product = {
      id: `prod_${randomUUID()}`,
      name: data.name,
      category: data.category || 'General',
      description: data.description || data.name,
      price: data.price,
      currency: 'NGN',
      stock: data.stock,
      sellerId: seller.id,
      sellerName: seller.name,
      sellerPassportLevel: profile ? profile.level : 'BRONZE',
      sellerIdentityVerified: profile ? profile.identityVerified : false,
      imageUrl: data.imageUrl || '/images/macbook_m3_laptop_1792658266873.jpg',
      deliveryTerms: data.deliveryTerms || 'Delivery arranged with the seller',
      estimatedDays: data.estimatedDays || 2,
      variants: data.variants || [],
      rating: 0,
      moderationStatus: platformService.settings().requireProductApproval ? 'PENDING' : 'PUBLISHED',
      reviewsCount: 0,
      created_at: new Date().toISOString(),
    };

    products.unshift(newProduct);
    platformService.recordProduct(newProduct);

    auditLogService.log({
      actorId: seller.id,
      actorName: seller.name,
      actorRole: 'seller',
      action: 'PRODUCT_CREATED',
      entityType: 'ORDER',
      entityId: newProduct.id,
      changesSummary: `Seller created product listing: "${newProduct.name}" at ₦${newProduct.price.toLocaleString()}`,
    });

    return newProduct;
  },

  updateProduct(id: string, sellerId: string, updates: Partial<Product>): Product | null {
    const index = products.findIndex((p) => p.id === id && p.sellerId === sellerId);
    if (index === -1) return null;

    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) throw new Error('Provide listing updates');
    const allowed = ['name','category','description','price','stock','imageUrl','deliveryTerms','estimatedDays','variants'];
    const safe = Object.fromEntries(Object.entries(updates).filter(([key]) => allowed.includes(key)));
    const candidate = { ...products[index], ...safe };
    validateProduct(candidate);
    products[index] = candidate;
    if (platformService.settings().requireProductApproval) products[index].moderationStatus = 'PENDING';
    platformService.recordProduct(products[index]);
    return this.getProductById(id)!;
  },
};
