import { Link } from 'react-router-dom';
import {
  CreditCard, Users, Package, BarChart3, Shield, Smartphone,
  Check, ArrowRight, Star, Zap, TrendingUp, Clock, PhoneCall,
  Banknote, AlertTriangle, FileText, UserCheck, BookOpen,
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
    title: 'Register the Customer',
    desc: 'Upload the CNIC — name, date of birth, and address auto-fill instantly. Add guarantor details alongside. One registration, always accessible.',
    color: 'blue',
    tags: ['CNIC Scan', 'Auto-fill', 'Guarantor Record'],
  },
  {
    number: '02',
    icon: Package,
    title: 'Build the Installment Plan',
    desc: 'Pick a product from your inventory, set the down payment, and generate a monthly or daily plan. Murabaha mode available for Islamic financing.',
    color: 'violet',
    tags: ['Monthly / Daily', 'Murabaha Mode', 'Auto Invoice'],
  },
  {
    number: '03',
    icon: Banknote,
    title: 'Record Every Payment',
    desc: 'Log payments via cash, bank transfer, JazzCash, or Easypaisa. The remaining balance updates automatically. Print or WhatsApp the receipt instantly.',
    color: 'emerald',
    tags: ['All Methods', 'Auto Balance', 'Instant Bill'],
  },
  {
    number: '04',
    icon: BarChart3,
    title: 'Track Reports & Recovery',
    desc: "Today's collections, overdue accounts, and agent performance — all in one dashboard. Send bulk WhatsApp reminders to overdue customers in one click.",
    color: 'orange',
    tags: ['Live Dashboard', 'Agent Tracking', 'Bulk Reminders'],
  },
];

const colorMap: Record<string, { bg: string; text: string; border: string; light: string; num: string }> = {
  blue:    { bg: 'bg-blue-600',    text: 'text-blue-400',    border: 'border-blue-500/25',    light: 'bg-blue-500/15',    num: 'text-blue-900' },
  violet:  { bg: 'bg-violet-600',  text: 'text-violet-400',  border: 'border-violet-500/25',  light: 'bg-violet-500/15',  num: 'text-violet-900' },
  emerald: { bg: 'bg-emerald-600', text: 'text-emerald-400', border: 'border-emerald-500/25', light: 'bg-emerald-500/15', num: 'text-emerald-900' },
  orange:  { bg: 'bg-orange-500',  text: 'text-orange-400',  border: 'border-orange-500/25',  light: 'bg-orange-500/15',  num: 'text-orange-900' },
};

const features = [
  {
    icon: CreditCard,
    title: 'Installment Management',
    desc: 'Monthly and daily plans with automatic balance tracking, overdue alerts, and a reschedule option. Every customer\'s complete history in one view.',
    color: 'blue',
    points: ['Auto remaining balance', 'Reschedule any plan', 'Status timeline'],
  },
  {
    icon: Users,
    title: 'Customer Records',
    desc: 'CNIC auto-fill, guarantor records, area tagging, and a complete payment history per customer. Find anyone in seconds.',
    color: 'violet',
    points: ['CNIC verification', 'Guarantor tracking', 'Full payment history'],
  },
  {
    icon: PhoneCall,
    title: 'Recovery & Agents',
    desc: 'Assign recovery agents and track exactly how much each one has collected. Monthly performance per agent — who collected how, from whom.',
    color: 'emerald',
    points: ['Agent performance', 'Collection attribution', 'Proof image upload'],
  },
  {
    icon: BookOpen,
    title: 'Accounting & Ledger',
    desc: 'Record expenses, track income, and view a complete double-entry ledger. Cash book, P&L summary, and reconciliation — all built in.',
    color: 'orange',
    points: ['Full ledger', 'Expense tracking', 'P&L overview'],
  },
  {
    icon: Shield,
    title: 'Security & Staff',
    desc: 'Give each staff member separate permissions. Owner login requires a one-time code. CNIC data is hashed before storage. Your data stays yours.',
    color: 'red',
    points: ['Role-based access', 'OTP login', 'Full audit log'],
  },
  {
    icon: Smartphone,
    title: 'Works Everywhere',
    desc: 'Fully responsive on mobile, tablet, or desktop. Run it at the counter, in the back office, or from home — any device, any browser.',
    color: 'indigo',
    points: ['Mobile-first design', 'Any browser', 'Fast loading'],
  },
];

