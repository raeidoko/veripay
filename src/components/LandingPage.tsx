import { ArrowDown, ArrowRight, Check, ClipboardCheck, PackageCheck, ShieldCheck, ShoppingBag, Store, Truck } from 'lucide-react';
import './LandingPage.css';

export function LandingPage() {
  return <div className="vp-landing">
    <a className="vp-skip" href="#main-content">Skip to content</a>
    <header className="vp-nav vp-container">
      <a href="/" className="vp-wordmark" aria-label="VeriPay home"><img src="/brand/veripay-logo.png" alt="" width="52" height="52" /><span>VeriPay<span className="vp-wordmark-dot">.</span></span></a>
      <nav aria-label="Main navigation"><a className="vp-nav-guide" href="#how-it-works">How it works</a><a href="/login">Sign in <ArrowRight size={16} aria-hidden="true" /></a></nav>
    </header>
    <main id="main-content">
      <section className="vp-hero vp-container" aria-labelledby="hero-heading">
        <div className="vp-hero-copy">
          <p className="vp-eyebrow"><span /> BUY. SELL. STAY IN THE KNOW.</p>
          <h1 id="hero-heading">Good finds.<br />Clear agreements.<br /><span>More confidence.</span></h1>
          <p className="vp-intro">From the first click to the final delivery, keep your purchase, payment and proof in one place.</p>
          <div className="vp-actions"><a className="vp-button vp-primary" href="/register">Get started <ArrowRight size={19} aria-hidden="true" /></a><a className="vp-text-link" href="/getting-started">Meet VeriPay <ArrowDown size={17} aria-hidden="true" /></a></div>
          <p className="vp-demo-note"><ShieldCheck size={16} aria-hidden="true" /> Explore the demo with simulated payments.</p>
        </div>
        <figure className="vp-image-card">
          <div className="vp-card-top"><span><span className="vp-status-dot" /> THE FIND IS JUST THE BEGINNING</span><ShoppingBag size={18} aria-hidden="true" /></div>
          <div className="vp-photo-wrap"><img className="vp-hero-photo" src="/images/macbook_m3_laptop_1792658266873.jpg" alt="A silver laptop on a sunlit table, an example of a product you can shop for" width="1200" height="896" fetchPriority="high" /><span className="vp-photo-label"><Check size={14} aria-hidden="true" /> A clearer purchase journey</span></div>
          <figcaption><div><span className="vp-card-kicker">FROM DISCOVERY TO DELIVERY</span><h2>Your next great find.<br />Every step accounted for.</h2></div><span className="vp-card-arrow"><ArrowRight size={24} aria-hidden="true" /></span></figcaption>
          <div className="vp-card-steps"><span><Check size={14} aria-hidden="true" /> Agree</span><i /><span><ShieldCheck size={14} aria-hidden="true" /> Pay</span><i /><span><Truck size={14} aria-hidden="true" /> Receive</span></div>
        </figure>
      </section>
      <section className="vp-benefits vp-container" aria-label="What VeriPay helps you do">
        <div><ClipboardCheck size={24} aria-hidden="true" /><span>Know the agreement<small>Product, price and delivery terms recorded.</small></span></div>
        <div><ShieldCheck size={24} aria-hidden="true" /><span>Follow your payment<small>Escrow status alongside your purchase.</small></span></div>
        <div><PackageCheck size={24} aria-hidden="true" /><span>Keep the evidence<small>Order records to help resolve disputes.</small></span></div>
      </section>
      <section id="how-it-works" className="vp-how" aria-labelledby="how-heading"><div className="vp-container">
        <div className="vp-section-heading"><div><p className="vp-eyebrow">LESS GUESSWORK. MORE CLARITY.</p><h2 id="how-heading">A better way to<br />follow a purchase.</h2></div><p>You know what you agreed to,<br className="vp-desktop-break" /> and where to go next.</p></div>
        <ol className="vp-process">
          <li><span className="vp-step-number">01</span><h3>Find your fit.</h3><p>Explore the shop or ask the shopping assistant. Review the product, seller and delivery terms.</p></li>
          <li><span className="vp-step-number">02</span><h3>Make it clear.</h3><p>Confirm the details before you buy. VeriPay saves the agreement and tracks the escrow payment.</p></li>
          <li><span className="vp-step-number">03</span><h3>Follow it through.</h3><p>Track your order, check your delivery and confirm receipt. If something goes wrong, raise a dispute for review.</p></li>
        </ol>
      </div></section>
      <section className="vp-audience vp-container" aria-labelledby="audience-heading">
        <div className="vp-audience-intro"><p className="vp-eyebrow">TWO SIDES. ONE CLEAR RECORD.</p><h2 id="audience-heading">For your next purchase.<br />For your growing business.</h2><a className="vp-text-link" href="/getting-started">See your getting started guide <ArrowRight size={18} aria-hidden="true" /></a></div>
        <div className="vp-audience-details"><article><ShoppingBag size={25} aria-hidden="true" /><div><h3>Here to shop?</h3><p>Create a buyer account, browse products and keep purchases and support in your own workspace.</p></div></article><article><Store size={25} aria-hidden="true" /><div><h3>Here to sell?</h3><p>Register your business, submit your verification documents and list products once approved.</p></div></article></div>
      </section>
      <section className="vp-final vp-container"><div><p className="vp-eyebrow">YOUR NEXT STEP STARTS HERE</p><h2>A little more clarity.<br />A lot more possibility.</h2></div><a className="vp-button vp-primary" href="/register">Create your account <ArrowRight size={19} aria-hidden="true" /></a></section>
    </main>
    <footer className="vp-footer vp-container"><div><a className="vp-footer-name" href="/">VeriPay.</a><p>Verify. Connect. Pay.</p></div><nav aria-label="Footer navigation"><a href="/getting-started">Getting started</a><a href="/login">Sign in</a><a href="/forgot-password">Forgot password?</a></nav><p className="vp-footer-demo">Demo environment · Simulated funds</p></footer>
  </div>;
}
