import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Eye, EyeOff, RefreshCw, Shield, BarChart3, Zap,
  CreditCard, AlertCircle, Crown, Store, CheckCircle2,
} from 'lucide-react';
import { loginSchema, type LoginInput } from '@assaan/shared';
import { authApi } from '../api/auth.api.ts';
import { useAuthStore } from '../store/auth.store.ts';

type Step = 'credentials' | 'otp';
type Mode = 'owner' | 'shop';

/* ── Brand panel ─────────────────────────────────────────────────────────── */

const ownerBullets = [
  { icon: Crown,     text: 'Manage all registered shops from one place' },
  { icon: BarChart3, text: 'Monitor payments and performance across shops' },
  { icon: Shield,    text: 'Full platform control — no OTP required' },
];
const shopBullets = [
  { icon: Shield,    text: 'OTP-secured login keeps your data safe' },
  { icon: BarChart3, text: 'Live collections and overdue alerts' },
  { icon: Zap,       text: 'Set up in under 2 minutes, no training' },
];

function BrandPanel({ mode }: { mode: Mode }) {
  const isOwner = mode === 'owner';
  return (
    <div className="hidden lg:flex lg:w-105 xl:w-120 flex-col justify-between bg-gray-950 p-12 shrink-0">
      <div>
        <div className="flex items-center gap-2.5 mb-16">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
            <CreditCard size={17} className="text-white"/>
          </div>
          <span className="font-bold text-white text-base tracking-tight">Assaan Electronics</span>
        </div>
        {isOwner ? (
          <>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full mb-5">
              <Crown size={13} className="text-amber-400"/>
              <span className="text-xs font-semibold text-amber-400 tracking-wide">Platform Owner</span>
            </div>
            <h2 className="text-3xl font-extrabold text-white leading-tight mb-4">
              Centralized control<br/><span className="text-amber-400">for all your shops.</span>
            </h2>
            <p className="text-gray-400 text-sm leading-relaxed mb-10">
              Create shops, assign owners, and monitor every installment plan across your entire network.
            </p>
          </>
        ) : (
          <>
            <h2 className="text-3xl font-extrabold text-white leading-tight mb-4">
              The smarter way to run<br/><span className="text-blue-400">installment sales.</span>
            </h2>
            <p className="text-gray-400 text-sm leading-relaxed mb-10">
              Replace your paper registers and scattered receipts with one clean, secure system.
            </p>
          </>
        )}
        <ul className="space-y-4">
          {(isOwner ? ownerBullets : shopBullets).map((b) => (
            <li key={b.text} className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isOwner ? 'bg-amber-500/10' : 'bg-white/5'}`}>
                <b.icon size={15} className={isOwner ? 'text-amber-400' : 'text-blue-400'}/>
              </div>
              <span className="text-sm text-gray-300">{b.text}</span>
            </li>
          ))}
        </ul>
      </div>
      {!isOwner && (
        <div className="border-t border-white/10 pt-8">
          <p className="text-sm text-gray-300 italic leading-relaxed mb-3">
            &ldquo;Best decision we made for our shop. Collections are up, chaos is down.&rdquo;
          </p>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">A</div>
            <div>
              <p className="text-xs font-semibold text-white">Ahmed Raza</p>
              <p className="text-xs text-gray-500">Owner, City Electronics — Lahore</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── OTP animations ──────────────────────────────────────────────────────── */

const OTP_CSS = `
@keyframes box-enter {
  0%   { opacity:0; transform: translateY(28px) scale(0.72); }
  60%  { opacity:1; transform: translateY(-4px)  scale(1.06); }
  80%  { transform: translateY(2px)  scale(0.97); }
  100% { transform: translateY(0)    scale(1);    }
}
@keyframes digit-pop {
  0%   { transform: scale(1);    }
  25%  { transform: scale(1.4);  }
  52%  { transform: scale(0.82); }
  75%  { transform: scale(1.12); }
  100% { transform: scale(1);    }
}
@keyframes row-shake {
  0%,100% { transform: translateX(0);    }
  13%     { transform: translateX(-14px); }
  26%     { transform: translateX(14px);  }
  40%     { transform: translateX(-10px); }
  53%     { transform: translateX(10px);  }
  66%     { transform: translateX(-6px);  }
  80%     { transform: translateX(6px);   }
  93%     { transform: translateX(-2px);  }
}
@keyframes glow-ring {
  0%   { transform: scale(1);   opacity: 0.55; }
  100% { transform: scale(2.6); opacity: 0;    }
}
@keyframes shield-bob {
  0%,100% { transform: translateY(0)    scale(1);    }
  50%     { transform: translateY(-9px) scale(1.05); }
}
@keyframes slide-up {
  from { opacity:0; transform: translateY(20px); }
  to   { opacity:1; transform: translateY(0);    }
}
@keyframes dot-fill {
  from { transform: scale(0.5); opacity:0; }
  to   { transform: scale(1);   opacity:1; }
}
@keyframes success-spread {
  0%   { transform: scale(1);    }
  40%  { transform: scale(1.22); }
  65%  { transform: scale(0.91); }
  82%  { transform: scale(1.07); }
  100% { transform: scale(1);    }
}

.otp-box-enter  { animation: box-enter   0.52s cubic-bezier(0.34,1.56,0.64,1) both; }
.otp-digit-pop  { animation: digit-pop   0.38s cubic-bezier(0.34,1.56,0.64,1) both; }
.otp-row-shake  { animation: row-shake   0.54s cubic-bezier(0.36,0.07,0.19,0.97) both; }
.otp-glow-ring  { animation: glow-ring   2.2s  ease-out infinite; }
.otp-shield-bob { animation: shield-bob  3.4s  ease-in-out infinite; }
.otp-slide-up   { animation: slide-up    0.45s ease both; }
.otp-dot-fill   { animation: dot-fill    0.25s cubic-bezier(0.34,1.56,0.64,1) both; }
.otp-success    { animation: success-spread 0.44s cubic-bezier(0.34,1.56,0.64,1) both; }
`;

/* ── OTP step component ──────────────────────────────────────────────────── */

interface OtpStepProps {
  email: string;
  otpToken: string;
  onBack: () => void;
  onSuccess: (user: unknown, access: string, refresh: string) => void;
}

function OtpStep({ email, otpToken, onBack, onSuccess }: OtpStepProps) {
  const [code,       setCode]       = useState('');
  const [lastTyped,  setLastTyped]  = useState<number | null>(null);
  const [isShaking,  setIsShaking]  = useState(false);
  const [isSuccess,  setIsSuccess]  = useState(false);
  const [resent,     setResent]     = useState(false);
  const [cooldown,   setCooldown]   = useState(0);
  const [localToken, setLocalToken] = useState(otpToken);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const verifyMutation = useMutation({
    mutationFn: (otp: string) => authApi.verifyOtp({ otpToken: localToken, code: otp }),
    onSuccess: (data) => {
      setIsSuccess(true);
      setTimeout(() => onSuccess(data.user, data.accessToken, data.refreshToken), 900);
    },
    onError: () => {
      setIsShaking(true);
      setTimeout(() => {
        setIsShaking(false);
        setCode('');
        inputsRef.current[0]?.focus();
      }, 560);
    },
  });

  const resendMutation = useMutation({
    mutationFn: () => authApi.resendOtp({ otpToken: localToken }),
    onSuccess: (data) => {
      setLocalToken(data.otpToken);
      setCode('');
      setResent(true);
      setCooldown(60);
      setTimeout(() => setResent(false), 3500);
      inputsRef.current[0]?.focus();
    },
  });

  const submit = (otp: string) => {
    if (otp.length === 6 && !verifyMutation.isPending && !isSuccess) {
      verifyMutation.mutate(otp);
    }
  };

  const handleChange = (i: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(-1);
    const arr   = code.split('');
    arr[i]      = digit;
    const next  = arr.join('').slice(0, 6);
    setCode(next);
    if (digit) {
      setLastTyped(i);
      setTimeout(() => setLastTyped((p) => (p === i ? null : p)), 420);
      if (i < 5) inputsRef.current[i + 1]?.focus();
      else if (next.length === 6) setTimeout(() => submit(next), 200);
    }
  };

  const handleKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[i] && i > 0) {
      const arr  = code.split('');
      arr[i - 1] = '';
      setCode(arr.join(''));
      inputsRef.current[i - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!digits) return;
    setCode(digits);
    inputsRef.current[Math.min(digits.length, 5)]?.focus();
    if (digits.length === 6) setTimeout(() => submit(digits), 200);
  };

  const verifyError = verifyMutation.error instanceof Error ? verifyMutation.error.message : null;
  const isPending   = verifyMutation.isPending;
  const filled      = code.length;
  const circ        = 2 * Math.PI * 14;   // SVG ring circumference

  return (
    <div className="otp-slide-up w-full max-w-sm mx-auto text-center">
      <style>{OTP_CSS}</style>

      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition mb-10 group"
      >
        <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5"/>
        Wapas jao
      </button>

      {/* Shield icon with glow rings */}
      <div className="flex justify-center mb-7">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-blue-500/30 otp-glow-ring"  style={{ animationDelay: '0s' }}/>
          <div className="absolute inset-0 rounded-full bg-blue-400/20 otp-glow-ring"  style={{ animationDelay: '1.1s' }}/>
          <div className={`relative w-[76px] h-[76px] rounded-2xl flex items-center justify-center otp-shield-bob ${
            isSuccess
              ? 'bg-emerald-500/20 border border-emerald-400/30 shadow-[0_0_30px_rgba(52,211,153,0.25)]'
              : 'bg-blue-500/15 border border-blue-400/20 shadow-[0_0_30px_rgba(59,130,246,0.2)]'
          }`}>
            {isSuccess
              ? <CheckCircle2 size={34} className="text-emerald-400"/>
              : <Shield       size={34} className="text-blue-400"/>
            }
          </div>
        </div>
      </div>

      {/* Heading */}
      <h1 className="text-2xl font-black text-white mb-1.5 tracking-tight">
        {isSuccess ? 'Verified!' : 'Code daalo'}
      </h1>
      <p className="text-slate-500 text-sm mb-3">
        {isSuccess ? 'Dashboard par ja rahe hain…' : 'Aapke email par 6-digit code bheja gaya hai'}
      </p>
      <div className="inline-flex items-center gap-2 bg-slate-800/70 border border-slate-700/60 rounded-full px-4 py-1.5 mb-10">
        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse shrink-0"/>
        <span className="text-slate-300 text-xs font-medium truncate max-w-[220px]">{email}</span>
      </div>

      {/* ── OTP Boxes ── */}
      <div className={`flex gap-3 justify-center mb-4 ${isShaking ? 'otp-row-shake' : ''}`}>
        {Array.from({ length: 6 }).map((_, i) => {
          const digitFilled = !!code[i];
          const isCurrent   = filled === i && !isPending && !isSuccess;

          const boxCls = isSuccess
            ? 'bg-emerald-500 border-emerald-400 text-white shadow-[0_0_18px_rgba(52,211,153,0.45)] otp-success'
            : isPending && digitFilled
              ? 'bg-blue-500/40 border-blue-400/60 text-blue-200 animate-pulse'
            : isShaking && digitFilled
              ? 'bg-red-500/25 border-red-500 text-red-300'
            : digitFilled
              ? 'bg-blue-600 border-blue-500 text-white shadow-[0_0_20px_rgba(59,130,246,0.45)]'
            : isCurrent
              ? 'bg-slate-700 border-blue-500 text-white ring-4 ring-blue-500/20'
            : 'bg-slate-800 border-slate-600/80 text-slate-600 hover:border-slate-500';

          return (
            <div
              key={i}
              className="otp-box-enter"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <input
                ref={(el) => { inputsRef.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                autoFocus={i === 0}
                value={code[i] ?? ''}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKey(i, e)}
                onPaste={handlePaste}
                disabled={isPending || isSuccess}
                className={[
                  'w-12 h-[68px] text-center text-[26px] font-black border-2 rounded-2xl outline-none',
                  'transition-all duration-200 select-none cursor-text',
                  lastTyped === i ? 'otp-digit-pop' : '',
                  boxCls,
                ].join(' ')}
              />
            </div>
          );
        })}
      </div>

      {/* Progress pill track */}
      <div className="flex items-center gap-2 justify-center mb-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={[
              'rounded-full transition-all duration-300',
              i < filled
                ? 'w-6 h-1.5 bg-blue-500 otp-dot-fill'
                : 'w-1.5 h-1.5 bg-slate-700',
            ].join(' ')}
          />
        ))}
      </div>

      {/* Status line */}
      <div className="h-8 flex items-center justify-center mb-8">
        {isSuccess ? (
          <span className="flex items-center gap-2 text-sm font-bold text-emerald-400">
            <CheckCircle2 size={15}/> Login hua!
          </span>
        ) : isPending ? (
          <span className="flex items-center gap-2 text-sm font-semibold text-blue-400">
            <span className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"/>
            Verify ho raha hai…
          </span>
        ) : verifyError ? (
          <span className="flex items-center gap-2 text-sm text-red-400">
            <AlertCircle size={14}/> {verifyError}
          </span>
        ) : resent ? (
          <span className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
            <CheckCircle2 size={14}/> Naya code bhej diya!
          </span>
        ) : filled === 0 ? (
          <span className="text-sm text-slate-600">Apna OTP daalo</span>
        ) : filled === 6 ? (
          <span className="flex items-center gap-2 text-sm font-semibold text-blue-400">
            <span className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"/>
            Submit ho raha hai…
          </span>
        ) : (
          <span className="text-sm text-slate-500">
            {6 - filled} aur digit{6 - filled !== 1 ? 's' : ''} baqi
          </span>
        )}
      </div>

      {/* Divider */}
      <div className="w-full h-px bg-slate-800/80 mb-6"/>

      {/* Resend */}
      {cooldown > 0 ? (
        <div className="flex items-center justify-center gap-3">
          <div className="relative w-9 h-9 shrink-0">
            <svg className="w-9 h-9 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="14" fill="none" stroke="#1e293b" strokeWidth="3"/>
              <circle cx="18" cy="18" r="14" fill="none" stroke="#3b82f6" strokeWidth="3"
                strokeDasharray={circ.toFixed(1)}
                strokeDashoffset={(circ * (1 - cooldown / 60)).toFixed(1)}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 1s linear' }}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-blue-400 tabular-nums">
              {cooldown}
            </span>
          </div>
          <span className="text-sm text-slate-500">Dobara bhejne ke liye wait karo</span>
        </div>
      ) : (
        <button
          onClick={() => resendMutation.mutate()}
          disabled={resendMutation.isPending || isSuccess}
          className="group inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-blue-400 transition disabled:opacity-40"
        >
          <RefreshCw
            size={14}
            className={`transition-transform duration-500 ${resendMutation.isPending ? 'animate-spin' : 'group-hover:rotate-180'}`}
          />
          {resendMutation.isPending ? 'Bhej raha hai…' : 'Code dobara bhejo'}
        </button>
      )}
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth  = useAuthStore((s) => s.setAuth);

  const [mode,     setMode]     = useState<Mode>('shop');
  const [step,     setStep]     = useState<Step>('credentials');
  const [otpToken, setOtpToken] = useState('');
  const [showPw,   setShowPw]   = useState(false);

  const { register, handleSubmit, getValues, reset, formState: { errors } } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  function switchMode(next: Mode) {
    setMode(next); setStep('credentials'); setOtpToken(''); reset();
  }

  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      if (!data.requiresOtp) {
        setAuth(data.user, data.accessToken, data.refreshToken);
        void navigate(data.user.role === 'SUPER_ADMIN' ? '/owner' : '/dashboard');
      } else {
        setOtpToken(data.otpToken);
        setStep('otp');
      }
    },
  });

  const loginError = loginMutation.error instanceof Error ? loginMutation.error.message : null;
  const isOwner    = mode === 'owner';

  return (
    <div className="min-h-screen flex">
      <BrandPanel mode={mode}/>

      {/* Right panel — transitions to dark when OTP step */}
      <div className={`flex-1 flex items-center justify-center px-6 py-12 transition-colors duration-700 ${
        step === 'otp' ? 'bg-slate-950' : 'bg-gray-50'
      }`}>
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2 justify-center mb-8">
            <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center">
              <CreditCard size={15} className="text-white"/>
            </div>
            <span className={`font-bold ${step === 'otp' ? 'text-white' : 'text-gray-900'}`}>
              Assaan Electronics
            </span>
          </div>

          {step === 'otp' ? (
            <OtpStep
              email={getValues('email')}
              otpToken={otpToken}
              onBack={() => setStep('credentials')}
              onSuccess={(user, access, refresh) => {
                setAuth(user as Parameters<typeof setAuth>[0], access, refresh);
                void navigate('/dashboard');
              }}
            />
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">

              {/* Mode tabs */}
              <div className="flex border-b border-gray-100">
                <button onClick={() => switchMode('shop')}
                  className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-semibold transition ${
                    !isOwner ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                  }`}>
                  <Store size={15}/> Shop Owner
                </button>
                <button onClick={() => switchMode('owner')}
                  className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-semibold transition ${
                    isOwner ? 'text-amber-600 border-b-2 border-amber-500 bg-amber-50/50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                  }`}>
                  <Crown size={15}/> Owner Login
                </button>
              </div>

              <div className="p-8">
                <div className="mb-7">
                  {isOwner ? (
                    <>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
                          <Crown size={15} className="text-amber-500"/>
                        </div>
                        <span className="text-xs font-bold text-amber-600 uppercase tracking-widest">Platform Owner</span>
                      </div>
                      <h1 className="text-2xl font-bold text-gray-900">Owner access</h1>
                      <p className="text-sm text-gray-500 mt-1">Manage all shops and owners from one place</p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                          <Store size={15} className="text-blue-500"/>
                        </div>
                        <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">Shop Owner</span>
                      </div>
                      <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
                      <p className="text-sm text-gray-500 mt-1">Sign in — a verification code will be sent to your email</p>
                    </>
                  )}
                </div>

                <form onSubmit={handleSubmit((d) => loginMutation.mutate(d))} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                    <input
                      type="email" autoComplete="email" autoFocus placeholder="you@example.com"
                      {...register('email')}
                      className={`w-full px-4 py-3 border rounded-xl text-sm outline-none transition ${
                        errors.email ? 'border-red-300 focus:border-red-400 focus:ring-1 focus:ring-red-200'
                        : isOwner ? 'border-gray-200 focus:border-amber-400 focus:ring-1 focus:ring-amber-100'
                        : 'border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-100'
                      }`}
                    />
                    {errors.email && (
                      <p className="flex items-center gap-1 text-xs text-red-500 mt-1.5">
                        <AlertCircle size={11}/> {errors.email.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-sm font-medium text-gray-700">Password</label>
                      {!isOwner && (
                        <Link to="/forgot-password" className="text-xs text-blue-600 hover:underline">
                          Forgot password?
                        </Link>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type={showPw ? 'text' : 'password'} autoComplete="current-password" placeholder="••••••••"
                        {...register('password')}
                        className={`w-full px-4 py-3 pr-11 border rounded-xl text-sm outline-none transition ${
                          errors.password ? 'border-red-300 focus:border-red-400 focus:ring-1 focus:ring-red-200'
                          : isOwner ? 'border-gray-200 focus:border-amber-400 focus:ring-1 focus:ring-amber-100'
                          : 'border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-100'
                        }`}
                      />
                      <button type="button" onClick={() => setShowPw((p) => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition">
                        {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="flex items-center gap-1 text-xs text-red-500 mt-1.5">
                        <AlertCircle size={11}/> {errors.password.message}
                      </p>
                    )}
                  </div>

                  {!isOwner && (
                    <div className="flex items-center gap-2.5 px-3 py-2.5 bg-blue-50 border border-blue-100 rounded-xl">
                      <Shield size={14} className="text-blue-500 shrink-0"/>
                      <p className="text-xs text-blue-600">A one-time code will be sent to your email after this step.</p>
                    </div>
                  )}

                  {loginError && (
                    <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                      <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5"/>
                      <p className="text-sm text-red-600">{loginError}</p>
                    </div>
                  )}

                  <button type="submit" disabled={loginMutation.isPending}
                    className={`w-full py-3 text-white text-sm font-semibold rounded-xl transition shadow-sm disabled:opacity-60 ${
                      isOwner ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-200' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
                    }`}>
                    {loginMutation.isPending ? 'Signing in…' : 'Continue'}
                  </button>
                </form>

                {!isOwner && (
                  <p className="text-center text-sm text-gray-500 mt-6">
                    No account?{' '}
                    <Link to="/register" className="text-blue-600 font-medium hover:underline">Create one free</Link>
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
