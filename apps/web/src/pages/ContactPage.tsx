import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CreditCard, Mail, ArrowRight, MapPin, Phone, Clock,
  Send, CheckCircle, ChevronDown, ChevronUp, Building2, Navigation,
} from 'lucide-react';

const PLATFORM_WHATSAPP = '923001234567';
const PLATFORM_EMAIL    = 'support@assaan-electronics.com';

function WhatsAppIcon({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

const SUBJECTS = [
  'Pricing & Plans',
  'Getting Started',
  'Technical Support',
  'Billing & Payment',
  'Feature Request',
  'Other',
];

const faqs = [
  {
    q: 'How do I get started?',
    a: 'Click "Get started free" and register your shop account. Your 14-day free trial begins immediately — no credit card needed. Setup takes under 2 minutes.',
  },
  {
    q: 'Can I have multiple staff accounts?',
    a: 'Yes. On the Pro plan you can add multiple staff members so your entire team can manage installments, record payments, and view customer history.',
  },
  {
    q: 'Is my customer data safe?',
    a: "Absolutely. CNIC data is hashed using HMAC-SHA256 before storage and is never stored in plain text. Every shop's data is completely isolated — no other shop can see your records.",
  },
  {
    q: 'How do I upgrade my plan?',
    a: 'Simply message us on WhatsApp and we will upgrade your shop within minutes. No downtime, no data loss.',
  },
  {
    q: 'Do I need internet to use the system?',
    a: 'Yes, Assaan Electronics is a web-based platform that requires internet access. It works on any device — phone, tablet, or desktop — through your browser.',
  },
  {
    q: 'Can I export my data?',
    a: 'You can generate PDF bills for every installment. Full data export is on our roadmap for the Pro plan — reach out on WhatsApp to request early access.',
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`border rounded-2xl transition-all duration-200 ${
      open
        ? 'border-blue-500/30 bg-blue-500/5'
        : 'border-white/8 bg-white/[0.03] hover:bg-white/[0.05]'
    }`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left"
      >
        <span className={`text-sm font-semibold ${open ? 'text-blue-400' : 'text-white'}`}>{q}</span>
        {open
          ? <ChevronUp size={16} className="text-blue-400 shrink-0" />
          : <ChevronDown size={16} className="text-gray-500 shrink-0" />}
      </button>
      {open && (
        <div className="px-6 pb-5">
          <p className="text-sm text-gray-400 leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  );
}

function ContactForm() {
  const [form, setForm] = useState({ name: '', phone: '', subject: '', message: '' });
  const [sent, setSent] = useState(false);

  const set = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSend = () => {
    const text = [
      `*New Inquiry from Website*`,
      ``,
      `*Name:* ${form.name}`,
      `*Phone:* ${form.phone || 'Not provided'}`,
      `*Subject:* ${form.subject || 'General'}`,
      ``,
      `*Message:*`,
      form.message,
    ].join('\n');

    window.open(
      `https://wa.me/${PLATFORM_WHATSAPP}?text=${encodeURIComponent(text)}`,
      '_blank',
      'noopener',
    );
    setSent(true);
  };

  const isValid = form.name.trim().length >= 2 && form.message.trim().length >= 10;

  if (sent) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 bg-emerald-500/15 border border-emerald-500/25 rounded-full flex items-center justify-center mb-4">
          <CheckCircle size={28} className="text-emerald-400" />
        </div>
        <h3 className="text-lg font-bold text-white mb-2">Message sent!</h3>
        <p className="text-sm text-gray-400 max-w-xs leading-relaxed">
          Your inquiry was forwarded to WhatsApp. We'll reply within minutes during business hours.
        </p>
        <button
          onClick={() => { setSent(false); setForm({ name: '', phone: '', subject: '', message: '' }); }}
          className="mt-6 text-sm text-blue-400 hover:text-blue-300 font-medium transition"
        >
          Send another message
        </button>
      </div>
    );
  }

  const inputCls = 'w-full px-4 py-3 text-sm bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/60 focus:bg-white/8 transition';

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-1.5">
            Your name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            placeholder="Ahmed Raza"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-1.5">Phone number</label>
          <input
            type="tel"
            placeholder="03XX-XXXXXXX"
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-400 mb-1.5">Subject</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {SUBJECTS.map((s) => (
            <button
              key={s}
              onClick={() => set('subject', s)}
              className={`px-3 py-2 rounded-xl text-xs font-medium border transition text-left ${
                form.subject === s
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-900/40'
                  : 'border-white/10 text-gray-400 hover:border-blue-500/40 hover:text-blue-400 bg-white/[0.03]'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-400 mb-1.5">
          Message <span className="text-red-400">*</span>
        </label>
        <textarea
          rows={5}
          placeholder="Tell us what you need — pricing, features, setup help, or anything else…"
          value={form.message}
          onChange={(e) => set('message', e.target.value)}
          className={`${inputCls} resize-none`}
        />
        <p className="text-xs text-gray-600 mt-1">{form.message.length} / 500 characters</p>
      </div>

      <button
        onClick={handleSend}
        disabled={!isValid}
        className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#25D366] hover:bg-[#20bd5a] disabled:opacity-35 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition shadow-lg shadow-green-900/25"
      >
        <WhatsAppIcon size={17} />
        Send via WhatsApp
        <Send size={13} />
      </button>

      <p className="text-center text-xs text-gray-600">
        Your message will open WhatsApp with all details pre-filled.
      </p>
    </div>
  );
}

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 antialiased">

      {/* ── Navbar ── */}
      <header className="sticky top-0 z-50 bg-gray-950/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm shadow-blue-900/50">
              <CreditCard size={15} className="text-white" />
            </div>
            <span className="font-bold text-white text-sm">Assaan Electronics</span>
          </Link>
          <nav className="hidden md:flex items-center gap-7">
            <Link to="/#features" className="text-sm text-gray-400 hover:text-white transition">Features</Link>
            <Link to="/#pricing"  className="text-sm text-gray-400 hover:text-white transition">Pricing</Link>
            <Link to="/contact"   className="text-sm text-white font-semibold">Contact</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login"
              className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition">
              Sign in
            </Link>
            <Link to="/register"
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition shadow-sm shadow-blue-900/50">
              Get started free
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden py-24 px-5">
        {/* Background orbs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full"
            style={{ background: 'radial-gradient(ellipse, rgba(37,99,235,0.20) 0%, transparent 65%)' }} />
          <div className="absolute bottom-0 right-0 w-[400px] h-[300px] rounded-full"
            style={{ background: 'radial-gradient(ellipse, rgba(37,211,102,0.10) 0%, transparent 70%)' }} />
          <div className="absolute inset-0 opacity-[0.05]"
            style={{ backgroundImage: 'radial-gradient(circle, #6366f1 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        </div>

        <div className="relative max-w-3xl mx-auto text-center">
          {/* Live badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white/5 border border-white/10 rounded-full text-xs font-semibold mb-7 text-gray-300">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            Typically reply within minutes on WhatsApp
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-5 text-white leading-[1.08]">
            We're here to help you{' '}
            <span className="bg-linear-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
              grow your business
            </span>
          </h1>
          <p className="text-gray-400 text-base sm:text-lg leading-relaxed max-w-xl mx-auto mb-10">
            Questions about pricing, setup, or features? Drop us a message — our team is based in
            Kapurwali, Sialkot and ready to assist.
          </p>

          {/* Quick action buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a
              href={`https://wa.me/${PLATFORM_WHATSAPP}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#25D366] hover:bg-[#20bd5a] rounded-xl text-sm font-bold transition shadow-lg shadow-green-900/30 text-white"
            >
              <WhatsAppIcon size={16} />
              Chat on WhatsApp
            </a>
            <a
              href={`mailto:${PLATFORM_EMAIL}`}
              className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl text-sm font-semibold text-gray-300 hover:text-white transition"
            >
              <Mail size={15} />
              Send an email
            </a>
          </div>
        </div>
      </section>

      {/* ── Main grid: Form + Sidebar ── */}
      <section className="pb-20 px-5 border-t border-white/5">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-8 pt-16">

          {/* Contact form */}
          <div className="lg:col-span-3">
            <div className="bg-white/[0.04] border border-white/8 rounded-3xl p-8 sm:p-10">
              <div className="mb-8">
                <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-2">Send a message</p>
                <h2 className="text-2xl font-extrabold text-white">Tell us how we can help</h2>
                <p className="text-sm text-gray-500 mt-1.5">
                  Fill out the form and your message will open pre-filled in WhatsApp.
                </p>
              </div>
              <ContactForm />
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-2 flex flex-col gap-4">

            {/* WhatsApp */}
            <a
              href={`https://wa.me/${PLATFORM_WHATSAPP}?text=${encodeURIComponent('Hello, I want to know more about Assaan Electronics.')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-4 bg-[#25D366]/10 border border-[#25D366]/25 hover:bg-[#25D366]/15 rounded-2xl p-6 transition"
            >
              <div className="w-11 h-11 bg-[#25D366]/20 border border-[#25D366]/30 rounded-xl flex items-center justify-center shrink-0">
                <WhatsAppIcon size={20} className="text-[#25D366]" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-sm text-white">WhatsApp — Fastest</p>
                <p className="text-gray-400 text-xs mt-0.5 leading-relaxed">
                  Get a reply in minutes during business hours. Preferred contact method.
                </p>
                <div className="flex items-center gap-1 mt-2 text-xs font-semibold text-[#25D366]">
                  Chat now <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </a>

            {/* Email */}
            <a
              href={`mailto:${PLATFORM_EMAIL}`}
              className="group flex items-start gap-4 bg-white/[0.04] border border-white/8 hover:bg-white/[0.07] rounded-2xl p-6 transition"
            >
              <div className="w-11 h-11 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center shrink-0">
                <Mail size={20} className="text-blue-400" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-sm text-white">Email</p>
                <p className="text-blue-400 text-xs font-medium mt-0.5 truncate">{PLATFORM_EMAIL}</p>
                <p className="text-gray-500 text-xs mt-1">Response within 24 hours</p>
              </div>
            </a>

            {/* Hours */}
            <div className="flex items-start gap-4 bg-amber-500/8 border border-amber-500/18 rounded-2xl p-6">
              <div className="w-11 h-11 bg-amber-500/15 border border-amber-500/20 rounded-xl flex items-center justify-center shrink-0">
                <Clock size={20} className="text-amber-400" />
              </div>
              <div>
                <p className="font-bold text-sm text-white">Business Hours</p>
                <p className="text-gray-400 text-xs mt-0.5">Monday – Saturday</p>
                <p className="text-amber-400 text-xs font-semibold mt-0.5">9:00 AM – 9:00 PM (PKT)</p>
                <p className="text-gray-600 text-xs mt-1">Sunday: Closed</p>
              </div>
            </div>

            {/* Location */}
            <div className="flex items-start gap-4 bg-white/[0.04] border border-white/8 rounded-2xl p-6">
              <div className="w-11 h-11 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-center shrink-0">
                <MapPin size={20} className="text-red-400" />
              </div>
              <div>
                <p className="font-bold text-sm text-white">Our Location</p>
                <p className="text-gray-300 text-xs font-medium mt-0.5">Kapurwali</p>
                <p className="text-gray-500 text-xs">Sialkot, Punjab · Pakistan</p>
                <a
                  href="https://maps.google.com/?q=Kapurwali,Sialkot,Punjab,Pakistan"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-2 text-xs text-blue-400 hover:text-blue-300 font-medium transition"
                >
                  <Navigation size={11} /> View on map
                </a>
              </div>
            </div>

            {/* Phone */}
            <div className="flex items-start gap-4 bg-white/[0.04] border border-white/8 rounded-2xl p-6">
              <div className="w-11 h-11 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center shrink-0">
                <Phone size={20} className="text-indigo-400" />
              </div>
              <div>
                <p className="font-bold text-sm text-white">Phone</p>
                <p className="text-gray-500 text-xs mt-0.5">WhatsApp preferred for fastest response.</p>
                <a
                  href={`https://wa.me/${PLATFORM_WHATSAPP}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-1.5 text-xs text-[#25D366] font-semibold hover:underline"
                >
                  <WhatsAppIcon size={11} />
                  +{PLATFORM_WHATSAPP}
                </a>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Map / Location visual ── */}
      <section className="px-5 pb-16">
        <div className="max-w-6xl mx-auto">
          <div className="relative overflow-hidden rounded-3xl h-64 flex items-center justify-center border border-white/8 bg-white/[0.02]">
            {/* Grid lines */}
            <div className="absolute inset-0 opacity-[0.06]"
              style={{
                backgroundImage: 'linear-gradient(rgba(99,102,241,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.8) 1px, transparent 1px)',
                backgroundSize: '40px 40px',
              }}
            />
            {/* Side fades */}
            <div className="absolute inset-0 bg-linear-to-r from-gray-950 via-transparent to-gray-950" />
            <div className="absolute inset-0 bg-linear-to-b from-gray-950/60 via-transparent to-gray-950/60" />
            {/* Center glow */}
            <div className="absolute inset-0"
              style={{ background: 'radial-gradient(ellipse at center, rgba(239,68,68,0.08) 0%, transparent 60%)' }} />
            <div className="relative text-center px-6">
              <div className="w-14 h-14 bg-red-500/15 border border-red-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <MapPin size={26} className="text-red-400" />
              </div>
              <p className="text-white font-bold text-xl">Kapurwali, Sialkot</p>
              <p className="text-gray-400 text-sm mt-1">Punjab, Pakistan</p>
              <a
                href="https://maps.google.com/?q=Kapurwali,Sialkot,Punjab,Pakistan"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 bg-white/8 hover:bg-white/12 border border-white/10 hover:border-white/20 rounded-xl text-white text-sm font-semibold transition"
              >
                <Navigation size={14} />
                Open in Google Maps
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-20 px-5 border-t border-white/5" style={{ background: 'rgba(255,255,255,0.015)' }}>
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-3">FAQ</p>
            <h2 className="text-3xl font-extrabold text-white tracking-tight">Common questions</h2>
            <p className="text-gray-400 text-sm mt-2">Everything you need to know about Assaan Electronics.</p>
          </div>
          <div className="space-y-3">
            {faqs.map((f) => <FaqItem key={f.q} q={f.q} a={f.a} />)}
          </div>
          <div className="mt-10 text-center">
            <p className="text-sm text-gray-500">
              Still have questions?{' '}
              <a
                href={`https://wa.me/${PLATFORM_WHATSAPP}?text=${encodeURIComponent('Hello, I have a question about Assaan Electronics.')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#25D366] font-semibold hover:underline"
              >
                Ask us on WhatsApp
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative overflow-hidden py-24 px-5 border-t border-white/5">
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'radial-gradient(circle, #6366f1 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(ellipse, rgba(37,99,235,0.20) 0%, rgba(124,58,237,0.08) 50%, transparent 70%)' }} />
        <div className="relative max-w-xl mx-auto text-center">
          <div className="w-14 h-14 bg-blue-600/15 border border-blue-500/25 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Building2 size={26} className="text-blue-400" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4 tracking-tight">
            Ready to modernize your shop?
          </h2>
          <p className="text-gray-400 text-sm mb-10 leading-relaxed max-w-md mx-auto">
            Join hundreds of Pakistani electronics shops already managing their installments smarter.
            14-day free trial. No credit card. Set up in 2 minutes.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link to="/register"
              className="group relative inline-flex items-center gap-2 px-7 py-3.5 text-sm font-bold text-white rounded-xl overflow-hidden shadow-lg shadow-blue-950/50 transition-transform hover:scale-[1.02]">
              <span className="absolute inset-0 bg-linear-to-r from-blue-600 to-blue-500" />
              <span className="absolute inset-0 bg-linear-to-r from-blue-500 to-violet-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="relative flex items-center gap-2">
                Create your free account <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </span>
            </Link>
            <a
              href={`https://wa.me/${PLATFORM_WHATSAPP}?text=${encodeURIComponent('Hello, I want to buy Assaan Electronics for my shop.')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-7 py-3.5 bg-[#25D366] hover:bg-[#20bd5a] text-white text-sm font-bold rounded-xl transition shadow-lg shadow-green-900/25"
            >
              <WhatsAppIcon size={15} />
              Buy via WhatsApp
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-gray-950 border-t border-white/5 py-8 px-5">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <CreditCard size={13} className="text-white" />
            </div>
            <span className="font-bold text-white text-sm">Assaan Electronics</span>
          </div>
          <p className="text-gray-500 text-xs">© {new Date().getFullYear()} Assaan Electronics. All rights reserved.</p>
          <div className="flex gap-5">
            <Link to="/login"    className="text-xs text-gray-500 hover:text-white transition">Sign in</Link>
            <Link to="/register" className="text-xs text-gray-500 hover:text-white transition">Register</Link>
            <Link to="/contact"  className="text-xs text-gray-500 hover:text-white transition">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
