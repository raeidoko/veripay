import React, { useState, useEffect, useRef } from 'react';
import {
  Shield,
  ShoppingBag,
  Sparkles,
  Search,
  Truck,
  CheckCircle2,
  AlertCircle,
  FileCheck2,
  ArrowRight,
  UserCheck,
  ChevronDown,
  Lock,
  Plus,
  RefreshCw,
} from 'lucide-react';
import {
  Product,
  Order,
  Dispute,
  UserProfile,
  PurchaseSnapshot,
  DispatchContact,
} from './shared/types.ts';
import { api, invalidateSessionRequests } from './client/api.ts';
import { workspaces, type WorkspaceTab } from './shared/workspaces.ts';
import { TrustBadge } from './components/TrustBadge.tsx';
import { PurchaseConfirmationModal } from './components/PurchaseConfirmationModal.tsx';
import { DispatchContactModal } from './components/DispatchContactModal.tsx';
import { AiAssistantDrawer } from './components/AiAssistantDrawer.tsx';
import { DisputeDetailView } from './components/DisputeDetailView.tsx';
import { RiskShieldView } from './components/RiskShieldView.tsx';
import { TrustPassportView } from './components/TrustPassportView.tsx';
import { AuditTrailView } from './components/AuditTrailView.tsx';
import { SellerStorefrontView } from './components/SellerStorefrontView.tsx';
import { ProductReviews } from './components/ProductReviews.tsx';
import { SignInPanel } from './components/SignInPanel.tsx';
import { BrandLogo } from './components/BrandLogo.tsx';
import { AdminControlView } from './components/AdminControlView.tsx';
import { VerificationView } from './components/VerificationView.tsx';
import { WalletPanel } from './components/WalletPanel.tsx';

