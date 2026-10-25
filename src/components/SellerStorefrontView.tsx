import React, { useState } from 'react';
import { Plus, Package, Edit3, CheckCircle2, Truck, ShieldCheck, Sparkles } from 'lucide-react';
import { Product, UserProfile } from '../shared/types.ts';
import { api } from '../client/api.ts';
import { TrustBadge } from './TrustBadge.tsx';
import { ProductImagePicker } from './ProductImagePicker.tsx';

interface SellerStorefrontViewProps {
  currentUser: UserProfile;
  products: Product[];
  onProductCreated: (product: Product) => void;
  onProductUpdated: (product: Product) => void;
}

export const SellerStorefrontView: React.FC<SellerStorefrontViewProps> = ({
  currentUser,
  products,
  onProductCreated,
  onProductUpdated,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Electronics');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('5');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageProduct, setImageProduct] = useState<Product | null>(null);
  const [replacementFile, setReplacementFile] = useState<File | null>(null);
  const [imageError, setImageError] = useState('');
  const [savingImage, setSavingImage] = useState(false);
  const [deliveryTerms, setDeliveryTerms] = useState('Insured next-day dispatch with courier recipient verification.');
  const [estimatedDays, setEstimatedDays] = useState('1');
  const [submitting, setSubmitting] = useState(false);

  // Filter seller's own products
  const sellerProducts = products.filter((p) => p.sellerId === currentUser.id);

  const handleCreateListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !price) return;
    if (!imageFile) { setImageError('Choose a product image before publishing.'); return; }

    setSubmitting(true);
    setImageError('');
    try {
      const imageUrl = await api.uploadProductImage(imageFile);
      const created = await api.createProduct({
        sellerId: currentUser.id,
        sellerName: currentUser.name,
        name: name.trim(),
        category,
        description: description.trim(),
        price: Number(price),
        stock: Number(stock) || 1,
        imageUrl,
        deliveryTerms: deliveryTerms.trim(),
        estimatedDays: Number(estimatedDays) || 2,
        variants: [
          { id: `v_${Date.now()}_1`, name: 'Standard Edition', sku: `SKU-${Date.now().toString().slice(-4)}`, priceDelta: 0, stock: Number(stock) || 1 },
        ],
      });

      onProductCreated(created);
      setShowAddModal(false);
      setName('');
      setDescription('');
      setPrice('');
      setImageFile(null);
      alert(created.moderationStatus === 'PENDING' ? 'Product submitted for admin approval. It will appear in the marketplace after approval.' : 'Product listing published.');
    } catch (err: any) {
      setImageError(err.message || 'Failed to create product listing');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReplaceImage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!imageProduct || !replacementFile) return;
    setSavingImage(true);
    setImageError('');
    try {
      const imageUrl = await api.uploadProductImage(replacementFile);
      const product = await api.updateProductImage(imageProduct.id, imageUrl);
      onProductUpdated(product);
      setImageProduct(null);
      setReplacementFile(null);
    } catch (error: unknown) {
      setImageError(error instanceof Error ? error.message : 'Could not update the image');
    } finally { setSavingImage(false); }
  };

  return (
    <div className="space-y-6">
      {/* Merchant Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-brand-600">Merchant Storefront Manager</span>
            <span className="text-slate-300">·</span>
            <span className="text-xs text-slate-500">{currentUser.name}</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Seller Catalog & Inventory Controls
          </h2>
          <p className="text-xs text-slate-600 mt-1 max-w-xl">
            Manage your verified listings, stock levels, and guaranteed delivery terms. Every listing is bound by VeriPay Escrow and F6 dispatch verification.
          </p>
        </div>

        <button
          onClick={() => { setImageError(''); setShowAddModal(true); }}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm transition-colors self-start md:self-auto shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Product Listing</span>
        </button>
      </div>

      {/* Seller Listings Grid */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
          Active Storefront Listings ({sellerProducts.length})
        </h3>

        {sellerProducts.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-xs text-slate-500">
            No active listings found for this seller account. Click "Add New Product Listing" to create your first verified item.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sellerProducts.map((p) => (
              <div
                key={p.id}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="aspect-4/3 bg-slate-100 relative overflow-hidden">
                    <img
                      src={p.imageUrl}
                      alt={p.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-3 left-3">
                      <span className="px-2 py-1 text-[11px] font-semibold bg-white/90 backdrop-blur-xs text-slate-900 rounded-md shadow-xs">
                        {p.category}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 space-y-2">
                    <h4 className="text-sm font-bold text-slate-900 leading-snug">{p.name}</h4>
                    <p className="text-[11px] font-semibold text-brand-600">{p.moderationStatus === 'PENDING' ? 'Awaiting admin approval' : p.moderationStatus === 'HIDDEN' ? 'Hidden by admin' : 'Published'}</p>
                    {p.moderationNotes && <p className="text-xs text-slate-500">Admin: {p.moderationNotes}</p>}
                    <p className="text-xs text-slate-600 line-clamp-2">{p.description}</p>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Price</span>
                        <span className="font-bold text-slate-900 tabular-nums">₦{p.price.toLocaleString('en-NG')}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-400 block text-[10px]">Inventory</span>
                        <span className="font-semibold text-emerald-600 tabular-nums">{p.stock} in stock</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
                  <span className="truncate">SLA: {p.deliveryTerms.slice(0, 35)}...</span>
                  <button type="button" onClick={() => { setImageProduct(p); setReplacementFile(null); setImageError(''); }}
                    aria-label={`Change image for ${p.name}`} className="text-brand-600 font-semibold shrink-0 hover:underline">Change image</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div role="dialog" aria-modal="true" aria-labelledby="create-product-heading" className="relative w-full max-w-lg max-h-[90vh] flex flex-col bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <h3 id="create-product-heading" className="text-sm font-bold">Create Verified Product Listing</h3>
              <button disabled={submitting} onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white text-xs">
                Cancel
              </button>
            </div>

            <form onSubmit={handleCreateListing} className="p-6 space-y-4 overflow-y-auto">
              <ProductImagePicker file={imageFile} onChange={setImageFile} disabled={submitting} />
              {imageError && <p role="alert" className="text-xs text-rose-600">{imageError}</p>}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Product Title *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Dell XPS 15 32GB RAM"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md text-slate-900"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md text-slate-900"
                  >
                    <option value="Electronics">Electronics</option>
                    <option value="Luxury & Watches">Luxury & Watches</option>
                    <option value="Fashion & Luggage">Fashion & Luggage</option>
                    <option value="Audio & Hardware">Audio & Hardware</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Price (NGN ₦) *</label>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="e.g. 850000"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md font-mono text-slate-900"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Product specs, condition, and warranty info..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Available Stock Units</label>
                  <input
                    type="number"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Estimated Days</label>
                  <input
                    type="number"
                    value={estimatedDays}
                    onChange={(e) => setEstimatedDays(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md font-mono text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Guaranteed Delivery Terms (Binding for F2 Snapshot)
                </label>
                <input
                  type="text"
                  value={deliveryTerms}
                  onChange={(e) => setDeliveryTerms(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md text-slate-900"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs text-slate-600 bg-white border border-slate-300 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !imageFile}
                  className="px-5 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-md"
                >
                  {submitting ? 'Creating...' : 'Publish Listing'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {imageProduct && <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <form onSubmit={handleReplaceImage} role="dialog" aria-modal="true" aria-labelledby="replace-image-heading"
          className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 shadow-2xl space-y-4">
          <div>
            <h3 id="replace-image-heading" className="text-sm font-bold text-slate-900">Change product image</h3>
            <p className="mt-1 text-xs text-slate-500">{imageProduct.name}</p>
          </div>
          <ProductImagePicker file={replacementFile} onChange={setReplacementFile} disabled={savingImage} />
          {imageError && <p role="alert" className="text-xs text-rose-600">{imageError}</p>}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" disabled={savingImage} onClick={() => setImageProduct(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-xs text-slate-600">Cancel</button>
            <button type="submit" disabled={savingImage || !replacementFile} className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{savingImage ? 'Uploading…' : 'Save image'}</button>
          </div>
        </form>
      </div>}
    </div>
  );
};
