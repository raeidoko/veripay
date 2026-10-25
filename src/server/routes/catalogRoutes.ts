import express from 'express';
import { users } from '../db/store.ts';
import { asyncRoute } from './routeUtils.ts';
import { catalogService } from '../services/catalogService.ts';
import { productReviewService } from '../services/productReviewService.ts';
import { authService } from '../services/authService.ts';
import { aiLayer } from '../services/aiLayer.ts';

export const catalogRoutes = express.Router();
  // Users & Role Switching
  catalogRoutes.get('/users', (_req, res) => {
    res.json(users);
  });

  // F1: Catalog Service
  catalogRoutes.get('/products', (req, res) => {
    const { category, query, sellerId } = req.query as {
      category?: string;
      query?: string;
      sellerId?: string;
    };
    const actor = authService.currentUser(req);
    const products = catalogService.getProducts({ category, query, sellerId, includeHidden: actor?.role === 'admin' || (actor?.role === 'seller' && sellerId === actor.id) });
    res.json(products);
  });

  catalogRoutes.get('/products/:id', (req, res) => {
    const product = catalogService.getProductById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    const actor = authService.currentUser(req);
    if (!catalogService.isPublic(product) && actor?.role !== 'admin' && actor?.id !== product.sellerId) return res.status(404).json({error:'Product not found'});
    res.json(product);
  });

  catalogRoutes.get('/products/:id/reviews', (req, res) => {
    const product = catalogService.getProductById(req.params.id);
    const actor = authService.currentUser(req);
    if (!product || (!catalogService.isPublic(product) && actor?.role !== 'admin' && actor?.id !== product.sellerId)) return res.status(404).json({ error: 'Product not found' });
    res.json(productReviewService.getSummary(req.params.id));
  });

  catalogRoutes.post('/products/:id/reviews', (req, res) => {
    const product = catalogService.getProductById(req.params.id);
    if (!product || !catalogService.isPublic(product)) return res.status(404).json({ error: 'Product not found' });
    try {
      res.json(productReviewService.save(req.params.id, res.locals.user, req.body.rating, req.body.comment));
    } catch (error: unknown) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Could not save review' });
    }
  });

  catalogRoutes.post('/seller/products', (req, res) => {
    try {
    const { sellerId, sellerName, name, category, description, price, stock, imageUrl, deliveryTerms, estimatedDays, variants } = req.body;
    if (!sellerId || !name || !price) {
      return res.status(400).json({ error: 'Missing required product attributes' });
    }
    const product = catalogService.createProduct(
      { id: sellerId, name: sellerName || 'Verified Merchant' },
      { name, category, description, price, stock: stock ?? 1, imageUrl, deliveryTerms, estimatedDays: estimatedDays ?? 2, variants }
    );
    res.status(201).json(product);
    } catch(error) { res.status(400).json({error:(error as Error).message}); }
  });

  catalogRoutes.put('/seller/products/:id', (req, res) => {
    try {
    const { sellerId, updates } = req.body;
    const updated = catalogService.updateProduct(req.params.id, sellerId, updates);
    if (!updated) return res.status(404).json({ error: 'Product not found or unauthorized' });
    res.json(updated);
    } catch(error) { res.status(400).json({error:(error as Error).message}); }
  });

  // F1: AI Shopping Assistant
  catalogRoutes.post('/assistant/search', asyncRoute(async (req, res) => {
    const { query } = req.body;
    if (typeof query !== 'string' || !query.trim() || query.length > 2000) return res.status(400).json({ error: 'Enter a query up to 2,000 characters' });
    const allProducts = catalogService.getProducts();
    const advice = await aiLayer.searchAndAdvise(query, allProducts);
    res.json(advice);
  }));
