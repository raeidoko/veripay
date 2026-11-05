import { ArrowDown, ArrowRight, Check, ClipboardCheck, FileCheck2, MessageSquareText, PackageCheck, Scale, ShieldCheck, ShoppingBag, Sparkles, Store, Truck, UserCheck, Wallet } from 'lucide-react';
import './LandingPage.css';

const features = [
  { icon: Sparkles, title: 'Find products with a little help.', label: 'AI SHOPPING ASSISTANT', text: 'Ask about products, sellers or delivery in plain language. The assistant uses the catalog to suggest relevant listings, while product details and prices come from the marketplace.', benefit: 'Spend less time searching. Review the actual listing before buying.' },
  { icon: FileCheck2, title: 'Keep the agreement, not just the receipt.', label: 'PURCHASE EVIDENCE', text: 'Before payment, review the item, variant, quantity, seller, delivery terms and total. VeriPay saves a timestamped record of the confirmed agreement for later reference.', benefit: 'Both sides have a record of what was agreed.' },
  { icon: Wallet, title: 'See where your payment stands.', label: 'ESCROW & WALLET', text: 'Follow available and held balances alongside your order. The checkout shows the purchase amount and escrow fee before you confirm. This demo uses simulated funds.', benefit: 'Understand the payment stage before taking your next step.' },
  { icon: Truck, title: 'Follow the handover.', label: 'DISPATCH & DELIVERY', text: 'Sellers record a rider or logistics contact before dispatch. Buyers and sellers can follow the recorded order status, with delivery information available for review.', benefit: 'Keep the dispatch details connected to the purchase.' },
  { icon: Scale, title: 'Give problems a clear path forward.', label: 'DISPUTES & HUMAN REVIEW', text: 'Raise a dispute, submit supporting evidence and respond to requests. A reviewer considers the purchase agreement, delivery records and evidence before recording a decision.', benefit: 'Get an evidence-based review rather than an automated verdict.' },
  { icon: UserCheck, title: 'Understand your marketplace record.', label: 'TRUST PASSPORT', text: 'See your trust level and the recorded factors behind it. Eligible users can challenge trust events and follow the outcome of an administrator’s review.', benefit: 'See the context behind trust information and ask for a review.' },
];

const questions = [
  ['What is VeriPay?', 'VeriPay brings shopping, purchase agreements, escrow status, delivery records and dispute review into one platform for buyers, sellers and administrators. The current release is a demo for exploring these workflows with simulated funds.'],
  ['Do buyers need to upload an identity document?', 'Buyers can register with their name, email, phone and password and start shopping. Identity document review is optional for buyers. Sellers submit verification documents and need administrator approval before trading.'],
  ['What happens to an escrow payment?', 'The app records the payment as held against the order while the purchase is fulfilled. Buyers should check the item before confirming receipt. If there is a problem, the dispute workflow lets a reviewer consider the evidence and record a decision. All payments in this demo are simulated.'],
  ['What does the AI decide?', 'The shopping assistant helps you discover catalog items. Reviewers may also use AI-assisted analysis when reviewing disputes. AI does not make the final dispute decision, approve accounts or independently move money. An authorized reviewer makes the dispute decision.'],
  ['Are fees shown before I buy?', 'Yes. Purchase confirmation shows the subtotal, escrow fee and total before you confirm the agreement. Review the product variant and delivery terms as well.'],
  ['What if my delivery is wrong or does not arrive?', 'Open My Purchases to find the order, then use My Disputes to raise the issue and provide evidence. The reviewer can consider the saved agreement and delivery records, request more information, and record an outcome.'],
  ['Can I return to the same account?', 'Yes. Sign in with the same email and password to return to your workspace. Signing out does not delete your account. A server restart may end your session and require you to sign in again. If you forget your password, use Forgot password to request administrator-assisted recovery.'],
];

