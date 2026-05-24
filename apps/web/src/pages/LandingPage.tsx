import { Link } from 'react-router-dom';
import {
  CreditCard, Users, Package, BarChart3, Shield, Smartphone,
  Check, ArrowRight, Star, Zap, TrendingUp, Clock,
} from 'lucide-react';

const PLATFORM_WHATSAPP = '923001234567';

function WhatsAppFAB() {
  return (
    <a
      href={`https://wa.me/${PLATFORM_WHATSAPP}?text=${encodeURIComponent('Hello, I want to know more about Assaan Electronics.')}`}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-[#25D366] hover:bg-[#20bd5a] rounded-full flex items-center justify-center shadow-lg shadow-green-300/50 transition-transform hover:scale-110"
      title="Chat on WhatsApp"
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="white">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    </a>
  );
}

const features = [
  {
    icon: CreditCard,
    title: 'Installment Plans',
    desc: 'Create flexible installment schedules with automatic remaining balance tracking and instant status updates when fully paid.',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-100',
  },
  {
    icon: Users,
    title: 'Customer Management',
    desc: 'Maintain detailed customer profiles with CNIC verification, guarantor records, address, and complete payment history.',
    color: 'text-violet-600',
    bg: 'bg-violet-50',
    border: 'border-violet-100',
  },
  {
    icon: Package,
    title: 'Product Catalog',
    desc: 'Manage your electronics inventory with pricing, live stock levels, serial numbers, and quick search.',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-100',
  },
  {
    icon: BarChart3,
    title: 'Real-Time Dashboard',
    desc: "Today's collections, monthly revenue, active plans, and overdue alerts — all visible at a glance the moment you log in.",
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    border: 'border-orange-100',
  },
  {
    icon: Shield,
    title: 'Secure by Design',
    desc: 'OTP-verified logins for every shop owner. CNIC data hashed before storage. All records scoped to your shop only.',
    color: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-100',
  },
  {
    icon: Smartphone,
    title: 'Works on Any Device',
    desc: 'Fully responsive interface — run it on your phone at the counter, a tablet in the back office, or a desktop at home.',
    color: 'text-indigo-600',
    bg: 'bg-indigo-50',
    border: 'border-indigo-100',
  },
];

const plans = [
  {
    name: 'Trial',
    price: 'Free',
    period: '14 days',
    desc: 'Full access, no credit card required.',
    features: ['Up to 50 installments', 'Customer & product management', 'Payment recording', 'Live dashboard'],
    cta: 'Start free trial',
    href: '/register',
    highlight: false,
  },
  {
    name: 'Basic',
    price: 'PKR 1,500',
    period: '/month',
    desc: 'For shops running steady installment business.',
    features: ['Unlimited installments', 'Unlimited customers', 'OTP login security', 'Payment history', 'Email support'],
    cta: 'Get Basic',
    href: '/register',
    highlight: true,
    badge: 'Most Popular',
  },
  {
    name: 'Pro',
    price: 'PKR 3,500',
    period: '/month',
    desc: 'For growing shops with teams and multiple locations.',
    features: ['Everything in Basic', 'Multiple staff accounts', 'Overdue alerts', 'Advanced reports', 'Priority support'],
    cta: 'Get Pro',
    href: '/register',
    highlight: false,
  },
];

const testimonials = [
  {
    name: 'Ahmed Raza',
    role: 'Owner, City Electronics — Lahore',
    text: 'We used to track everything in notebooks. Now every payment, every customer, every balance is right here. It has completely changed how we operate.',
    stars: 5,
  },
  {
    name: 'Usman Tariq',
    role: 'Manager, Star Mobile — Karachi',
    text: 'Remembering monthly dues was a nightmare. The overdue alerts and live remaining balances mean we never miss a follow-up.',
    stars: 5,
  },
  {
    name: 'Bilal Khan',
    role: 'Owner, Metro Electronics — Islamabad',
    text: 'Customer CNIC data stays secure, payment history is crystal clear, and the dashboard tells me everything I need before I even ask.',
    stars: 5,
  },
];

const stats = [
  { value: '500+', label: 'Shops registered', icon: Package },
  { value: 'PKR 2Cr+', label: 'Payments tracked', icon: TrendingUp },
  { value: '99.9%', label: 'Uptime guaranteed', icon: Zap },
  { value: '< 2 min', label: 'Average setup time', icon: Clock },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 antialiased">

      {/* ── Navbar ── */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <CreditCard size={16} className="text-white" />
            </div>
            <span className="font-bold text-gray-900 text-base">Assaan Electronics</span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-gray-500 hover:text-gray-900 transition">Features</a>
            <a href="#pricing"  className="text-sm text-gray-500 hover:text-gray-900 transition">Pricing</a>
            <a href="#reviews"  className="text-sm text-gray-500 hover:text-gray-900 transition">Reviews</a>
            <Link to="/contact" className="text-sm text-gray-500 hover:text-gray-900 transition">Contact</Link>
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

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-white">
        {/* Background decoration */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-blue-50 rounded-full opacity-60 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-[400px] h-[400px] bg-violet-50 rounded-full opacity-50 blur-3xl" />
        </div>

        <div className="relative max-w-6xl mx-auto px-5 pt-20 pb-28 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-semibold mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            Built for Pakistani electronics shops
          </div>

          <h1 className="text-5xl sm:text-6xl font-extrabold text-gray-900 leading-[1.1] tracking-tight mb-6">
            The smarter way to run<br />
            <span className="text-blue-600">installment sales</span>
          </h1>

          <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            Track customers, products, and monthly payments in one place.
            Stop losing money to missed dues and paper registers.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-16">
            <Link to="/register"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-lg shadow-blue-200">
              Start free — no credit card <ArrowRight size={16} />
            </Link>
            <Link to="/login"
              className="inline-flex items-center justify-center px-7 py-3.5 text-sm font-semibold text-gray-700 bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 rounded-xl transition">
              Sign in to your account
            </Link>
          </div>

          {/* Dashboard mockup */}
          <div className="relative max-w-4xl mx-auto">
            <div className="absolute inset-x-0 bottom-0 h-32 bg-linear-to-t from-white to-transparent z-10 pointer-events-none rounded-b-2xl" />
            <div className="bg-gray-950 rounded-2xl shadow-2xl overflow-hidden border border-gray-800">
              {/* Window bar */}
              <div className="flex items-center gap-2 px-4 py-3 bg-gray-900 border-b border-gray-800">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <div className="flex-1 mx-4">
                  <div className="bg-gray-800 rounded-md px-3 py-1 text-xs text-gray-400 max-w-xs mx-auto text-center">
                    app.assaan-electronics.com/dashboard
                  </div>
                </div>
              </div>
              {/* App content */}
              <div className="flex bg-gray-50">
                {/* Sidebar */}
                <div className="w-44 bg-white border-r border-gray-100 p-3 hidden sm:block">
                  <div className="mb-4 px-2">
                    <p className="text-xs font-bold text-gray-900">Assaan Electronics</p>
                    <p className="text-[10px] text-gray-400">Installment Manager</p>
                  </div>
                  {['Dashboard', 'Products', 'Customers', 'Installments'].map((item, i) => (
                    <div key={item} className={`flex items-center gap-2 px-2.5 py-2 rounded-lg mb-0.5 text-xs ${
                      i === 0 ? 'bg-blue-600 text-white font-medium' : 'text-gray-500'
                    }`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${i === 0 ? 'bg-blue-200' : 'bg-gray-300'}`} />
                      {item}
                    </div>
                  ))}
                </div>
                {/* Main content */}
                <div className="flex-1 p-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    {[
                      { label: "Today's Collections", val: 'PKR 45,000', color: 'text-blue-600' },
                      { label: 'This Month',          val: 'PKR 3,20,000', color: 'text-violet-600' },
                      { label: 'Active',              val: '84 plans', color: 'text-emerald-600' },
                      { label: 'Overdue',             val: '3 plans', color: 'text-red-500' },
                    ].map((s) => (
                      <div key={s.label} className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                        <p className="text-[10px] text-gray-400 mb-0.5">{s.label}</p>
                        <p className={`text-sm font-bold ${s.color}`}>{s.val}</p>
                      </div>
                    ))}
                  </div>
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-3 py-2 border-b border-gray-50">
                      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Recent Installments</p>
                    </div>
                    {[
                      { name: 'Ali Hassan',  product: 'Samsung 55" TV',  rem: 'PKR 24,000', status: 'Active',    dot: 'bg-green-500' },
                      { name: 'Sara Malik',  product: 'LG Refrigerator', rem: 'PKR 0',      status: 'Completed', dot: 'bg-blue-500' },
                      { name: 'Usman Ahmed', product: 'iPhone 15',       rem: 'PKR 61,000', status: 'Active',    dot: 'bg-green-500' },
                    ].map((r) => (
                      <div key={r.name} className="flex items-center justify-between px-3 py-2 border-b border-gray-50 last:border-0">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[9px] font-bold text-gray-600">
                            {r.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-xs font-medium text-gray-800">{r.name}</p>
                            <p className="text-[10px] text-gray-400">{r.product}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-gray-700">{r.rem}</span>
                          <span className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                            r.status === 'Completed' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'
                          }`}>
                            <span className={`w-1 h-1 rounded-full ${r.dot}`} />{r.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="border-y border-gray-100 bg-gray-50">
        <div className="max-w-5xl mx-auto px-5 py-12 grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-3xl font-extrabold text-gray-900">{s.value}</p>
              <p className="text-sm text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-5">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold text-blue-600 uppercase tracking-widest mb-3">Features</p>
            <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight">Everything you need</h2>
            <p className="text-lg text-gray-500 mt-3 max-w-xl mx-auto">
              One platform to replace your notebooks, spreadsheets, and scattered receipts.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => (
              <div key={f.title}
                className={`rounded-2xl border ${f.border} bg-white p-6 hover:shadow-lg transition-all duration-200 group`}>
                <div className={`w-12 h-12 ${f.bg} rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}>
                  <f.icon size={22} className={f.color} />
                </div>
                <h3 className="font-bold text-gray-900 mb-2 text-base">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bento highlight ── */}
      <section className="py-8 pb-24 bg-white">
        <div className="max-w-6xl mx-auto px-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Security card */}
            <div className="bg-gray-950 rounded-2xl p-8 text-white flex flex-col justify-between min-h-64">
              <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center mb-6">
                <Shield size={22} className="text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-2">Security you can trust</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Every shop owner login requires a one-time code sent to their email.
                  CNIC data is hashed — the raw number is never stored.
                  Your data stays completely separate from every other shop.
                </p>
              </div>
            </div>
            {/* Speed card */}
            <div className="bg-blue-600 rounded-2xl p-8 text-white flex flex-col justify-between min-h-64">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-6">
                <Zap size={22} className="text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-2">Ready in under 2 minutes</h3>
                <p className="text-blue-100 text-sm leading-relaxed">
                  Create your account, set up your shop, add your first product and customer —
                  all before your next customer walks in. No training needed.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="py-24 bg-gray-50">
        <div className="max-w-5xl mx-auto px-5">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold text-blue-600 uppercase tracking-widest mb-3">Pricing</p>
            <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight">Simple, honest pricing</h2>
            <p className="text-lg text-gray-500 mt-3">Start free for 14 days. No credit card required.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 items-start">
            {plans.map((plan) => (
              <div key={plan.name}
                className={`rounded-2xl p-7 flex flex-col relative ${
                  plan.highlight
                    ? 'bg-gray-950 text-white shadow-2xl ring-1 ring-gray-800'
                    : 'bg-white border border-gray-200 shadow-sm'
                }`}>
                {plan.badge && (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-4 py-1 rounded-full">
                    {plan.badge}
                  </span>
                )}
                <div className="mb-6">
                  <p className={`text-xs font-bold uppercase tracking-widest mb-3 ${plan.highlight ? 'text-gray-400' : 'text-gray-400'}`}>
                    {plan.name}
                  </p>
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className={`text-4xl font-extrabold ${plan.highlight ? 'text-white' : 'text-gray-900'}`}>
                      {plan.price}
                    </span>
                    <span className={`text-sm ${plan.highlight ? 'text-gray-400' : 'text-gray-400'}`}>{plan.period}</span>
                  </div>
                  <p className={`text-sm ${plan.highlight ? 'text-gray-400' : 'text-gray-500'}`}>{plan.desc}</p>
                </div>

                <ul className="space-y-3 flex-1 mb-8">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5 text-sm">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                        plan.highlight ? 'bg-blue-600' : 'bg-blue-50'
                      }`}>
                        <Check size={11} className={plan.highlight ? 'text-white' : 'text-blue-600'} />
                      </div>
                      <span className={plan.highlight ? 'text-gray-300' : 'text-gray-600'}>{feat}</span>
                    </li>
                  ))}
                </ul>

                <Link to={plan.href}
                  className={`w-full py-3 rounded-xl text-sm font-bold text-center transition ${
                    plan.highlight
                      ? 'bg-blue-600 text-white hover:bg-blue-500'
                      : 'bg-gray-900 text-white hover:bg-gray-800'
                  }`}>
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section id="reviews" className="py-24 bg-white">
        <div className="max-w-5xl mx-auto px-5">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold text-blue-600 uppercase tracking-widest mb-3">Reviews</p>
            <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight">Trusted by shop owners</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {testimonials.map((t) => (
              <div key={t.name} className="bg-gray-50 border border-gray-100 rounded-2xl p-6 hover:shadow-md transition-shadow">
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: t.stars }).map((_, i) => (
                    <Star key={i} size={14} className="text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-sm text-gray-700 leading-relaxed mb-5">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                    <p className="text-xs text-gray-400">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-24 bg-gray-950 text-white text-center px-5">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-4xl font-extrabold mb-4 tracking-tight">
            Ready to modernize your shop?
          </h2>
          <p className="text-gray-400 text-lg mb-10 leading-relaxed">
            Join hundreds of electronics shops already managing installments digitally.
            Start free — no credit card, no commitment.
          </p>
          <Link to="/register"
            className="inline-flex items-center gap-2 px-8 py-4 text-sm font-bold text-gray-900 bg-white hover:bg-gray-100 rounded-xl transition shadow-lg">
            Create your free account <ArrowRight size={16} />
          </Link>
          <p className="text-gray-600 text-xs mt-5">14-day free trial · No credit card required · Cancel anytime</p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-gray-950 border-t border-gray-800 py-10 px-5">
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
            <a href="#pricing"   className="text-xs text-gray-500 hover:text-white transition">Pricing</a>
          </div>
        </div>
      </footer>

      <WhatsAppFAB />
    </div>
  );
}