export default function App() {
  // Navigation tabs
  type TabKey = WorkspaceTab;
  const [activeTab, setActiveTab] = useState<TabKey>('catalog');

  // Users & Active Role
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const [platform, setPlatform] = useState({announcement:'',purchasesPaused:false});
  const personaIdRef = useRef<string | null>(null);

  const workspace = workspaces[currentUser?.role || 'buyer'];
  const canShop = currentUser?.role === 'buyer';
  const canFileDispute = currentUser?.role === 'buyer' || currentUser?.role === 'seller';
  const canView = (tab: TabKey) => !!currentUser && workspace.tabs.some(item => item.id === tab);

  const acceptSignedInUser = (user: UserProfile) => {
    invalidateSessionRequests();
    personaIdRef.current = user.id;
    setCurrentUser(user);
    setActiveTab(user.accountStatus === 'PENDING' ? 'verification' : workspaces[user.role].home);
    setAuthMessage('');
  };

  const clearAccount = () => {
    invalidateSessionRequests();
    personaIdRef.current = null;
    setCurrentUser(null);
    setOrders([]); setDisputes([]); setProducts([]); setCart([]);
    setSelectedProduct(null); setSelectedDispute(null);
    setSelectedOrderForSnapshot(null); setSelectedOrderForDispatch(null);
    setOrderForConfirmation(null); setShowConfirmationModal(false);
    setShowOpenDisputeModal(false); setShowCartDrawer(false); setShowAssistantDrawer(false);
    setDisputeOrderId(''); setDisputeDetails(''); setSearchQuery(''); setSelectedCategory('All');
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try { await api.signOut(); clearAccount(); setAuthMessage(''); }
    catch (error: unknown) { alert(error instanceof Error ? error.message : 'Could not sign out'); }
    finally { setSigningOut(false); }
  };

  // Catalog & Products (F1)
  const [products, setProducts] = useState<Product[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');

  // Cart
  const [cart, setCart] = useState<
    { product: Product; variantName?: string; quantity: number; unitPrice: number }[]
  >([]);
  const [showCartDrawer, setShowCartDrawer] = useState(false);

  // Orders (F1, F2, F6)
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [selectedOrderForSnapshot, setSelectedOrderForSnapshot] = useState<Order | null>(null);
  const [selectedOrderForDispatch, setSelectedOrderForDispatch] = useState<Order | null>(null);

  // F2: AI Purchase Confirmation Modal State
  const [orderForConfirmation, setOrderForConfirmation] = useState<Order | null>(null);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);

  // F1: AI Shopping Assistant Drawer
  const [showAssistantDrawer, setShowAssistantDrawer] = useState(false);

  // Disputes (F3)
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [showOpenDisputeModal, setShowOpenDisputeModal] = useState(false);
  const [disputeOrderId, setDisputeOrderId] = useState('');
  const [disputeReason, setDisputeReason] = useState<'NON_DELIVERY' | 'ITEM_NOT_AS_DESCRIBED' | 'COUNTERFEIT_SUSPICION' | 'DAMAGED_IN_TRANSIT'>('NON_DELIVERY');
  const [disputeDetails, setDisputeDetails] = useState('');

  useEffect(() => {
    let cancelled = false;
    localStorage.removeItem('veripay.persona');
    api.getSession().then(user => { if (!cancelled && user) acceptSignedInUser(user); })
      .catch(() => { if (!cancelled) setAuthMessage('Could not connect to VeriPay. Check that the local server is running.'); })
      .finally(() => { if (!cancelled) setAuthChecked(true); });
    const expired = () => { clearAccount(); setAuthMessage('Your session has ended. Please sign in again.'); };
    window.addEventListener('veripay:session-expired', expired);
    return () => { cancelled = true; window.removeEventListener('veripay:session-expired', expired); };
  }, []);

  useEffect(() => {
    if (currentUser) { loadCatalog(); loadOrders(); loadDisputes(); loadPlatform(); }
  }, [currentUser]);

  const loadCatalog = async () => {
    setCatalogLoading(true);
    try {
      const prods = await api.getProducts(currentUser?.role === 'seller' ? {sellerId:currentUser.id} : undefined);
      setProducts(prods);
    } catch (err) {
      console.error(err);
    } finally {
      setCatalogLoading(false);
    }
  };

  const loadPlatform = async () => {
    try { setPlatform(await api.getPlatform()); } catch { /* Other views remain usable if the notice cannot load */ }
  };

  const loadOrders = async () => {
    if (!currentUser) return;
    setOrdersLoading(true);
    try {
      const ords = await api.getOrders(currentUser.id, currentUser.role);
      if (personaIdRef.current === currentUser.id) setOrders(ords);
    } catch (err) {
      console.error(err);
    } finally {
      if (personaIdRef.current === currentUser.id) setOrdersLoading(false);
    }
  };

  const loadDisputes = async () => {
    const personaId = personaIdRef.current;
    try {
      const ds = await api.getDisputes();
      if (personaIdRef.current === personaId) setDisputes(ds);
    } catch (err) {
      console.error(err);
    }
  };

  // Cart operations
  const handleAddToCart = (product: Product, variantName?: string) => {
    if (!canShop) return;
    const variant = product.variants.find((v) => v.name === variantName);
    const unitPrice = product.price + (variant ? variant.priceDelta : 0);

    setCart((prev) => {
      const existingIdx = prev.findIndex(
        (i) => i.product.id === product.id && i.variantName === variantName
      );
      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx].quantity += 1;
        return copy;
      }
      return [...prev, { product, variantName, quantity: 1, unitPrice }];
    });
    setSelectedProduct(null);
    setShowCartDrawer(true);
  };

  const handleRemoveFromCart = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const cartSubtotal = cart.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);
  const cartEscrowFee = Math.round(cartSubtotal * 0.015);
  const cartTotal = cartSubtotal + cartEscrowFee;

  // Checkout -> Creates Order and triggers F2 AI Confirmation
  const handleProceedToCheckout = async () => {
    if (!canShop || !currentUser || cart.length === 0) return;

    try {
      const order = await api.createOrder({
        buyerId: currentUser.id,
        buyerName: currentUser.name,
        buyerPhone: currentUser.phone,
        deliveryAddress: 'Plot 14, Admiralty Way, Lekki Phase 1, Lagos, Nigeria',
        items: cart.map((i) => ({
          productId: i.product.id,
          variantName: i.variantName,
          quantity: i.quantity,
        })),
      });

      // Clear cart
      setCart([]);
      setShowCartDrawer(false);

      // Open AI Purchase Confirmation modal (F2)
      setOrderForConfirmation(order);
      setShowConfirmationModal(true);

      // Refresh orders
      loadOrders();
    } catch (err: any) {
      alert(err.message || 'Failed to initialize escrow checkout');
    }
  };

  // F2: Buyer confirmed purchase intent
  const handlePurchaseConfirmed = async (snapshot: PurchaseSnapshot) => {
    setShowConfirmationModal(false);
    if (orderForConfirmation) {
      try {
        await api.payEscrow(orderForConfirmation.id);
        alert(`Order #${orderForConfirmation.orderNumber} confirmed and sandbox payment secured.`);
      } catch(error) {
        alert(`Purchase confirmed. ${(error as Error).message}`);
      } finally {
        loadOrders();
        setActiveTab('orders');
      }
    }
  };

  // F6: Dispatch order button clicked
  const handleDispatchClick = (order: Order) => {
    if (!order.dispatchContactId) {
      // Prompt modal to enter F6 dispatch contact
      setSelectedOrderForDispatch(order);
    } else {
      executeDispatch(order.id);
    }
  };

  const executeDispatch = async (orderId: string) => {
    if (!currentUser) return;
    try {
      await api.dispatchOrder(orderId, currentUser.id);
      loadOrders();
      alert('Order marked as DISPATCHED! Dispatch rider and tracking records sealed.');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDispatchContactSaved = (contact: DispatchContact) => {
    setSelectedOrderForDispatch(null);
    loadOrders();
    // Dispatch now that contact exists
    executeDispatch(contact.orderId);
  };

  // Buyer confirms delivery receipt
  const handleConfirmDeliveryReceipt = async (orderId: string) => {
    if (!currentUser) return;
    try {
      await api.confirmDelivery(orderId, currentUser.id);
      loadOrders();
      alert('Delivery confirmed! VeriPay Escrow funds have been released to the seller.');
    } catch (err: any) {
      alert(err.message || 'Failed to confirm delivery');
    }
  };

  // Open dispute handler
  const handleOpenDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !disputeOrderId || !disputeDetails.trim()) return;

    const order = orders.find((o) => o.id === disputeOrderId);
    if (!order) return;

    try {
      const dispute = await api.openDispute({
        orderId: order.id,
        openedBy: currentUser.role === 'seller' ? 'SELLER' : 'BUYER',
        openerName: currentUser.name,
        reason: disputeReason,
        details: disputeDetails.trim(),
        claimedAmount: order.totalAmount,
      });

      setShowOpenDisputeModal(false);
      setDisputeOrderId('');
      setDisputeDetails('');
      loadOrders();
      await loadDisputes();
      setSelectedDispute(dispute);
      setActiveTab('disputes');
      alert('Dispute opened. Purchase snapshot attached automatically as baseline evidence.');
    } catch (err: any) {
      alert(err.message || 'Failed to open dispute');
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchesCat = selectedCategory === 'All' || p.category.toLowerCase() === selectedCategory.toLowerCase();
    const matchesQ =
      !searchQuery.trim() ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sellerName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesQ;
  });

  const categories = ['All', 'Electronics', 'Luxury & Watches', 'Fashion & Luggage', 'Audio & Hardware'];

  const getOrderStatusBadge = (state: string) => {
    switch (state) {
      case 'AWAITING_CONFIRMATION':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'PENDING_PAYMENT':
        return 'bg-brand-50 text-brand-800 border-brand-200';
      case 'RISK_HOLD':
        return 'bg-rose-100 text-rose-800 border-rose-300 font-bold';
      case 'PAYMENT_SECURED':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'DISPATCHED':
      case 'IN_TRANSIT':
        return 'bg-brand-50 text-brand-800 border-brand-200';
      case 'DELIVERED':
      case 'COMPLETED':
        return 'bg-teal-50 text-teal-800 border-teal-200';
      case 'DISPUTED':
        return 'bg-brand-50 text-brand-800 border-brand-200';
      case 'REFUNDED':
        return 'bg-slate-100 text-slate-800 border-slate-300';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  if (!authChecked) return <div role="status" className="min-h-screen flex items-center justify-center bg-slate-50 text-sm text-slate-500">Checking your session…</div>;
  if (!currentUser) return <SignInPanel onSignedIn={acceptSignedInUser} message={authMessage} />;

  return (
    <div className="min-h-screen brand-platform bg-slate-50 text-slate-900 flex flex-col">
      {/* ---------------- 1. TOP BAR CONTRACT ---------------- */}
      {/* Strict 3-zone contract: [Brand Wordmark] — [4-5 Nav Links] — [Primary Action] */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 transition-shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          {/* Zone 1: Brand Wordmark (Single text element, no pill badges) */}
          <div className="flex items-center gap-2 shrink-0">
            <a
              href="#catalog"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab(workspace.home);
              }}
              className="text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap"
            >
              <BrandLogo />
            </a>
          </div>

          {/* Zone 2: 4-5 Concise Navigation Links (single-line whitespace-nowrap) */}
          <nav aria-label="Workspace navigation" className="hidden lg:flex items-center gap-5 text-sm font-medium text-slate-600">
            {currentUser && workspace.tabs.map(item => (
              <button key={item.id} type="button" aria-current={activeTab === item.id ? 'page' : undefined}
                onClick={() => { setSelectedDispute(null); setActiveTab(item.id); }}
                className={`whitespace-nowrap hover:text-brand-600 ${activeTab === item.id ? 'text-brand-600 font-semibold' : ''}`}>
                {item.label}{item.id === 'orders' ? ' (' + orders.length + ')' : ''}
              </button>
            ))}
          </nav>

          {/* Zone 3: 1 Primary Action Area */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Buyer shopping tools */}
            {canShop && <>
            <button
              onClick={() => setShowAssistantDrawer(true)}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-lg border border-brand-200 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-brand-600" />
              <span>AI Assistant</span>
            </button>

            {/* Shopping Cart Pill Button */}
            <button
              onClick={() => setShowCartDrawer(true)}
              className="relative p-2 text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              title="View Cart"
            >
              <ShoppingBag className="w-4 h-4" />
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-brand-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {cart.length}
                </span>
              )}
            </button>

            </>}
            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-right text-xs">
                <span className="block font-semibold text-slate-900 truncate max-w-32">{currentUser.name}</span>
                <span className="capitalize text-slate-400">{currentUser.role}</span>
              </div>
              <button type="button" onClick={handleSignOut} disabled={signingOut} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">{signingOut ? 'Signing out…' : 'Sign out'}</button>
            </div>
          </div>
        </div>
        {currentUser && <nav aria-label="Mobile workspace navigation" className="lg:hidden flex overflow-x-auto gap-4 px-4 py-3 border-t border-slate-100 text-xs font-semibold">
          {workspace.tabs.map(item => <button key={item.id} type="button" aria-current={activeTab === item.id ? 'page' : undefined}
            onClick={() => { setSelectedDispute(null); setActiveTab(item.id); }}
            className={`whitespace-nowrap ${activeTab === item.id ? 'text-brand-600' : 'text-slate-600'}`}>{item.label}</button>)}
        </nav>}
      </header>

      {/* ---------------- 2. MAIN VIEW CONTAINER ---------------- */}
      <main key={currentUser?.id} className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {platform.announcement && <p className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">{platform.announcement}</p>}
        {platform.purchasesPaused && <p className="rounded-xl bg-amber-50 p-4 text-xs text-amber-800">New purchases are temporarily paused. Existing orders and support remain available.</p>}
        {currentUser.role !== 'admin' && currentUser.accountStatus !== 'APPROVED' && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">Your account is awaiting admin approval. <button className="font-bold underline" onClick={()=>setActiveTab('verification')}>Submit verification documents</button> to activate trading.</div>}
        {activeTab === 'admin' && canView('admin') && <AdminControlView currentUser={currentUser} onChanged={loadPlatform} />}
        {activeTab === 'verification' && canView('verification') && <VerificationView onUserUpdated={setCurrentUser} />}
        {/* VIEW: CATALOG & E-COMMERCE (F1) */}
        {activeTab === 'catalog' && canView('catalog') && (
          <div className="space-y-8">
            {/* Storefront Hero */}
            <div className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-10 shadow-xs relative overflow-hidden">
              <div className="max-w-2xl space-y-4">
                <div className="inline-flex items-center gap-2 text-xs font-semibold text-brand-600">
                  <Shield className="w-4 h-4" />
                  <span>VeriPay Escrow Protected Marketplace</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight text-wrap:balance">
                  Buy with Confidence. Every Order Sealed with Immutable AI Evidence.
                </h1>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Browse authentic luxury electronics, timepieces, and artisan craft. Payments stay secured in escrow until you inspect delivery, supported by F6 rider dispatch verification.
                </p>

                {/* Search Bar */}
                <div className="pt-2 flex flex-col sm:flex-row items-stretch gap-2 max-w-xl">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search verified items, sellers, or specifications..."
                      className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-brand-500 text-slate-900"
                    />
                  </div>
                  <button
                    onClick={() => setShowAssistantDrawer(true)}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors shrink-0"
                  >
                    <Sparkles className="w-4 h-4 text-brand-300" />
                    <span>Ask AI Assistant</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Category Segmented Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors ${
                    selectedCategory === cat
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Product Grid */}
            {catalogLoading ? (
              <div className="py-20 text-center text-xs text-slate-500">
                <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                Loading verified escrow catalog...
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-xs text-slate-500">
                No products found matching your search.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between group"
                  >
                    <div>
                      {/* Product Image */}
                      <div className="aspect-4/3 bg-slate-100 relative overflow-hidden">
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                        />
                        <div className="absolute top-2.5 left-2.5">
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-white/90 backdrop-blur-xs text-slate-900 rounded shadow-xs">
                            {product.category}
                          </span>
                        </div>
                      </div>

                      {/* Info */}
                      <div className="p-4 space-y-2">
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span>{product.sellerName}</span>
                          <TrustBadge
                            level={product.sellerPassportLevel}
                            showScore={false}
                            size="sm"
                          />
                        </div>

                        <h3 className="text-sm font-bold text-slate-900 leading-snug line-clamp-2">
                          {product.name}
                        </h3>

                        <p className="text-xs text-slate-500">
                          {product.reviewsCount ? `★ ${product.rating.toFixed(1)} · ${product.reviewsCount} ${product.reviewsCount === 1 ? 'review' : 'reviews'}` : 'No reviews yet'}
                        </p>

                        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                          {product.description}
                        </p>

                        <div className="pt-2 flex items-baseline justify-between">
                          <div>
                            <span className="text-xs text-slate-400 block font-normal">Escrow Price</span>
                            <span className="text-base font-black text-slate-900 tabular-nums">
                              ₦{product.price.toLocaleString('en-NG')}
                            </span>
                          </div>
                          <span className="text-[11px] text-emerald-600 font-medium">
                            {product.estimatedDays}d Dispatch
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action */}
                    <div className="p-4 pt-0">
                      <button
                        onClick={() => {
                          setSelectedProduct(product);
                          setSelectedVariantId(product.variants[0]?.name || '');
                        }}
                        className="w-full py-2 text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                      >
                        <span>Inspect & Buy</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW: ORDERS & ESCROW LIFECYCLE (F1, F2, F6) */}
        {activeTab === 'orders' && canView('orders') && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-brand-600 mb-1">
                  <Lock className="w-4 h-4" />
                  <span>VeriPay Escrow Lifecycle & Dispatch Verification</span>
                </div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                  {workspace.ordersTitle}
                </h2>
                <p className="text-xs text-slate-600 mt-1 max-w-xl">
                  {workspace.ordersDescription}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {canFileDispute && <button
                  onClick={() => setShowOpenDisputeModal(true)}
                  className="px-3.5 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
                >
                  File Order Dispute
                </button>}
                <button
                  onClick={loadOrders}
                  disabled={ordersLoading}
                  className="p-2 text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 ${ordersLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {currentUser && currentUser.role !== 'admin' && <WalletPanel key={currentUser.id} canTopup={currentUser.role === 'buyer'} revision={orders.map(order=>order.id+order.state).join('|')} />}
            {ordersLoading ? (
              <div className="py-16 text-center text-xs text-slate-500">Loading orders...</div>
            ) : orders.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-xs text-slate-500">
                {canShop ? 'You have no purchases yet. Visit Shop to place an order.' : currentUser?.role === 'seller' ? 'No customer orders yet. Manage your products in My Storefront.' : 'No transaction records to review.'}
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => (
                  <div
                    key={order.id}
                    className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4 hover:border-slate-300 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-black text-slate-900 font-mono">
                            {order.orderNumber}
                          </span>
                          <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-md border ${getOrderStatusBadge(order.state)}`}>
                            {order.state.replace(/_/g, ' ')}
                          </span>
                          {order.purchaseSnapshotId && (
                            <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md flex items-center gap-1">
                              <FileCheck2 className="w-3 h-3" /> F2 Sealed
                            </span>
                          )}
                          {order.dispatchContactId && (
                            <span className="px-2 py-0.5 text-[11px] font-semibold bg-brand-50 text-brand-700 border border-brand-200 rounded-md flex items-center gap-1">
                              <Truck className="w-3 h-3" /> F6 Courier Validated
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-500 mt-1 block">
                          Buyer: <strong>{order.buyerName}</strong> · Seller: <strong>{order.sellerName}</strong> · Created: {new Date(order.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-xs text-slate-400 block">Total Escrow Value</span>
                        <span className="text-lg font-black text-slate-900 tabular-nums">
                          ₦{order.totalAmount.toLocaleString('en-NG')}
                        </span>
                      </div>
                    </div>

                    {/* Order Items */}
                    <div className="space-y-2">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={item.imageUrl}
                              alt={item.productName}
                              referrerPolicy="no-referrer"
                              className="w-9 h-9 object-cover rounded border border-slate-200 shrink-0"
                            />
                            <div>
                              <span className="font-semibold text-slate-900">{item.productName}</span>
                              <span className="text-slate-400 block text-[11px]">
                                {item.variantName || 'Standard'} · Qty: {item.quantity}
                              </span>
                            </div>
                          </div>
                          <span className="font-bold text-slate-900 tabular-nums">
                            ₦{item.subtotal.toLocaleString('en-NG')}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Delivery & Terms */}
                    <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <strong>Destination:</strong> {order.deliveryAddress}
                      </div>
                      <div>
                        <strong>Terms:</strong> {order.deliveryTerms}
                      </div>
                    </div>

                    {/* Contextual Actions based on Order State & Role */}
                    <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100">
                      {/* Left: Snapshot Inspection */}
                      {order.purchaseSnapshotId ? (
                        <button
                          onClick={() => setSelectedOrderForSnapshot(order)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-800 transition-colors"
                        >
                          <FileCheck2 className="w-3.5 h-3.5" />
                          <span>View Immutable Purchase Snapshot (SHA-256)</span>
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400 italic">No snapshot sealed</span>
                      )}

                      {/* Right: Operational Buttons */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* F2 Confirmation Step if pending */}
                        {order.state === 'AWAITING_CONFIRMATION' && currentUser?.role === 'buyer' && (
                          <button
                            onClick={() => {
                              setOrderForConfirmation(order);
                              setShowConfirmationModal(true);
                            }}
                            className="px-4 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors"
                          >
                            Proceed to AI Confirmation
                          </button>
                        )}

                        {/* Pay Escrow if Pending Payment */}
                        {order.state === 'PENDING_PAYMENT' && currentUser?.role === 'buyer' && (
                          <button
                            onClick={async () => {
                              await api.payEscrow(order.id);
                              loadOrders();
                              alert('Payment secured into VeriPay Escrow custody!');
                            }}
                            className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
                          >
                            Deposit Escrow Funds
                          </button>
                        )}

                        {/* F6 Dispatch Gate for Seller */}
                        {order.state === 'PAYMENT_SECURED' && currentUser?.role === 'seller' && (
                          <button
                            onClick={() => handleDispatchClick(order)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
                          >
                            <Truck className="w-4 h-4 text-amber-400" />
                            <span>
                              {order.dispatchContactId ? 'Dispatch Order' : 'Register Rider & Dispatch (F6)'}
                            </span>
                          </button>
                        )}

                        {/* Buyer Delivery Confirmation */}
                        {order.state === 'DISPATCHED' && currentUser?.role === 'buyer' && (
                          <button
                            onClick={() => handleConfirmDeliveryReceipt(order.id)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Confirm Delivery Receipt & Release Funds</span>
                          </button>
                        )}

                        {/* Open dispute shortcut */}
                        {canFileDispute && ['PAYMENT_SECURED', 'DISPATCHED', 'IN_TRANSIT'].includes(order.state) && (
                          <button
                            onClick={() => {
                              setDisputeOrderId(order.id);
                              setShowOpenDisputeModal(true);
                            }}
                            className="px-3 py-2 text-xs font-semibold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors"
                          >
                            Report Issue / Dispute
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW: DISPUTE CENTER (F3) */}
        {activeTab === 'disputes' && canView('disputes') && (
          <div>
            {selectedDispute ? (
              <DisputeDetailView
                dispute={selectedDispute}
                userRole={currentUser?.role || 'buyer'}
                currentUserId={currentUser?.id || 'user_buyer_1'}
                currentUserName={currentUser?.name || 'VeriPay User'}
                onBack={() => {
                  setSelectedDispute(null);
                  loadDisputes();
                }}
                onUpdated={(updated) => {
                  setSelectedDispute(updated);
                  loadDisputes();
                }}
              />
            ) : (
              <div className="space-y-6">
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-brand-600 mb-1">
                      <Sparkles className="w-4 h-4" />
                      <span>F3 AI-Assisted, Human-Supervised Dispute Resolution</span>
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                      {currentUser?.role === 'admin' ? 'Dispute Review Queue' : 'My Disputes'}
                    </h2>
                    <p className="text-xs text-slate-600 mt-1 max-w-xl">
                      {currentUser?.role === 'admin' ? 'Review evidence, verify courier delivery, and record a reasoned decision on disputed orders.' : 'Track your cases, submit supporting evidence, and respond to requests from the review team.'}
                    </p>
                  </div>

                  {canFileDispute && <button
                    onClick={() => setShowOpenDisputeModal(true)}
                    className="px-4 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors self-start md:self-auto"
                  >
                    + Open New Dispute Case
                  </button>}
                </div>

                <div className="space-y-4">
                  {disputes.length === 0 ? (
                    <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-xs text-slate-500">
                      No active dispute cases on record.
                    </div>
                  ) : (
                    disputes.map((d) => (
                      <div
                        key={d.id}
                        onClick={() => setSelectedDispute(d)}
                        className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:border-brand-400 cursor-pointer transition-all space-y-3 group"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                          <div className="flex items-center gap-2.5">
                            <span className="text-xs font-mono font-bold text-slate-900">
                              #{d.id.slice(-8)}
                            </span>
                            <span className="text-xs font-bold text-brand-600">
                              Order #{d.orderNumber}
                            </span>
                            <span className="text-slate-300">·</span>
                            <span className="text-xs text-slate-600">
                              Filed by {d.openerName} ({d.openedBy})
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-brand-50 text-brand-700 border border-brand-200">
                              {d.state.replace('_', ' ')}
                            </span>
                            <span className="text-xs font-bold text-slate-900 tabular-nums">
                              ₦{d.claimedAmount.toLocaleString('en-NG')}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-slate-700">
                          <div>
                            <strong className="text-slate-900 block mb-0.5">
                              Reason: {d.reason.replace(/_/g, ' ')}
                            </strong>
                            <p className="line-clamp-2 text-slate-600">{d.details}</p>
                          </div>

                          {d.aiRecommendation && (
                            <div className="bg-brand-50/70 border border-brand-100 p-2.5 rounded-lg shrink-0 text-left md:text-right">
                              <span className="text-[10px] text-brand-900 font-semibold block uppercase">
                                AI Recommendation:
                              </span>
                              <span className="font-bold text-brand-700">
                                {d.aiRecommendation.recommendedOutcome.replace('_', ' ')} ({Math.round(d.aiRecommendation.confidence * 100)}%)
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100">
                          <span>Evidence attached: {d.evidence.length} items</span>
                          <span className="text-brand-600 font-semibold group-hover:underline flex items-center gap-1">
                            <span>Open Arbitration Dossier</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW: RISK SHIELD & IDENTITY LINKING (F4) */}
        {activeTab === 'risk' && canView('risk') && (
          <RiskShieldView
            currentUserId={currentUser?.id || 'user_admin_1'}
            currentUserName={currentUser?.name || 'Tunde Bakare (Risk Officer)'}
          />
        )}

        {/* VIEW: TRUST PASSPORT 2.0 (F5) */}
        {activeTab === 'passport' && canView('passport') && (
          <TrustPassportView
            currentUserId={currentUser?.id || 'user_seller_1'}
            currentUserName={currentUser?.name || 'Lagos Luxury Hub'}
            userRole={currentUser?.role || 'seller'}
          />
        )}

        {/* VIEW: AUDIT TRAIL */}
        {activeTab === 'audit' && canView('audit') && <AuditTrailView />}

        {/* VIEW: SELLER STOREFRONT (F1) */}
        {activeTab === 'seller_store' && canView('seller_store') && currentUser && (
          <SellerStorefrontView
            currentUser={currentUser}
            products={products}
            onProductCreated={(newProd) => {
              setProducts((prev) => [newProd, ...prev]);
            }}
            onProductUpdated={updated => setProducts(previous => previous.map(product => product.id === updated.id ? updated : product))}
          />
        )}
      </main>

      {/* ---------------- PRODUCT DETAIL MODAL ---------------- */}
      {canShop && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div role="dialog" aria-modal="true" aria-labelledby="product-details-heading" className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="aspect-16/9 bg-slate-100 relative">
              <img
                src={selectedProduct.imageUrl}
                alt={selectedProduct.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => setSelectedProduct(null)}
                aria-label="Close product details"
                className="absolute top-3 right-3 p-1.5 rounded-full bg-slate-900/60 text-white hover:bg-slate-900 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-brand-600">{selectedProduct.category}</span>
                <TrustBadge
                  level={selectedProduct.sellerPassportLevel}
                  identityVerified={selectedProduct.sellerIdentityVerified}
                  showScore={true}
                  size="sm"
                />
              </div>

              <div>
                <h3 id="product-details-heading" className="text-lg font-bold text-slate-900">{selectedProduct.name}</h3>
                <p className="text-xs text-slate-500 mt-0.5">Sold by {selectedProduct.sellerName}</p>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">{selectedProduct.description}</p>

              {/* Variants */}
              {selectedProduct.variants.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Select Variant / Specification:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {selectedProduct.variants.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => setSelectedVariantId(v.name)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                          selectedVariantId === v.name
                            ? 'border-brand-600 bg-brand-50 text-brand-900 ring-1 ring-brand-500'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {v.name} {v.priceDelta > 0 ? `(+₦${v.priceDelta.toLocaleString('en-NG')})` : ''}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Delivery terms */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-brand-600" />
                  <span>Guaranteed Delivery SLA (Binding for Evidence):</span>
                </div>
                <p className="text-slate-600">{selectedProduct.deliveryTerms}</p>
              </div>

              {currentUser && <ProductReviews key={`${currentUser.id}:${selectedProduct.id}`} productId={selectedProduct.id} currentUser={currentUser}
                onSaved={summary => {
                  const metrics = { rating: summary.rating, reviewsCount: summary.reviewsCount };
                  setProducts(previous => previous.map(product => product.id === selectedProduct.id ? { ...product, ...metrics } : product));
                  setSelectedProduct(previous => previous && previous.id === selectedProduct.id ? { ...previous, ...metrics } : previous);
                }} />}

              {/* Price & Cart CTA */}
              <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Price</span>
                  <span className="text-xl font-bold text-slate-900 tabular-nums">
                    ₦{selectedProduct.price.toLocaleString('en-NG')}
                  </span>
                </div>

                <button
                  onClick={() => handleAddToCart(selectedProduct, selectedVariantId || undefined)}
                  className="px-6 py-2.5 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-xs transition-colors flex items-center gap-2"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>Add to Protected Cart</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- CART & CHECKOUT DRAWER ---------------- */}
      {canShop && showCartDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200">
            <div>
              <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-brand-400" />
                  <h3 className="text-sm font-bold">Escrow Shopping Cart ({cart.length})</h3>
                </div>
                <button onClick={() => setShowCartDrawer(false)} className="text-slate-400 hover:text-white text-xs">
                  Close
                </button>
              </div>

              <div className="p-5 max-h-[60vh] overflow-y-auto divide-y divide-slate-100">
                {cart.length === 0 ? (
                  <p className="text-xs text-slate-500 py-12 text-center">Your shopping cart is empty.</p>
                ) : (
                  cart.map((item, idx) => (
                    <div key={idx} className="py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={item.product.imageUrl}
                          alt={item.product.name}
                          referrerPolicy="no-referrer"
                          className="w-12 h-12 object-cover rounded border border-slate-200 shrink-0"
                        />
                        <div>
                          <h5 className="text-xs font-bold text-slate-900">{item.product.name}</h5>
                          <span className="text-[11px] text-slate-500 block">
                            {item.variantName || 'Standard'} · Qty: {item.quantity}
                          </span>
                          <span className="text-xs font-semibold text-slate-900 tabular-nums">
                            ₦{(item.unitPrice * item.quantity).toLocaleString('en-NG')}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveFromCart(idx)}
                        className="text-xs text-rose-500 hover:text-rose-700"
                      >
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {cart.length > 0 && (
              <div className="p-5 bg-slate-50 border-t border-slate-200 space-y-3">
                <div className="space-y-1.5 text-xs text-slate-600">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="font-semibold text-slate-900 tabular-nums">₦{cartSubtotal.toLocaleString('en-NG')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>VeriPay Escrow Fee (1.5%)</span>
                    <span className="font-semibold text-slate-900 tabular-nums">₦{cartEscrowFee.toLocaleString('en-NG')}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-bold text-slate-900">
                    <span>Total Protected Amount</span>
                    <span className="text-brand-600 tabular-nums">₦{cartTotal.toLocaleString('en-NG')}</span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 bg-white p-2.5 rounded border border-slate-200 leading-normal flex items-start gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-brand-600 shrink-0 mt-0.5" />
                  <span>
                    Next Step (F2): The AI Agent will ask: <em>"Is this what you really want to purchase?"</em> and seal your immutable Purchase Snapshot before funds move.
                  </span>
                </div>

                <button
                  onClick={handleProceedToCheckout}
                  className="w-full py-3 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
                >
                  <span>Proceed to Escrow Checkout</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------- PURCHASE CONFIRMATION MODAL (F2) ---------------- */}
      {canShop && orderForConfirmation && (
        <PurchaseConfirmationModal
          order={orderForConfirmation}
          isOpen={showConfirmationModal}
          onClose={() => setShowConfirmationModal(false)}
          onConfirmed={handlePurchaseConfirmed}
        />
      )}

      {/* ---------------- DISPATCH CONTACT MODAL (F6) ---------------- */}
      {currentUser?.role === 'seller' && selectedOrderForDispatch && (
        <DispatchContactModal
          order={selectedOrderForDispatch}
          isOpen={!!selectedOrderForDispatch}
          onClose={() => setSelectedOrderForDispatch(null)}
          onSaved={handleDispatchContactSaved}
        />
      )}

      {/* ---------------- AI SHOPPING ASSISTANT DRAWER (F1) ---------------- */}
      {canShop && <AiAssistantDrawer
        isOpen={showAssistantDrawer}
        onClose={() => setShowAssistantDrawer(false)}
        catalog={products}
        onSelectProduct={(p) => {
          setSelectedProduct(p);
          setShowAssistantDrawer(false);
        }}
      />}

      {/* ---------------- OPEN DISPUTE MODAL (F3) ---------------- */}
      {canFileDispute && showOpenDisputeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="text-sm font-bold">Open VeriPay Dispute (F3)</h3>
              <button onClick={() => setShowOpenDisputeModal(false)} className="text-slate-400 hover:text-white text-xs">
                Cancel
              </button>
            </div>

            <form onSubmit={handleOpenDispute} className="p-6 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Opening a dispute freezes escrow release. The order's <strong>Purchase Snapshot (F2)</strong> will automatically attach as baseline evidence, and the AI Dispute Analyzer will evaluate courier dispatch records.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Disputed Order *</label>
                <select
                  value={disputeOrderId}
                  onChange={(e) => setDisputeOrderId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md text-slate-900"
                  required
                >
                  <option value="">-- Choose an active order --</option>
                  {orders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.orderNumber} · {o.items[0]?.productName} (₦{o.totalAmount.toLocaleString('en-NG')})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Primary Dispute Reason *</label>
                <select
                  value={disputeReason}
                  onChange={(e: any) => setDisputeReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md text-slate-900"
                >
                  <option value="NON_DELIVERY">Non-Delivery (Agreed deadline passed, parcel not received)</option>
                  <option value="ITEM_NOT_AS_DESCRIBED">Item Not As Described (Conflicts with purchase snapshot)</option>
                  <option value="DAMAGED_IN_TRANSIT">Damaged In Transit (Carrier handling defect)</option>
                  <option value="COUNTERFEIT_SUSPICION">Counterfeit Suspicion / Serial mismatch</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Statement of Facts *</label>
                <textarea
                  rows={3}
                  value={disputeDetails}
                  onChange={(e) => setDisputeDetails(e.target.value)}
                  placeholder="Detail the issue, dates, communications, and courier findings..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md text-slate-900"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowOpenDisputeModal(false)}
                  className="px-4 py-2 text-xs text-slate-600 bg-white border border-slate-300 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-md"
                >
                  File Dispute & Lock Escrow
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- SNAPSHOT VIEWER MODAL (F2) ---------------- */}
      {selectedOrderForSnapshot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold">Tamper-Evident Purchase Snapshot (F2)</h3>
              </div>
              <button
                onClick={() => setSelectedOrderForSnapshot(null)}
                className="text-slate-400 hover:text-white text-xs"
              >
                Close
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900">
                <strong>Cryptographic Integrity Verified:</strong> This snapshot was sealed at payment time and cannot be altered by either buyer or seller.
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  SHA-256 Digest
                </span>
                <code className="text-[11px] font-mono bg-slate-100 p-2 rounded block break-all text-slate-800 border border-slate-200">
                  {selectedOrderForSnapshot.purchaseSnapshotId}
                </code>
              </div>

              <div className="space-y-2 border border-slate-200 rounded-lg p-3 text-xs bg-slate-50">
                <div>
                  <span className="text-slate-400 block text-[10px]">Order Number</span>
                  <span className="font-bold text-slate-900">{selectedOrderForSnapshot.orderNumber}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Buyer Confirmation Text</span>
                  <span className="text-slate-800 italic">"Yes, this is what I want to purchase."</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Agreed Delivery Terms</span>
                  <span className="text-slate-800">{selectedOrderForSnapshot.deliveryTerms}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Escrow Value</span>
                  <span className="font-bold text-slate-900 tabular-nums">
                    ₦{selectedOrderForSnapshot.totalAmount.toLocaleString('en-NG')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- 3. FOOTER ---------------- */}
      <footer className="bg-white border-t border-slate-200 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            <div className="flex items-center gap-3"><BrandLogo size="footer" /><span>Verify · Connect · Pay</span></div>
          </div>
          <div className="flex items-center gap-4">
            <span>Audit-Chain Active</span>
            <span>·</span>
            <span>Human-Supervised Consequential Decisions</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
