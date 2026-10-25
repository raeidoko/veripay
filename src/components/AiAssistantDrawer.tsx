import React, { useState } from 'react';
import { Sparkles, X, Send, Bot, ArrowRight, ShieldCheck } from 'lucide-react';
import { Product } from '../shared/types.ts';
import { api } from '../client/api.ts';

interface AiAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  catalog: Product[];
  onSelectProduct: (product: Product) => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  recommendedProducts?: Product[];
  suggestedFilters?: string[];
}

export const AiAssistantDrawer: React.FC<AiAssistantDrawerProps> = ({
  isOpen,
  onClose,
  catalog,
  onSelectProduct,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg_welcome',
      sender: 'assistant',
      text: 'Hello! I am the VeriPay Shopping Assistant. Ask me about products, verified seller trust ratings, guaranteed delivery timelines, or how our escrow protects your purchase.',
      suggestedFilters: [
        'Which laptops have next-day dispatch?',
        'Show me Crown-tier luxury watches',
        'How does the F2 purchase snapshot work?',
      ],
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSend = async (queryText?: string) => {
    const q = queryText || input.trim();
    if (!q || loading) return;

    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text: q,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const response = await api.assistantSearch(q);
      const recommended = catalog.filter((p) =>
        response.recommendedProductIds?.includes(p.id)
      );

      const aiMsg: ChatMessage = {
        id: `ai_${Date.now()}`,
        sender: 'assistant',
        text: response.answer,
        recommendedProducts: recommended,
        suggestedFilters: response.suggestedFilters,
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          id: `ai_err_${Date.now()}`,
          sender: 'assistant',
          text: 'I could not reach the catalog assistant at the moment. Please try again or browse the products directly.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl border-l border-slate-200 flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-brand-500/20 text-brand-300 rounded-md border border-brand-400/30">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-tight">AI Shopping Assistant</h3>
            <p className="text-[11px] text-slate-300">Catalog-grounded product & escrow intelligence</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-4 py-3 text-xs leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-brand-600 text-white font-medium rounded-br-xs'
                  : 'bg-slate-100 text-slate-800 rounded-bl-xs border border-slate-200'
              }`}
            >
              {msg.sender === 'assistant' && (
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-brand-600 mb-1">
                  <Bot className="w-3.5 h-3.5" />
                  <span>VeriPay Assistant</span>
                </div>
              )}
              <p className="whitespace-pre-line">{msg.text}</p>
            </div>

            {/* Recommended Products Carousel/Cards */}
            {msg.recommendedProducts && msg.recommendedProducts.length > 0 && (
              <div className="mt-2.5 w-full space-y-2">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Catalog Match ({msg.recommendedProducts.length})
                </span>
                {msg.recommendedProducts.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => onSelectProduct(p)}
                    className="p-2.5 bg-white border border-slate-200 hover:border-brand-400 rounded-lg cursor-pointer transition-all shadow-xs flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        referrerPolicy="no-referrer"
                        className="w-10 h-10 object-cover rounded-md border border-slate-100 shrink-0"
                      />
                      <div className="truncate">
                        <h5 className="text-xs font-semibold text-slate-900 group-hover:text-brand-600 truncate">
                          {p.name}
                        </h5>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                          <span className="font-semibold text-slate-900 tabular-nums">
                            ₦{p.price.toLocaleString('en-NG')}
                          </span>
                          <span>·</span>
                          <span className="text-emerald-600 font-medium">{p.sellerPassportLevel} Seller</span>
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-brand-600 shrink-0" />
                  </div>
                ))}
              </div>
            )}

            {/* Suggested quick questions */}
            {msg.suggestedFilters && msg.suggestedFilters.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {msg.suggestedFilters.map((flt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(flt)}
                    className="text-[11px] text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md px-2.5 py-1 transition-colors text-left"
                  >
                    {flt}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3 max-w-[80%]">
            <div className="w-3.5 h-3.5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
            <span>Consulting catalog & trust registry...</span>
          </div>
        )}
      </div>

      {/* Escrow assurance footer tip */}
      <div className="px-4 py-2 bg-brand-50/50 border-t border-slate-100 flex items-center gap-1.5 text-[11px] text-brand-900">
        <ShieldCheck className="w-3.5 h-3.5 text-brand-600 shrink-0" />
        <span>Every transaction is sealed with SHA-256 evidence & escrow protection.</span>
      </div>

      {/* Input bar */}
      <div className="p-3 bg-white border-t border-slate-200">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about products, sellers, or escrow..."
            className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-brand-500 text-slate-900"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="p-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white rounded-lg transition-colors shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
