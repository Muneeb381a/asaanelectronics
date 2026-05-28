import { Link } from 'react-router-dom';
import {
  CreditCard, Users, Package, BarChart3, Shield, Smartphone,
  Check, ArrowRight, Star, Zap, TrendingUp, Clock, PhoneCall,
  Receipt, Banknote, AlertTriangle, FileText, UserCheck, BookOpen,
  ChevronRight, Wallet,
} from 'lucide-react';

const PLATFORM_WHATSAPP = '923001234567';

function WhatsAppFAB() {
  return (
    <a
      href={`https://wa.me/${PLATFORM_WHATSAPP}?text=${encodeURIComponent('Hello, I want to know more about Assaan Electronics.')}`}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-[#25D366] hover:bg-[#20bd5a] rounded-full flex items-center justify-center shadow-lg shadow-green-400/40 transition-all hover:scale-110"
      title="Chat on WhatsApp"
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="white">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    </a>
  );
}

const stats = [
  { value: '500+',     label: 'Shops registered',    icon: Package },
  { value: 'PKR 2Cr+', label: 'Payments tracked',   icon: TrendingUp },
  { value: '99.9%',    label: 'Uptime guaranteed',   icon: Zap },
  { value: '< 2 min',  label: 'Average setup time',  icon: Clock },
];

const steps = [
  {
    number: '01',
    icon: UserCheck,
    title: 'Customer Register Karo',
    desc: 'CNIC upload karo — naam, date of birth, address automatically fill ho jaata hai. Guarantor ka record bhi saath add karo. Ek baar add kiya, hamesha available.',
    color: 'blue',
    tags: ['CNIC Scan', 'Auto-fill', 'Guarantor Record'],
  },
  {
    number: '02',
    icon: Package,
    title: 'Product & Plan Banao',
    desc: 'Apni inventory mein se product select karo, down payment set karo, aur monthly ya daily installment plan generate karo. Murabaha mode bhi available hai.',
    color: 'violet',
    tags: ['Monthly / Daily', 'Murabaha Mode', 'Auto Invoice'],
  },
  {
    number: '03',
    icon: Banknote,
    title: 'Payment Record Karo',
    desc: 'Har payment ka record rakho — cash, bank, JazzCash, Easypaisa. Remaining balance khud update hota hai. Receipt print karo ya WhatsApp par bhejo.',
    color: 'emerald',
    tags: ['All Methods', 'Auto Balance', 'Instant Bill'],
  },
  {
    number: '04',
    icon: BarChart3,
    title: 'Reports & Recovery',
    desc: "Aaj ki collections, overdue customers, agent performance — sab ek jagah. Overdue customers ko bulk WhatsApp reminder bhejo. Poora hisaab saaf.",
    color: 'orange',
    tags: ['Live Dashboard', 'Agent Tracking', 'Bulk Reminders'],
  },
];

const colorMap: Record<string, { bg: string; text: string; border: string; light: string; num: string }> = {
  blue:    { bg: 'bg-blue-600',    text: 'text-blue-600',    border: 'border-blue-200',    light: 'bg-blue-50',    num: 'text-blue-300' },
  violet:  { bg: 'bg-violet-600',  text: 'text-violet-600',  border: 'border-violet-200',  light: 'bg-violet-50',  num: 'text-violet-300' },
  emerald: { bg: 'bg-emerald-600', text: 'text-emerald-600', border: 'border-emerald-200', light: 'bg-emerald-50', num: 'text-emerald-300' },
  orange:  { bg: 'bg-orange-500',  text: 'text-orange-600',  border: 'border-orange-200',  light: 'bg-orange-50',  num: 'text-orange-300' },
};

const features = [
  {
    icon: CreditCard,
    title: 'Installment Management',
    desc: 'Monthly aur daily plans. Automatic balance tracking, overdue alerts, reschedule option. Ek customer ki poori history ek jagah.',
    color: 'blue',
    points: ['Auto remaining balance', 'Reschedule any plan', 'Status timeline'],
  },
  {
    icon: Users,
    title: 'Customer Records',
    desc: 'CNIC se auto-fill, guarantor records, area tagging, complete payment history. Koi bhi customer dhundna seconds ka kaam.',
    color: 'violet',
    points: ['CNIC verification', 'Guarantor tracking', 'Full pay history'],
  },
  {
    icon: PhoneCall,
    title: 'Recovery & Agents',
    desc: 'Recovery agents assign karo, unki collections track karo. Har agent ka monthly performance dekho — kaun kitna recover karta hai.',
    color: 'emerald',
    points: ['Agent performance', 'Collection attribution', 'Proof image upload'],
  },
  {
    icon: BookOpen,
    title: 'Accounting & Ledger',
    desc: 'Expenses record karo, income track karo, complete ledger dekho. Cash book, P&L, aur reconciliation — sab built-in.',
    color: 'orange',
    points: ['Full ledger', 'Expense tracking', 'P&L overview'],
  },
  {
    icon: Shield,
    title: 'Security & Staff',
    desc: 'Har staff member ko alag permissions do. Owner ka OTP login. CNIC data hashed. Aapka data sirf aapka.',
    color: 'red',
    points: ['Role-based access', 'OTP login', 'Audit log'],
  },
  {
    icon: Smartphone,
    title: 'Works Everywhere',
    desc: 'Mobile, tablet, ya desktop — poori app responsive hai. Counter par bhi, ghar par bhi. Internet chale to kaam chale.',
    color: 'indigo',
    points: ['Mobile-first', 'Any browser', 'Fast loading'],
  },
];

const fColorMap: Record<string, { bg: string; text: string; border: string }> = {
  blue:    { bg: 'bg-blue-50',    text: 'text-blue-600',    border: 'border-blue-100' },
  violet:  { bg: 'bg-violet-50',  text: 'text-violet-600',  border: 'border-violet-100' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100' },
  orange:  { bg: 'bg-orange-50',  text: 'text-orange-600',  border: 'border-orange-100' },
  red:     { bg: 'bg-red-50',     text: 'text-red-600',     border: 'border-red-100' },
  indigo:  { bg: 'bg-indigo-50',  text: 'text-indigo-600',  border: 'border-indigo-100' },
};

const problems = [
  {
    icon: FileText,
    title: 'Register aur notebooks',
    desc: 'Alag alag notebooks mein likhna, phir dhundna, phir bhool jaana — yeh sab band.',
  },
  {
    icon: AlertTriangle,
    title: 'Missed payments',
    desc: 'Kisko kitna dena hai, kab dena tha — yeh manually yaad karna impossible hai. System khud remind karta hai.',
  },
  {
    icon: Wallet,
    title: 'Hisaab ka confusion',
    desc: 'Aaj kitna aaya, mahine mein kitna? Cash kahan gaya? Ab sab kuch ek jagah, real time.',
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
    role: 'Owner, City Electronics',
    city: 'Lahore',
    text: 'Pehle sab kuch notebooks mein tha. Ab har payment, har customer, har balance yahan hai. Bilkul zameen-aasmaan ka farq hai.',
    stars: 5,
    initials: 'AR',
  },
  {
    name: 'Usman Tariq',
    role: 'Manager, Star Mobile',
    city: 'Karachi',
    text: 'Overdue customers ko yaad rakhna nightmare tha. Ab system khud bata deta hai — aur bulk WhatsApp reminder bhi ek click mein.',
    stars: 5,
    initials: 'UT',
  },
  {
    name: 'Bilal Khan',
    role: 'Owner, Metro Electronics',
    city: 'Islamabad',
    text: 'CNIC data safe hai, payment history crystal clear hai, aur dashboard roz subah sara hisaab bata deta hai bina kuch poochhe.',
    stars: 5,
    initials: 'BK',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 antialiased">

      {/* ── Navbar ── */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm">
              <CreditCard size={15} className="text-white" />
            </div>
            <span className="font-bold text-gray-900">Assaan Electronics</span>
          </div>
          <nav className="hidden md:flex items-center gap-7">
            <a href="#how-it-works" className="text-sm text-gray-500 hover:text-gray-900 transition">How it works</a>
            <a href="#features"     className="text-sm text-gray-500 hover:text-gray-900 transition">Features</a>
            <a href="#pricing"      className="text-sm text-gray-500 hover:text-gray-900 transition">Pricing</a>
            <a href="#reviews"      className="text-sm text-gray-500 hover:text-gray-900 transition">Reviews</a>
            <Link to="/contact"     className="text-sm text-gray-500 hover:text-gray-900 transition">Contact</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login"
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition">
              Sign in
            </Link>
            <Link to="/register"
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-sm shadow-blue-200">
              Get started free
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-linear-to-br from-blue-50 via-white to-violet-50" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-blue-100/40 rounded-full blur-3xl" />
          {/* Dot grid */}
          <div className="absolute inset-0 opacity-[0.035]"
            style={{ backgroundImage: 'radial-gradient(circle, #1d4ed8 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        </div>

        <div className="relative max-w-6xl mx-auto px-5 pt-16 pb-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold mb-6 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                Pakistani electronics shops ke liye
              </div>

              <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 leading-[1.1] tracking-tight mb-5">
                Installment business<br />
                <span className="text-blue-600">asaan kar do</span>
              </h1>

              <p className="text-lg text-gray-500 leading-relaxed mb-4">
                Notebook aur spreadsheet band karo. Customers, products, payments — sab ek jagah.
                Overdue yaad dilaye, agents track kare, hisaab saaf rakhe.
              </p>

              <div className="flex flex-wrap gap-2 mb-8">
                {['Free 14-day trial', 'No credit card', 'Setup in 2 min'].map((t) => (
                  <span key={t} className="inline-flex items-center gap-1.5 text-xs text-gray-500 bg-white border border-gray-200 rounded-full px-3 py-1 shadow-sm">
                    <Check size={11} className="text-green-500" /> {t}
                  </span>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link to="/register"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-lg shadow-blue-200">
                  Start karo — bilkul free <ArrowRight size={15} />
                </Link>
                <Link to="/login"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-semibold text-gray-700 bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 rounded-xl transition shadow-sm">
                  Sign in <ChevronRight size={14} />
                </Link>
              </div>

              {/* Mini stats */}
              <div className="flex gap-6 mt-8 pt-6 border-t border-gray-100">
                {[['500+', 'Shops'], ['PKR 2Cr+', 'Tracked'], ['99.9%', 'Uptime']].map(([v, l]) => (
                  <div key={l}>
                    <p className="font-extrabold text-gray-900 text-lg leading-none">{v}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{l}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — Dashboard mockup */}
            <div className="relative lg:block">
              <div className="absolute -inset-4 bg-linear-to-br from-blue-100/50 to-violet-100/50 rounded-3xl blur-2xl" />
              <div className="relative bg-gray-950 rounded-2xl shadow-2xl overflow-hidden border border-gray-800">
                {/* Window bar */}
                <div className="flex items-center gap-2 px-4 py-3 bg-gray-900 border-b border-gray-800">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                  <div className="flex-1 mx-3">
                    <div className="bg-gray-800 rounded px-3 py-0.5 text-[10px] text-gray-400 max-w-[220px] mx-auto text-center">
                      app.assaan-electronics.com
                    </div>
                  </div>
                </div>
                {/* Content */}
                <div className="flex bg-gray-50">
                  {/* Sidebar */}
                  <div className="w-36 bg-white border-r border-gray-100 p-2.5 hidden sm:block shrink-0">
                    <div className="mb-3 px-1.5">
                      <p className="text-[9px] font-bold text-gray-800">Assaan Electronics</p>
                      <p className="text-[8px] text-gray-400">Installment Manager</p>
                    </div>
                    {[
                      { label: 'Dashboard', active: true },
                      { label: 'Customers', active: false },
                      { label: 'Installments', active: false },
                      { label: 'Recovery', active: false },
                      { label: 'Accounting', active: false },
                    ].map((item) => (
                      <div key={item.label} className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg mb-0.5 text-[9px] font-medium ${
                        item.active ? 'bg-blue-600 text-white' : 'text-gray-400'
                      }`}>
                        <div className={`w-1 h-1 rounded-full ${item.active ? 'bg-blue-200' : 'bg-gray-200'}`} />
                        {item.label}
                      </div>
                    ))}
                  </div>
                  {/* Main */}
                  <div className="flex-1 p-3 min-w-0">
                    {/* Stat cards */}
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {[
                        { label: "Today's Collections", val: 'PKR 45,000', color: 'text-blue-600', bg: 'bg-blue-50' },
                        { label: 'This Month',          val: 'PKR 3,20,000', color: 'text-violet-600', bg: 'bg-violet-50' },
                        { label: 'Active Plans',        val: '84 plans', color: 'text-emerald-600', bg: 'bg-emerald-50' },
                        { label: 'Overdue',             val: '3 alerts', color: 'text-red-500', bg: 'bg-red-50' },
                      ].map((s) => (
                        <div key={s.label} className="bg-white rounded-xl p-2.5 border border-gray-100 shadow-sm">
                          <p className="text-[8px] text-gray-400 mb-0.5">{s.label}</p>
                          <p className={`text-xs font-bold ${s.color}`}>{s.val}</p>
                        </div>
                      ))}
                    </div>
                    {/* Table */}
                    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                      <div className="px-2.5 py-1.5 border-b border-gray-50">
                        <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Recent Installments</p>
                      </div>
                      {[
                        { name: 'Ali Hassan',  product: 'Samsung 55" TV',  rem: 'PKR 24,000', status: 'Active',    dot: 'bg-green-500' },
                        { name: 'Sara Malik',  product: 'LG Refrigerator', rem: 'PKR 0',      status: 'Completed', dot: 'bg-blue-500' },
                        { name: 'Usman Ahmed', product: 'iPhone 15',       rem: 'PKR 61,000', status: 'Overdue',   dot: 'bg-red-500' },
                      ].map((r) => (
                        <div key={r.name} className="flex items-center justify-between px-2.5 py-2 border-b border-gray-50 last:border-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-[7px] font-bold text-blue-600 shrink-0">
                              {r.name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-[9px] font-semibold text-gray-800 truncate">{r.name}</p>
                              <p className="text-[8px] text-gray-400 truncate">{r.product}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[9px] font-semibold text-gray-700">{r.rem}</span>
                            <span className={`flex items-center gap-0.5 text-[8px] font-medium px-1 py-0.5 rounded-full ${
                              r.status === 'Completed' ? 'bg-blue-50 text-blue-600' :
                              r.status === 'Overdue'   ? 'bg-red-50 text-red-600' :
                                                         'bg-green-50 text-green-600'
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
        </div>
      </section>

      {/* ── Pain points ── */}
      <section className="py-14 bg-gray-950">
        <div className="max-w-5xl mx-auto px-5">
          <p className="text-center text-gray-400 text-sm font-medium mb-8">Yeh problems pehchante ho?</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {problems.map((p) => (
              <div key={p.title} className="flex gap-4 items-start bg-gray-900 rounded-2xl p-5 border border-gray-800">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                  <p.icon size={18} className="text-red-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white mb-1">{p.title}</p>
                  <p className="text-xs text-gray-400 leading-relaxed">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-center text-gray-500 text-xs mt-6">
            Assaan Electronics in sab problems permanently solve karta hai.
            <Link to="/register" className="text-blue-400 hover:text-blue-300 ml-1 underline underline-offset-2">Try karo — free hai →</Link>
          </p>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-5">
          <div className="text-center mb-16">
            <p className="text-sm font-bold text-blue-600 uppercase tracking-widest mb-3">Kaise kaam karta hai</p>
            <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight">4 simple steps</h2>
            <p className="text-gray-500 mt-3 max-w-lg mx-auto">
              Setup se lekar hisaab tak — har kaam ka ek saaf tareeqa.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {steps.map((step, idx) => {
              const c = colorMap[step.color];
              return (
                <div key={step.number} className="relative">
                  {/* Connector line on desktop */}
                  {idx < steps.length - 1 && (
                    <div className="hidden lg:block absolute top-10 left-[calc(100%-0px)] w-5 z-10">
                      <div className="w-full h-px bg-gray-200 mt-0.5" />
                      <ChevronRight size={12} className="text-gray-300 absolute -right-1.5 -top-2" />
                    </div>
                  )}
                  <div className={`rounded-2xl border ${c.border} bg-white p-6 h-full hover:shadow-lg transition-all duration-200 group`}>
                    {/* Step number */}
                    <div className="flex items-center justify-between mb-4">
                      <div className={`w-11 h-11 ${c.bg} rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform`}>
                        <step.icon size={20} className="text-white" />
                      </div>
                      <span className={`text-3xl font-black ${c.num} opacity-60`}>{step.number}</span>
                    </div>
                    <h3 className="font-bold text-gray-900 text-base mb-2">{step.title}</h3>
                    <p className="text-sm text-gray-500 leading-relaxed mb-4">{step.desc}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {step.tags.map((tag) => (
                        <span key={tag} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${c.light} ${c.text}`}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-24 bg-gray-50">
        <div className="max-w-6xl mx-auto px-5">
          <div className="text-center mb-14">
            <p className="text-sm font-bold text-blue-600 uppercase tracking-widest mb-3">Features</p>
            <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight">Sab kuch ek jagah</h2>
            <p className="text-lg text-gray-500 mt-3 max-w-xl mx-auto">
              Notebooks, spreadsheets, aur alag alag apps — sab ki zaroorat khatam.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => {
              const fc = fColorMap[f.color];
              return (
                <div key={f.title}
                  className={`rounded-2xl border ${fc.border} bg-white p-6 hover:shadow-lg transition-all duration-200 group`}>
                  <div className={`w-11 h-11 ${fc.bg} rounded-xl flex items-center justify-center mb-5 group-hover:scale-105 transition-transform`}>
                    <f.icon size={20} className={fc.text} />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-2">{f.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed mb-4">{f.desc}</p>
                  <ul className="space-y-1.5">
                    {f.points.map((pt) => (
                      <li key={pt} className="flex items-center gap-2 text-xs text-gray-600">
                        <div className={`w-4 h-4 rounded-full ${fc.bg} flex items-center justify-center shrink-0`}>
                          <Check size={9} className={fc.text} />
                        </div>
                        {pt}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Bento highlight ── */}
      <section className="py-8 pb-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Security */}
            <div className="bg-gray-950 rounded-2xl p-7 text-white flex flex-col justify-between min-h-56">
              <div className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center mb-5 border border-white/10">
                <Shield size={20} className="text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2">Security first</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  OTP login har owner ke liye. CNIC hashed — raw data store nahi hota.
                  Aapka data sirf aapka.
                </p>
              </div>
            </div>
            {/* Speed */}
            <div className="bg-blue-600 rounded-2xl p-7 text-white flex flex-col justify-between min-h-56">
              <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center mb-5 border border-white/20">
                <Zap size={20} className="text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2">2 minute setup</h3>
                <p className="text-blue-100 text-sm leading-relaxed">
                  Account banao, shop setup karo, pehla customer add karo —
                  sab kuch agli customer ke aane se pehle.
                </p>
              </div>
            </div>
            {/* Stats */}
            <div className="bg-violet-600 rounded-2xl p-7 text-white flex flex-col justify-between min-h-56">
              <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center mb-5 border border-white/20">
                <TrendingUp size={20} className="text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2">Real-time reports</h3>
                <p className="text-violet-100 text-sm leading-relaxed">
                  Roz ka collection, mahine ka revenue, agent performance — dashboard login karo aur sab saamne hai.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="py-16 bg-white border-y border-gray-100">
        <div className="max-w-5xl mx-auto px-5 grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((s) => (
            <div key={s.label} className="text-center group">
              <div className="w-11 h-11 bg-blue-50 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:bg-blue-100 transition">
                <s.icon size={19} className="text-blue-600" />
              </div>
              <p className="text-3xl font-extrabold text-gray-900">{s.value}</p>
              <p className="text-sm text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="py-24 bg-gray-50">
        <div className="max-w-5xl mx-auto px-5">
          <div className="text-center mb-14">
            <p className="text-sm font-bold text-blue-600 uppercase tracking-widest mb-3">Pricing</p>
            <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight">Seedha, honest pricing</h2>
            <p className="text-lg text-gray-500 mt-3">14 din free. Credit card ki zaroorat nahi.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 items-start">
            {plans.map((plan) => (
              <div key={plan.name}
                className={`rounded-2xl p-7 flex flex-col relative ${
                  plan.highlight
                    ? 'bg-gray-950 text-white shadow-2xl ring-1 ring-gray-800 scale-[1.02]'
                    : 'bg-white border border-gray-200 shadow-sm'
                }`}>
                {plan.badge && (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-4 py-1 rounded-full shadow-sm">
                    {plan.badge}
                  </span>
                )}
                <div className="mb-6">
                  <p className={`text-[10px] font-bold uppercase tracking-widest mb-3 ${plan.highlight ? 'text-gray-400' : 'text-gray-400'}`}>
                    {plan.name}
                  </p>
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className={`text-3xl font-extrabold ${plan.highlight ? 'text-white' : 'text-gray-900'}`}>
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
                        <Check size={10} className={plan.highlight ? 'text-white' : 'text-blue-600'} />
                      </div>
                      <span className={plan.highlight ? 'text-gray-300' : 'text-gray-600'}>{feat}</span>
                    </li>
                  ))}
                </ul>

                <Link to={plan.href}
                  className={`w-full py-3 rounded-xl text-sm font-bold text-center transition ${
                    plan.highlight
                      ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-900/30'
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
            <p className="text-sm font-bold text-blue-600 uppercase tracking-widest mb-3">Reviews</p>
            <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight">Shop owners kya kehte hain</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {testimonials.map((t) => (
              <div key={t.name}
                className="bg-gray-50 border border-gray-100 rounded-2xl p-6 hover:shadow-md hover:border-gray-200 transition-all duration-200 flex flex-col">
                {/* Quote mark */}
                <div className="text-4xl font-black text-blue-100 leading-none mb-3 select-none">"</div>
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: t.stars }).map((_, i) => (
                    <Star key={i} size={13} className="text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-sm text-gray-700 leading-relaxed flex-1 mb-5">{t.text}</p>
                <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                  <div className="w-9 h-9 rounded-full bg-linear-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                    <p className="text-xs text-gray-400">{t.role} · {t.city}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="relative overflow-hidden py-24 px-5">
        <div className="absolute inset-0 bg-gray-950" />
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/10 text-white/70 text-xs font-medium mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            500+ shops already using this
          </div>
          <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-4 tracking-tight">
            Apni dukaan modernize karo
          </h2>
          <p className="text-gray-400 text-lg mb-10 leading-relaxed">
            Notebook band karo. Digital ho jao. Start free — koi commitment nahi.
          </p>
          <Link to="/register"
            className="inline-flex items-center gap-2 px-8 py-4 text-sm font-bold text-gray-900 bg-white hover:bg-gray-100 rounded-xl transition shadow-xl">
            Free account banao <ArrowRight size={15} />
          </Link>
          <p className="text-gray-600 text-xs mt-5">14-day free trial · No credit card · Cancel anytime</p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-gray-950 border-t border-gray-800/60 py-10 px-5">
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
            <a href="#pricing"   className="text-xs text-gray-500 hover:text-white transition">Pricing</a>
            <Link to="/contact"  className="text-xs text-gray-500 hover:text-white transition">Contact</Link>
          </div>
        </div>
      </footer>

      <WhatsAppFAB />
    </div>
  );
}