const fColorMap: Record<string, { bg: string; text: string; border: string }> = {
  blue:    { bg: 'bg-blue-500/10',    text: 'text-blue-400',    border: 'border-blue-500/20' },
  violet:  { bg: 'bg-violet-500/10',  text: 'text-violet-400',  border: 'border-violet-500/20' },
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  orange:  { bg: 'bg-orange-500/10',  text: 'text-orange-400',  border: 'border-orange-500/20' },
  red:     { bg: 'bg-red-500/10',     text: 'text-red-400',     border: 'border-red-500/20' },
  indigo:  { bg: 'bg-indigo-500/10',  text: 'text-indigo-400',  border: 'border-indigo-500/20' },
};

const problems = [
  {
    icon: FileText,
    title: 'Paper registers & notebooks',
    desc: 'Writing in separate notebooks, searching through pages, then forgetting — all of that ends here.',
  },
  {
    icon: AlertTriangle,
    title: 'Missed due payments',
    desc: 'Remembering who owes what and when is impossible manually. The system reminds you automatically.',
  },
  {
    icon: Wallet,
    title: 'No clear financial picture',
    desc: "How much came in today? This month? Where did the cash go? Now it's all in one place, in real time.",
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
    text: 'We used to track everything in notebooks. Now every payment, every customer, every balance is right here. It has completely transformed how we operate.',
    stars: 5,
    initials: 'AR',
  },
  {
    name: 'Usman Tariq',
    role: 'Manager, Star Mobile',
    city: 'Karachi',
    text: 'Keeping track of overdue customers was a nightmare. Now the system alerts us automatically — and we can send bulk WhatsApp reminders with one click.',
    stars: 5,
    initials: 'UT',
  },
  {
    name: 'Bilal Khan',
    role: 'Owner, Metro Electronics',
    city: 'Islamabad',
    text: 'Customer CNIC data is secure, payment history is crystal clear, and the dashboard shows me the full picture every morning without me asking.',
    stars: 5,
    initials: 'BK',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 antialiased">

      {/* ── Navbar ── */}
      <header className="sticky top-0 z-50 bg-gray-950/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm shadow-blue-900/50">
              <CreditCard size={15} className="text-white" />
            </div>
            <span className="font-bold text-white">Assaan Electronics</span>
          </div>
          <nav className="hidden md:flex items-center gap-7">
            <a href="#how-it-works" className="text-sm text-gray-400 hover:text-white transition">How it works</a>
            <a href="#features"     className="text-sm text-gray-400 hover:text-white transition">Features</a>
            <a href="#pricing"      className="text-sm text-gray-400 hover:text-white transition">Pricing</a>
            <a href="#reviews"      className="text-sm text-gray-400 hover:text-white transition">Reviews</a>
            <Link to="/contact"     className="text-sm text-gray-400 hover:text-white transition">Contact</Link>
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
      <section className="relative overflow-hidden bg-gray-950">
        {/* Animated background layer */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Primary orb — top-left */}
          <div className="absolute -top-40 -left-32 w-[700px] h-[700px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(37,99,235,0.22) 0%, transparent 70%)' }} />
          {/* Secondary orb — bottom-right */}
          <div className="absolute -bottom-48 -right-32 w-[600px] h-[600px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%)' }} />
          {/* Accent orb — center-right */}
          <div className="absolute top-1/3 right-1/4 w-[350px] h-[350px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.10) 0%, transparent 70%)' }} />
          {/* Dot grid */}
          <div className="absolute inset-0 opacity-[0.06]"
            style={{ backgroundImage: 'radial-gradient(circle, #6366f1 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
          {/* Horizontal grid lines */}
          <div className="absolute inset-0 opacity-[0.025]"
            style={{ backgroundImage: 'linear-gradient(0deg, transparent calc(100% - 1px), rgba(255,255,255,0.8) 100%)', backgroundSize: '100% 72px' }} />
        </div>

        <div className="relative max-w-6xl mx-auto px-5 pt-16 pb-24 lg:pt-20 lg:pb-28">
          <div className="grid lg:grid-cols-2 gap-14 items-center">

            {/* ── Left copy ── */}
            <div>
              {/* Live badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-8">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-60" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
                </span>
                Built for Pakistani electronics shops
              </div>

              {/* Headline */}
              <h1 className="text-5xl sm:text-[3.6rem] font-extrabold leading-[1.06] tracking-tight mb-6 text-white">
                The smarter way<br />
                to run{' '}
                <span className="relative">
                  <span className="bg-linear-to-r from-blue-400 via-indigo-400 to-violet-400 bg-clip-text text-transparent">
                    installment
                  </span>
                  {' '}
                  <span className="bg-linear-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
                    sales
                  </span>
                  {/* Underline accent */}
                  <span className="absolute -bottom-1 left-0 w-full h-px bg-linear-to-r from-blue-500/0 via-blue-500/60 to-violet-500/0" />
                </span>
              </h1>

              {/* Subtext */}
              <p className="text-lg text-gray-400 leading-relaxed mb-6 max-w-[480px]">
                Replace paper registers with one clean system. Track customers,
                collect payments, manage recovery agents — get overdue alerts automatically.
              </p>

              {/* Trust chips */}
              <div className="flex flex-wrap gap-2 mb-8">
                {['Free 14-day trial', 'No credit card', 'Setup in 2 min'].map((t) => (
                  <span key={t} className="inline-flex items-center gap-1.5 text-xs text-gray-400 bg-white/5 border border-white/10 rounded-full px-3.5 py-1.5">
                    <Check size={10} className="text-emerald-400" /> {t}
                  </span>
                ))}
              </div>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-3 mb-10">
                <Link to="/register"
                  className="group relative inline-flex items-center justify-center gap-2 px-7 py-4 text-sm font-bold text-white rounded-xl overflow-hidden shadow-lg shadow-blue-950/50 transition-transform hover:scale-[1.02] active:scale-[0.99]">
                  <span className="absolute inset-0 bg-linear-to-r from-blue-600 to-blue-500 transition-opacity" />
                  <span className="absolute inset-0 bg-linear-to-r from-blue-500 to-violet-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  {/* Button glow ring */}
                  <span className="absolute -inset-px rounded-xl bg-linear-to-r from-blue-400/40 to-violet-400/40 opacity-0 group-hover:opacity-100 blur-sm transition-opacity" />
                  <span className="relative flex items-center gap-2">
                    Start free — no credit card
                    <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </Link>
                <Link to="/login"
                  className="inline-flex items-center justify-center gap-2 px-6 py-4 text-sm font-semibold text-gray-300 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 rounded-xl transition-all">
                  Sign in <ChevronRight size={14} />
                </Link>
              </div>

              {/* Social proof row */}
              <div className="flex items-center gap-4 pt-6 border-t border-white/5">
                {/* Avatar stack */}
                <div className="flex -space-x-2">
                  {(
                    [
                      ['AR', '#3b82f6'],
                      ['UT', '#8b5cf6'],
                      ['BK', '#10b981'],
                      ['MK', '#f59e0b'],
                      ['SH', '#ef4444'],
                    ] as [string, string][]
                  ).map(([init, bg]) => (
                    <div key={init}
                      className="w-8 h-8 rounded-full border-2 border-gray-950 flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                      style={{ background: bg }}>
                      {init}
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex items-center gap-0.5 mb-0.5">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star key={i} size={11} className="text-amber-400 fill-amber-400" />
                    ))}
                  </div>
                  <p className="text-xs text-gray-500">
                    <span className="text-white font-semibold">500+</span> shops across Pakistan
                  </p>
                </div>
                <div className="hidden sm:flex items-center gap-4 ml-4 pl-4 border-l border-white/5">
                  {[['PKR 2Cr+', 'Tracked'], ['99.9%', 'Uptime']].map(([v, l]) => (
                    <div key={l}>
                      <p className="font-extrabold text-white text-base leading-none">{v}</p>
                      <p className="text-[10px] text-gray-600 mt-0.5">{l}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Right — enhanced dashboard mockup ── */}
            <div className="relative">
              {/* Glow behind card */}
              <div className="absolute -inset-6 rounded-3xl"
                style={{ background: 'radial-gradient(ellipse at center, rgba(37,99,235,0.18) 0%, rgba(124,58,237,0.12) 50%, transparent 70%)' }} />

              {/* Floating badge — top-left */}
              <div className="absolute -left-5 top-10 z-20 bg-white rounded-2xl shadow-xl shadow-black/20 px-3.5 py-2.5 flex items-center gap-2.5 border border-gray-100/80">
                <div className="w-8 h-8 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
                  <TrendingUp size={14} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-[9px] text-gray-400 leading-none mb-0.5">This month</p>
                  <p className="text-xs font-bold text-gray-900">PKR 3,20,000</p>
                </div>
              </div>

              {/* Floating badge — bottom-right */}
              <div className="absolute -right-5 bottom-14 z-20 bg-white rounded-2xl shadow-xl shadow-black/20 px-3.5 py-2.5 flex items-center gap-2.5 border border-gray-100/80">
                <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
                  <Check size={14} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-[9px] text-gray-400 leading-none mb-0.5">Payment recorded</p>
                  <p className="text-xs font-bold text-gray-900">PKR 8,500 · just now</p>
                </div>
              </div>

              {/* Main window */}
              <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/50"
                style={{ background: 'linear-gradient(145deg, #1a1f2e 0%, #111827 100%)' }}>

                {/* Browser chrome */}
                <div className="flex items-center gap-2 px-4 py-3 bg-black/20 border-b border-white/5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
                  <div className="flex-1 mx-3">
                    <div className="bg-white/5 border border-white/8 rounded-md px-3 py-1 text-[10px] text-gray-500 max-w-[210px] mx-auto text-center tracking-wide">
                      app.assaan-electronics.com
                    </div>
                  </div>
                </div>

                {/* Layout */}
                <div className="flex">
                  {/* Sidebar */}
                  <div className="w-[130px] border-r border-white/5 p-2.5 hidden sm:block shrink-0"
                    style={{ background: 'rgba(0,0,0,0.25)' }}>
                    <div className="flex items-center gap-1.5 mb-4 px-1 pt-0.5">
                      <div className="w-4 h-4 bg-blue-600 rounded flex items-center justify-center shrink-0">
                        <CreditCard size={7} className="text-white" />
                      </div>
                      <div>
                        <p className="text-[8px] font-bold text-white leading-none">Assaan</p>
                        <p className="text-[6px] text-gray-600 leading-none mt-0.5">Mgr</p>
                      </div>
                    </div>
                    {[
                      { label: 'Dashboard',    active: true },
                      { label: 'Customers',    active: false },
                      { label: 'Installments', active: false },
                      { label: 'Recovery',     active: false },
                      { label: 'Reports',      active: false },
                    ].map((item) => (
                      <div key={item.label}
                        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg mb-0.5 text-[8.5px] font-medium ${
                          item.active
                            ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20'
                            : 'text-gray-600'
                        }`}>
                        <div className={`w-1 h-1 rounded-full shrink-0 ${item.active ? 'bg-blue-400' : 'bg-gray-700'}`} />
                        {item.label}
                      </div>
                    ))}
                  </div>

                  {/* Main content */}
                  <div className="flex-1 p-3 min-w-0">
                    {/* Top bar */}
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[9px] font-bold text-white">Dashboard</p>
                      <span className="text-[7px] text-gray-600 bg-white/5 border border-white/8 px-2 py-0.5 rounded-full">Today · May 30</span>
                    </div>

                    {/* Stat cards */}
                    <div className="grid grid-cols-2 gap-1.5 mb-2.5">
                      {[
                        { label: "Today's Collections", val: 'PKR 45,000',  c: 'text-blue-400',    bg: 'bg-blue-500/10',    b: 'border-blue-500/15',  sub: '+12% vs yesterday' },
                        { label: 'Monthly Revenue',     val: 'PKR 3.2L',    c: 'text-violet-400',  bg: 'bg-violet-500/10',  b: 'border-violet-500/15',sub: '+8% vs last month' },
                        { label: 'Active Plans',        val: '84 plans',    c: 'text-emerald-400', bg: 'bg-emerald-500/10', b: 'border-emerald-500/15',sub: '6 new this week' },
                        { label: 'Overdue Alerts',      val: '3 accounts',  c: 'text-red-400',     bg: 'bg-red-500/10',     b: 'border-red-500/15',   sub: 'Needs attention' },
                      ].map((s) => (
                        <div key={s.label} className={`rounded-xl p-2.5 border ${s.b} ${s.bg}`}>
                          <p className="text-[7px] text-gray-600 mb-0.5 truncate">{s.label}</p>
                          <p className={`text-[11px] font-bold ${s.c} leading-tight`}>{s.val}</p>
                          <p className="text-[6.5px] text-gray-700 mt-0.5">{s.sub}</p>
                        </div>
                      ))}
                    </div>

                    {/* Bar chart */}
                    <div className="rounded-xl p-2.5 mb-2 border border-white/5 bg-white/[0.03]">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[7.5px] font-semibold text-gray-500">Weekly Collections</p>
                        <p className="text-[7.5px] font-bold text-blue-400">PKR 2.1L this week</p>
                      </div>
                      <div className="flex items-end gap-[3px] h-9">
                        {[35, 60, 42, 78, 52, 92, 65].map((h, i) => (
                          <div key={i} className="flex-1 rounded-sm transition-all"
                            style={{
                              height: `${h}%`,
                              background: i === 5
                                ? 'linear-gradient(to top, #2563eb, #818cf8)'
                                : 'rgba(255,255,255,0.06)',
                            }} />
                        ))}
                      </div>
                      <div className="flex justify-between mt-1">
                        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                          <p key={i} className={`text-[6.5px] flex-1 text-center ${i === 5 ? 'text-blue-400 font-bold' : 'text-gray-700'}`}>{d}</p>
                        ))}
                      </div>
                    </div>

                    {/* Recent installments */}
                    <div className="rounded-xl border border-white/5 overflow-hidden bg-white/[0.02]">
                      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-white/5">
                        <p className="text-[7px] font-bold text-gray-600 uppercase tracking-wider">Recent</p>
                        <span className="text-[6px] text-blue-500">View all →</span>
                      </div>
                      {[
                        { name: 'Ali Hassan',  product: 'Samsung 55"', rem: '24,000', status: 'Active',  dot: 'bg-emerald-500', sc: 'bg-emerald-500/15 text-emerald-400' },
                        { name: 'Sara Malik',  product: 'LG Fridge',   rem: '0',      status: 'Done',    dot: 'bg-blue-500',    sc: 'bg-blue-500/15 text-blue-400' },
                        { name: 'Usman Ahmed', product: 'iPhone 15',   rem: '61,000', status: 'Overdue', dot: 'bg-red-500',     sc: 'bg-red-500/15 text-red-400' },
                      ].map((r) => (
                        <div key={r.name} className="flex items-center justify-between px-2.5 py-1.5 border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className="w-5 h-5 rounded-full bg-blue-600/20 border border-blue-500/20 flex items-center justify-center text-[7px] font-bold text-blue-400 shrink-0">
                              {r.name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-[8.5px] font-semibold text-gray-300 truncate">{r.name}</p>
                              <p className="text-[7px] text-gray-600 truncate">{r.product}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[8px] font-semibold text-gray-400">PKR {r.rem}</span>
                            <span className={`flex items-center gap-0.5 text-[7px] font-medium px-1.5 py-0.5 rounded-full ${r.sc}`}>
                              <span className={`w-1 h-1 rounded-full ${r.dot}`} />
                              {r.status}
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

        {/* Bottom fade into pain-points section */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-linear-to-b from-transparent to-gray-950 pointer-events-none" />
      </section>

      {/* ── Pain points ── */}
      <section className="py-14 bg-gray-950">
        <div className="max-w-5xl mx-auto px-5">
          <p className="text-center text-xs font-bold text-blue-400 uppercase tracking-widest mb-8">Sound familiar?</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {problems.map((p) => (
              <div key={p.title} className="flex gap-4 items-start bg-white/[0.04] rounded-2xl p-5 border border-white/8">
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
            Assaan Electronics solves all of these problems permanently.
            <Link to="/register" className="text-blue-400 hover:text-blue-300 ml-1 underline underline-offset-2">Try it free →</Link>
          </p>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="py-24 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-5">
          <div className="text-center mb-16">
            <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-3">How it works</p>
            <h2 className="text-4xl font-extrabold text-white tracking-tight">4 simple steps</h2>
            <p className="text-gray-400 mt-3 max-w-lg mx-auto">
              From setup to accounting — a clear workflow for every task.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {steps.map((step, idx) => {
              const c = colorMap[step.color];
              return (
                <div key={step.number} className="relative">
                  {idx < steps.length - 1 && (
                    <div className="hidden lg:block absolute top-10 left-[calc(100%-0px)] w-5 z-10">
                      <div className="w-full h-px bg-white/10 mt-0.5" />
                      <ChevronRight size={12} className="text-white/20 absolute -right-1.5 -top-2" />
                    </div>
                  )}
                  <div className={`rounded-2xl border ${c.border} bg-white/[0.04] p-6 h-full hover:bg-white/[0.07] transition-all duration-200 group`}>
                    <div className="flex items-center justify-between mb-4">
                      <div className={`w-11 h-11 ${c.bg} rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform`}>
                        <step.icon size={20} className="text-white" />
                      </div>
                      <span className={`text-3xl font-black ${c.num} select-none`}>{step.number}</span>
                    </div>
                    <h3 className="font-bold text-white text-base mb-2">{step.title}</h3>
                    <p className="text-sm text-gray-400 leading-relaxed mb-4">{step.desc}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {step.tags.map((tag) => (
                        <span key={tag} className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${c.light} ${c.text}`}>
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
      <section id="features" className="py-24 border-t border-white/5" style={{ background: 'rgba(255,255,255,0.015)' }}>
        <div className="max-w-6xl mx-auto px-5">
          <div className="text-center mb-14">
            <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-3">Features</p>
            <h2 className="text-4xl font-extrabold text-white tracking-tight">Everything in one place</h2>
            <p className="text-lg text-gray-400 mt-3 max-w-xl mx-auto">
              Notebooks, spreadsheets, and scattered apps — all replaced by one clean system.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => {
              const fc = fColorMap[f.color];
              return (
                <div key={f.title}
                  className={`rounded-2xl border ${fc.border} bg-white/[0.04] p-6 hover:bg-white/[0.07] transition-all duration-200 group`}>
                  <div className={`w-11 h-11 ${fc.bg} rounded-xl flex items-center justify-center mb-5 group-hover:scale-105 transition-transform border border-white/5`}>
                    <f.icon size={20} className={fc.text} />
                  </div>
                  <h3 className="font-bold text-white mb-2">{f.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed mb-4">{f.desc}</p>
                  <ul className="space-y-1.5">
                    {f.points.map((pt) => (
                      <li key={pt} className="flex items-center gap-2 text-xs text-gray-400">
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

          {/* Bento highlight — 3 standout cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-5">
            <div className="rounded-2xl p-7 flex flex-col justify-between min-h-52 border border-white/8 bg-white/[0.04] hover:bg-white/[0.07] transition-all">
              <div className="w-11 h-11 bg-white/8 rounded-xl flex items-center justify-center mb-5 border border-white/10">
                <Shield size={20} className="text-gray-300" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-2">Security first</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  OTP login for every owner. CNIC data is hashed — raw numbers never stored. Your data stays yours, always.
                </p>
              </div>
            </div>
            <div className="rounded-2xl p-7 flex flex-col justify-between min-h-52 border border-blue-500/30 bg-blue-600/10 hover:bg-blue-600/15 transition-all">
              <div className="w-11 h-11 bg-blue-500/20 rounded-xl flex items-center justify-center mb-5 border border-blue-500/30">
                <Zap size={20} className="text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-2">2 minute setup</h3>
                <p className="text-blue-300/70 text-sm leading-relaxed">
                  Create an account, set up your shop, add your first customer — all done before your next customer walks in.
                </p>
              </div>
            </div>
            <div className="rounded-2xl p-7 flex flex-col justify-between min-h-52 border border-violet-500/30 bg-violet-600/10 hover:bg-violet-600/15 transition-all">
              <div className="w-11 h-11 bg-violet-500/20 rounded-xl flex items-center justify-center mb-5 border border-violet-500/30">
                <TrendingUp size={20} className="text-violet-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-2">Real-time reports</h3>
                <p className="text-violet-300/70 text-sm leading-relaxed">
                  Daily collections, monthly revenue, agent performance — log in to the dashboard and everything is right there.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="py-16 border-y border-white/5" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="max-w-5xl mx-auto px-5 grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((s) => (
            <div key={s.label} className="text-center group">
              <div className="w-11 h-11 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:bg-blue-500/20 transition">
                <s.icon size={19} className="text-blue-400" />
              </div>
              <p className="text-3xl font-extrabold text-white">{s.value}</p>
              <p className="text-sm text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="py-24 border-t border-white/5">
        <div className="max-w-5xl mx-auto px-5">
          <div className="text-center mb-14">
            <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-3">Pricing</p>
            <h2 className="text-4xl font-extrabold text-white tracking-tight">Simple, honest pricing</h2>
            <p className="text-lg text-gray-400 mt-3">14-day free trial. No credit card required.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 items-start">
            {plans.map((plan) => (
              <div key={plan.name}
                className={`rounded-2xl p-7 flex flex-col relative ${
                  plan.highlight
                    ? 'bg-white/[0.07] border border-blue-500/30 shadow-xl shadow-blue-950/50 scale-[1.02]'
                    : 'bg-white/[0.04] border border-white/8'
                }`}>
                {plan.badge && (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-4 py-1 rounded-full shadow-sm shadow-blue-900/50">
                    {plan.badge}
                  </span>
                )}
                <div className="mb-6">
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-3 text-gray-500">
                    {plan.name}
                  </p>
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="text-3xl font-extrabold text-white">{plan.price}</span>
                    <span className="text-sm text-gray-500">{plan.period}</span>
                  </div>
                  <p className="text-sm text-gray-400">{plan.desc}</p>
                </div>

                <ul className="space-y-3 flex-1 mb-8">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5 text-sm">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                        plan.highlight ? 'bg-blue-600' : 'bg-blue-500/15'
                      }`}>
                        <Check size={10} className={plan.highlight ? 'text-white' : 'text-blue-400'} />
                      </div>
                      <span className="text-gray-300">{feat}</span>
                    </li>
                  ))}
                </ul>

                <Link to={plan.href}
                  className={`w-full py-3 rounded-xl text-sm font-bold text-center transition ${
                    plan.highlight
                      ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-900/40'
                      : 'bg-white/8 text-white hover:bg-white/12 border border-white/10'
                  }`}>
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section id="reviews" className="py-24 border-t border-white/5" style={{ background: 'rgba(255,255,255,0.015)' }}>
        <div className="max-w-5xl mx-auto px-5">
          <div className="text-center mb-14">
            <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-3">Reviews</p>
            <h2 className="text-4xl font-extrabold text-white tracking-tight">What shop owners say</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {testimonials.map((t) => (
              <div key={t.name}
                className="bg-white/[0.04] border border-white/8 rounded-2xl p-6 hover:bg-white/[0.07] transition-all duration-200 flex flex-col">
                <div className="text-4xl font-black text-blue-500/20 leading-none mb-3 select-none">"</div>
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: t.stars }).map((_, i) => (
                    <Star key={i} size={13} className="text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-sm text-gray-300 leading-relaxed flex-1 mb-5">{t.text}</p>
                <div className="flex items-center gap-3 pt-4 border-t border-white/8">
                  <div className="w-9 h-9 rounded-full bg-linear-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{t.name}</p>
                    <p className="text-xs text-gray-500">{t.role} · {t.city}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="relative overflow-hidden py-28 px-5 border-t border-white/5">
        <div className="absolute inset-0 opacity-[0.035]"
          style={{ backgroundImage: 'radial-gradient(circle, #6366f1 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[400px] rounded-full blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(ellipse, rgba(37,99,235,0.25) 0%, rgba(124,58,237,0.10) 50%, transparent 70%)' }} />
        <div className="relative max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/10 text-white/70 text-xs font-medium mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            500+ shops already using this
          </div>
          <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-4 tracking-tight">
            Modernize your shop today
          </h2>
          <p className="text-gray-400 text-lg mb-10 leading-relaxed">
            Leave paper registers behind. Go digital today. Start free — no commitment.
          </p>
          <Link to="/register"
            className="inline-flex items-center gap-2 px-8 py-4 text-sm font-bold text-gray-900 bg-white hover:bg-gray-100 rounded-xl transition shadow-xl">
            Create your free account <ArrowRight size={15} />
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