export function LandingPage() {
  return <div className="vp-landing">
    <a className="vp-skip" href="#main-content">Skip to content</a>
    <header className="vp-nav vp-container">
      <a href="/" className="vp-wordmark" aria-label="VeriPay home"><img src="/brand/veripay-logo.png" alt="" width="52" height="52" /><span>VeriPay<span className="vp-wordmark-dot">.</span></span></a>
      <nav aria-label="Main navigation"><a className="vp-nav-guide" href="#features">Features</a><a className="vp-nav-guide" href="#how-it-works">How it works</a><a className="vp-nav-guide" href="#questions">FAQs</a><a href="/login">Sign in <ArrowRight size={16} aria-hidden="true" /></a></nav>
    </header>
    <main id="main-content">
      <section className="vp-hero vp-container" aria-labelledby="hero-heading">
        <div className="vp-hero-copy">
          <p className="vp-eyebrow"><span /> BUY. SELL. STAY IN THE KNOW.</p>
          <h1 id="hero-heading">Good finds.<br />Clear agreements.<br /><span>More confidence.</span></h1>
          <p className="vp-intro">VeriPay brings buyers and sellers together with recorded purchase agreements, escrow payment tracking and a clear process for delivery and disputes.</p>
          <div className="vp-actions"><a className="vp-button vp-primary" href="/register">Get started <ArrowRight size={19} aria-hidden="true" /></a><a className="vp-text-link" href="/getting-started">Meet VeriPay <ArrowDown size={17} aria-hidden="true" /></a></div>
          <p className="vp-demo-note"><ShieldCheck size={16} aria-hidden="true" /> Explore the demo with simulated payments.</p>
        </div>
        <figure className="vp-image-card">
          <div className="vp-card-top"><span><span className="vp-status-dot" /> INSIDE THE VERIPAY APP</span><ShoppingBag size={18} aria-hidden="true" /></div>
          <div className="vp-photo-wrap"><img className="vp-hero-photo vp-platform-photo" src="/brand/veripay-workspace.png" alt="VeriPay’s buyer workspace showing the shop, product listings and navigation in a demonstration account" width="1440" height="1100" fetchPriority="high" /></div>
          <figcaption><div><span className="vp-card-kicker">ACTUAL APP · DEMONSTRATION ACCOUNT</span><h2>Your purchase journey.<br />One connected workspace.</h2></div><a href="/getting-started" aria-label="Explore the VeriPay getting started guide" className="vp-card-arrow"><ArrowRight size={24} aria-hidden="true" /></a></figcaption>
          <div className="vp-card-steps"><span><Check size={14} aria-hidden="true" /> Agree</span><i /><span><ShieldCheck size={14} aria-hidden="true" /> Pay</span><i /><span><Truck size={14} aria-hidden="true" /> Receive</span></div>
        </figure>
      </section>
      <section className="vp-overview vp-container" aria-labelledby="overview-heading">
        <div><p className="vp-eyebrow">MEET VERIPAY</p><h2 id="overview-heading">More context for every<br />commerce decision.</h2></div>
        <div><p>Buying online involves more than choosing a product. You need to know what the seller promised, what you paid for, who is delivering it and what happens if something goes wrong.</p><p>VeriPay connects those details in one place. Buyers keep track of purchases, sellers manage listings and dispatch, and administrators review verification, trust concerns and disputes using the recorded evidence.</p><a className="vp-text-link" href="/getting-started">Explore the buyer and seller guides <ArrowRight size={18} aria-hidden="true" /></a></div>
      </section>
      <section id="features" className="vp-features vp-container" aria-labelledby="features-heading">
        <div className="vp-detail-heading"><p className="vp-eyebrow">WHAT THE PLATFORM DOES</p><h2 id="features-heading">The details that make<br />the difference.</h2><p>Practical tools for discovery, agreement, payment and resolution.</p></div>
        <div className="vp-feature-grid">{features.map(({ icon: Icon, title, label, text, benefit }) => <article key={label}><Icon size={27} aria-hidden="true" /><p className="vp-feature-label">{label}</p><h3>{title}</h3><p>{text}</p><div className="vp-feature-benefit"><Check size={16} aria-hidden="true" /><span>{benefit}</span></div></article>)}</div>
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
        <div className="vp-audience-details"><article><ShoppingBag size={25} aria-hidden="true" /><div><h3>For buyers</h3><p>Create your account, discover products and review the purchase agreement. Track orders in My Purchases, view your wallet and raise issues in My Disputes. Identity document review is optional.</p></div></article><article><Store size={25} aria-hidden="true" /><div><h3>For sellers</h3><p>Register your business and submit verification documents. Once approved, manage product images, variants, prices and delivery terms in My Storefront. Record dispatch contacts and respond to disputes from your workspace.</p></div></article><article><ClipboardCheck size={25} aria-hidden="true" /><div><h3>For administrators</h3><p>Review seller verification, moderate listings, investigate risk flags and resolve disputes with evidence. Admin Control also receives password recovery requests and provides account management tools.</p></div></article></div>
      </section>
      <section id="questions" className="vp-faq vp-container" aria-labelledby="faq-heading"><div className="vp-detail-heading"><p className="vp-eyebrow">GOOD QUESTIONS. CLEAR ANSWERS.</p><h2 id="faq-heading">Know before you begin.</h2></div><div className="vp-faq-list">{questions.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div><div className="vp-demo-panel"><MessageSquareText size={23} aria-hidden="true" /><p><strong>Try the workflow before real-world trading.</strong> VeriPay currently uses simulated payments. This demo does not process live money or provide independent courier tracking. Order statuses and dispatch contacts are recorded within the app.</p></div></section>
      <section className="vp-final vp-container"><div><p className="vp-eyebrow">YOUR NEXT STEP STARTS HERE</p><h2>A little more clarity.<br />A lot more possibility.</h2></div><a className="vp-button vp-primary" href="/register">Create your account <ArrowRight size={19} aria-hidden="true" /></a></section>
    </main>
    <footer className="vp-footer vp-container"><div><a className="vp-footer-name" href="/">VeriPay.</a><p>Verify. Connect. Pay.</p></div><nav aria-label="Footer navigation"><a href="#features">Features</a><a href="#questions">FAQs</a><a href="/getting-started">Getting started</a><a href="/login">Sign in</a><a href="/forgot-password">Forgot password?</a></nav><p className="vp-footer-demo">Demo environment · Simulated funds</p></footer>
  </div>;
}
