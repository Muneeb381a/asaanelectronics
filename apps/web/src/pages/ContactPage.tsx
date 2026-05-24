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
    a: 'Absolutely. CNIC data is hashed using SHA-256 before storage and is never stored in plain text. Every shop\'s data is completely isolated — no other shop can see your records.',
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
    <div className={`border rounded-2xl transition-all ${open ? 'border-blue-200 bg-blue-50/40' : 'border-gray-100 bg-white hover:border-gray-200'}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left"
      >
        <span className={`text-sm font-semibold ${open ? 'text-blue-700' : 'text-gray-800'}`}>{q}</span>
        {open
          ? <ChevronUp size={16} className="text-blue-500 shrink-0" />
          : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
      </button>
      {open && (
        <div className="px-6 pb-5">
          <p className="text-sm text-gray-500 leading-relaxed">{a}</p>
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
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <CheckCircle size={30} className="text-green-500" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">Message sent!</h3>
        <p className="text-sm text-gray-500 max-w-xs leading-relaxed">
          Your inquiry was forwarded to WhatsApp. We'll reply within minutes during business hours.
        </p>
        <button
          onClick={() => { setSent(false); setForm({ name: '', phone: '', subject: '', message: '' }); }}
          className="mt-6 text-sm text-blue-600 hover:underline font-medium"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Your name <span className="text-red-400">*</span></label>
          <input
            type="text"
            placeholder="Ahmed Raza"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition placeholder:text-gray-300"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Phone number</label>
          <input
            type="tel"
            placeholder="03XX-XXXXXXX"
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
            className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition placeholder:text-gray-300"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Subject</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {SUBJECTS.map((s) => (
            <button
              key={s}
              onClick={() => set('subject', s)}
              className={`px-3 py-2 rounded-xl text-xs font-medium border transition text-left ${
                form.subject === s
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Message <span className="text-red-400">*</span></label>
        <textarea
          rows={5}
          placeholder="Tell us what you need — pricing, features, setup help, or anything else…"
          value={form.message}
          onChange={(e) => set('message', e.target.value)}
          className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition placeholder:text-gray-300 resize-none"
        />
        <p className="text-xs text-gray-400 mt-1">{form.message.length} / 500 characters</p>
      </div>

      <button
        onClick={handleSend}
        disabled={!isValid}
        className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#25D366] hover:bg-[#20bd5a] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition shadow-md shadow-green-200"
      >
        <WhatsAppIcon size={18} />
        Send via WhatsApp
        <Send size={14} />
      </button>

      <p className="text-center text-xs text-gray-400">
        Your message will open WhatsApp with all details pre-filled.
      </p>
    </div>
  );
}

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 antialiased">

      {/* Navbar */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <CreditCard size={15} className="text-white" />
            </div>
            <span className="font-bold text-gray-900 text-sm">Assaan Electronics</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            <Link to="/#features" className="text-sm text-gray-500 hover:text-gray-900 transition">Features</Link>
            <Link to="/#pricing"  className="text-sm text-gray-500 hover:text-gray-900 transition">Pricing</Link>
            <Link to="/contact"   className="text-sm text-gray-900 font-semibold">Contact</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login"
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition">
              Sign in
            </Link>
            <Link to="/register"
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-sm">
              Get started free
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gray-950 text-white py-20 px-5">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-175 h-75 bg-blue-600/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-100 h-50 bg-green-500/10 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 border border-white/10 rounded-full text-xs font-semibold mb-6 text-gray-300">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Typically reply within minutes on WhatsApp
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4 leading-tight">
            We&apos;re here to help you <br className="hidden sm:block" />
            <span className="text-blue-400">grow your business</span>
          </h1>
          <p className="text-gray-400 text-base sm:text-lg leading-relaxed max-w-xl mx-auto">
            Questions about pricing, setup, or features? Drop us a message — our team is based in
            Kapurwali, Sialkot and ready to assist.
          </p>

          {/* Quick contact strip */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <a
              href={`https://wa.me/${PLATFORM_WHATSAPP}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#25D366] hover:bg-[#20bd5a] rounded-xl text-sm font-bold transition shadow-lg shadow-green-900/30"
            >
              <WhatsAppIcon size={16} />
              Chat on WhatsApp
            </a>
            <a
              href={`mailto:${PLATFORM_EMAIL}`}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-sm font-semibold transition"
            >
              <Mail size={15} />
              Send an email
            </a>
          </div>
        </div>
      </section>

      {/* Main grid: Form + Sidebar */}
      <section className="py-20 px-5">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-10">

          {/* Contact form — takes 3 cols */}
          <div className="lg:col-span-3">
            <div className="bg-white border border-gray-100 rounded-3xl shadow-sm p-8 sm:p-10">
              <div className="mb-8">
                <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-2">Send a message</p>
                <h2 className="text-2xl font-extrabold text-gray-900">Tell us how we can help</h2>
                <p className="text-sm text-gray-400 mt-1.5">
                  Fill out the form and your message will open pre-filled in WhatsApp.
                </p>
              </div>
              <ContactForm />
            </div>
          </div>

          {/* Sidebar info — takes 2 cols */}
          <div className="lg:col-span-2 flex flex-col gap-5">

            {/* WhatsApp */}
            <a
              href={`https://wa.me/${PLATFORM_WHATSAPP}?text=${encodeURIComponent('Hello, I want to know more about Assaan Electronics.')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-4 bg-[#25D366] rounded-2xl p-6 text-white hover:bg-[#20bd5a] transition shadow-lg shadow-green-200"
            >
              <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                <WhatsAppIcon size={22} />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-sm">WhatsApp (Fastest)</p>
                <p className="text-green-100 text-xs mt-0.5 leading-relaxed">
                  Get a reply in minutes during business hours. Preferred contact method.
                </p>
                <div className="flex items-center gap-1 mt-2 text-xs font-semibold">
                  Chat now <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </a>

            {/* Email */}
            <a
              href={`mailto:${PLATFORM_EMAIL}`}
              className="group flex items-start gap-4 bg-white border border-gray-100 rounded-2xl p-6 hover:border-gray-200 hover:shadow-md transition"
            >
              <div className="w-11 h-11 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                <Mail size={20} className="text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-sm text-gray-900">Email</p>
                <p className="text-blue-600 text-xs font-medium mt-0.5">{PLATFORM_EMAIL}</p>
                <p className="text-gray-400 text-xs mt-1">Response within 24 hours</p>
              </div>
            </a>

            {/* Hours */}
            <div className="flex items-start gap-4 bg-amber-50 border border-amber-100 rounded-2xl p-6">
              <div className="w-11 h-11 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                <Clock size={20} className="text-amber-600" />
              </div>
              <div>
                <p className="font-bold text-sm text-gray-900">Business Hours</p>
                <p className="text-gray-600 text-xs mt-0.5">Monday – Saturday</p>
                <p className="text-amber-700 text-xs font-semibold mt-0.5">9:00 AM – 9:00 PM (PKT)</p>
                <p className="text-gray-400 text-xs mt-1">Sunday: Closed</p>
              </div>
            </div>

            {/* Location */}
            <div className="flex items-start gap-4 bg-white border border-gray-100 rounded-2xl p-6 hover:shadow-md transition">
              <div className="w-11 h-11 bg-red-50 rounded-xl flex items-center justify-center shrink-0">
                <MapPin size={20} className="text-red-500" />
              </div>
              <div>
                <p className="font-bold text-sm text-gray-900">Our Location</p>
                <p className="text-gray-700 text-xs font-medium mt-0.5">Kapurwali</p>
                <p className="text-gray-500 text-xs">Sialkot, Punjab</p>
                <p className="text-gray-500 text-xs">Pakistan</p>
                <a
                  href="https://maps.google.com/?q=Kapurwali,Sialkot,Punjab,Pakistan"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-2 text-xs text-blue-600 hover:underline font-medium"
                >
                  <Navigation size={11} />
                  View on map
                </a>
              </div>
            </div>

            {/* Phone */}
            <div className="flex items-start gap-4 bg-white border border-gray-100 rounded-2xl p-6">
              <div className="w-11 h-11 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0">
                <Phone size={20} className="text-indigo-600" />
              </div>
              <div>
                <p className="font-bold text-sm text-gray-900">Phone</p>
                <p className="text-gray-500 text-xs mt-0.5">WhatsApp preferred for fastest response.</p>
                <a
                  href={`https://wa.me/${PLATFORM_WHATSAPP}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-1.5 text-xs text-green-600 font-semibold hover:underline"
                >
                  <WhatsAppIcon size={12} />
                  +{PLATFORM_WHATSAPP}
                </a>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Map / Location visual */}
      <section className="px-5 pb-10">
        <div className="max-w-6xl mx-auto">
          <div className="relative overflow-hidden rounded-3xl bg-gray-950 h-64 flex items-center justify-center border border-gray-800">
            {/* Decorative grid */}
            <div className="absolute inset-0 opacity-10"
              style={{
                backgroundImage: 'linear-gradient(#3b82f6 1px, transparent 1px), linear-gradient(90deg, #3b82f6 1px, transparent 1px)',
                backgroundSize: '40px 40px',
              }}
            />
            <div className="absolute inset-0 bg-linear-to-r from-gray-950 via-transparent to-gray-950" />
            <div className="relative text-center px-6">
              <div className="w-14 h-14 bg-red-500/20 border border-red-500/40 rounded-full flex items-center justify-center mx-auto mb-4">
                <MapPin size={26} className="text-red-400" />
              </div>
              <p className="text-white font-bold text-lg">Kapurwali, Sialkot</p>
              <p className="text-gray-400 text-sm mt-1">Punjab, Pakistan</p>
              <a
                href="https://maps.google.com/?q=Kapurwali,Sialkot,Punjab,Pakistan"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-4 px-5 py-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-white text-sm font-semibold transition"
              >
                <Navigation size={14} />
                Open in Google Maps
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-5 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-3">FAQ</p>
            <h2 className="text-3xl font-extrabold text-gray-900">Common questions</h2>
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
                className="text-green-600 font-semibold hover:underline"
              >
                Ask us on WhatsApp
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-5 bg-gray-950 text-white text-center">
        <div className="max-w-xl mx-auto">
          <div className="w-14 h-14 bg-blue-600/20 border border-blue-500/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Building2 size={26} className="text-blue-400" />
          </div>
          <h2 className="text-3xl font-extrabold mb-3 tracking-tight">Ready to modernize your shop?</h2>
          <p className="text-gray-400 text-sm mb-8 leading-relaxed">
            Join hundreds of Pakistani electronics shops already managing their installments smarter.
            14-day free trial. No credit card. Set up in 2 minutes.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link to="/register"
              className="inline-flex items-center gap-2 px-7 py-3.5 bg-white hover:bg-gray-100 text-gray-900 text-sm font-bold rounded-xl transition shadow-lg">
              Create your free account <ArrowRight size={16} />
            </Link>
            <a
              href={`https://wa.me/${PLATFORM_WHATSAPP}?text=${encodeURIComponent('Hello, I want to buy Assaan Electronics for my shop.')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-7 py-3.5 bg-[#25D366] hover:bg-[#20bd5a] text-white text-sm font-bold rounded-xl transition"
            >
              <WhatsAppIcon size={16} />
              Buy via WhatsApp
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-950 border-t border-gray-800 py-8 px-5">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
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
