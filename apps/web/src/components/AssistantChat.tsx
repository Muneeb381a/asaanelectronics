import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot } from 'lucide-react';
import { assistantApi } from '../api/assistant.api.ts';
import { getErrorMessage } from '../utils/error.ts';

interface ChatMsg { role: 'user' | 'bot'; text: string }

const STARTERS = [
  'Aaj ki collection kitni hai?',
  'Aaj kiski qist due hai?',
  'Overdue customers kitne hain?',
  'Is mahine ka profit kitna hai?',
];

// Rule-based, not AI — every reply comes from the same seller-scoped service
// methods the dashboard itself uses, so it can never answer with another
// shop's data. See assistant.service.ts on the backend for the intent list.
export default function AssistantChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setMessages((m) => [...m, { role: 'user', text: trimmed }]);
    setInput('');
    setSending(true);
    try {
      const res = await assistantApi.ask(trimmed);
      setMessages((m) => [...m, { role: 'bot', text: res.reply }]);
    } catch (e) {
      setMessages((m) => [...m, { role: 'bot', text: getErrorMessage(e, 'Kuch masla ho gaya, dobara try karein.') }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {open && (
        <div className="fixed bottom-20 right-4 sm:bottom-24 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[320px] h-[65vh] sm:h-[420px] max-h-[520px] bg-white rounded-2xl shadow-2xl ring-1 ring-slate-200 flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 px-3.5 py-2.5 bg-linear-to-r from-blue-600 to-indigo-600 text-white shrink-0">
            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <Bot size={13} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold leading-tight">Shop Assistant</p>
              <p className="text-[10px] text-blue-100">Apni shop ke bare mein poochein</p>
            </div>
            <button onClick={() => setOpen(false)} className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition">
              <X size={14} />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 bg-slate-50">
            {messages.length === 0 && (
              <div className="space-y-2">
                <p className="text-xs text-slate-400 text-center py-2">Ye try karen:</p>
                {STARTERS.map((s) => (
                  <button key={s} onClick={() => void send(s)}
                    className="w-full text-left text-xs px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 hover:border-blue-300 hover:bg-blue-50/50 transition">
                    {s}
                  </button>
                ))}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex items-end gap-1.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'bot' && (
                  <div className="w-5 h-5 rounded-full bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 mb-0.5">
                    <Bot size={11} className="text-white" />
                  </div>
                )}
                <div className={`max-w-[78%] px-3 py-2 rounded-xl text-[13px] whitespace-pre-line leading-snug ${
                  m.role === 'user' ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-white text-slate-700 ring-1 ring-slate-200 rounded-bl-sm'
                }`}>
                  {m.text}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex items-end gap-1.5 justify-start">
                <div className="w-5 h-5 rounded-full bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 mb-0.5">
                  <Bot size={11} className="text-white" />
                </div>
                <div className="bg-white ring-1 ring-slate-200 rounded-xl rounded-bl-sm px-3 py-2.5">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce" />
                  </div>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={(e) => { e.preventDefault(); void send(input); }} className="flex items-center gap-1.5 p-2 border-t border-slate-100 shrink-0 bg-white">
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Apna sawal likhein..."
              className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-[13px] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition" />
            <button type="submit" disabled={!input.trim() || sending}
              className="p-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl transition shrink-0">
              <Send size={15} />
            </button>
          </form>
        </div>
      )}

      <button onClick={() => setOpen((o) => !o)} title="Shop Assistant"
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-12 h-12 rounded-full bg-linear-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-300/50 flex items-center justify-center hover:scale-105 transition-transform">
        {open ? <X size={20} /> : <MessageCircle size={20} />}
      </button>
    </>
  );
}
