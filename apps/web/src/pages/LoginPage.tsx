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
  const bullets = isOwner ? ownerBullets : shopBullets;

  return (
    <div className="hidden lg:flex lg:w-105 xl:w-120 flex-col justify-between bg-gray-950 p-12 shrink-0">
      <div>
        <div className="flex items-center gap-2.5 mb-16">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
            <CreditCard size={17} className="text-white" />
          </div>
          <span className="font-bold text-white text-base tracking-tight">Assaan Electronics</span>
        </div>

        {isOwner ? (
          <>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full mb-5">
              <Crown size={13} className="text-amber-400" />
              <span className="text-xs font-semibold text-amber-400 tracking-wide">Platform Owner</span>
            </div>
            <h2 className="text-3xl font-extrabold text-white leading-tight mb-4">
              Centralized control<br />
              <span className="text-amber-400">for all your shops.</span>
            </h2>
            <p className="text-gray-400 text-sm leading-relaxed mb-10">
              Create shops, assign owners, and monitor every installment plan across your entire network.
            </p>
          </>
        ) : (
          <>
            <h2 className="text-3xl font-extrabold text-white leading-tight mb-4">
              The smarter way to run<br />
              <span className="text-blue-400">installment sales.</span>
            </h2>
            <p className="text-gray-400 text-sm leading-relaxed mb-10">
              Replace your paper registers and scattered receipts with one clean, secure system.
            </p>
          </>
        )}

        <ul className="space-y-4">
          {bullets.map((b) => (
            <li key={b.text} className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isOwner ? 'bg-amber-500/10' : 'bg-white/5'}`}>
                <b.icon size={15} className={isOwner ? 'text-amber-400' : 'text-blue-400'} />
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

/* ── OTP step ────────────────────────────────────────────────────────────── */

const OTP_ANIM_CSS = `
@keyframes otp-bounce {
  0%   { transform: scale(1); }
  30%  { transform: scale(1.22); }
  60%  { transform: scale(0.91); }
  80%  { transform: scale(1.07); }
  100% { transform: scale(1); }
}
@keyframes otp-shake {
  0%,100% { transform: translateX(0); }
  12%     { transform: translateX(-9px); }
  25%     { transform: translateX(9px); }
  37%     { transform: translateX(-7px); }
  50%     { transform: translateX(7px); }
  62%     { transform: translateX(-4px); }
  75%     { transform: translateX(4px); }
  87%     { transform: translateX(-2px); }
}
@keyframes shield-float {
  0%,100% { transform: translateY(0) scale(1); }
  50%     { transform: translateY(-5px) scale(1.05); }
}
@keyframes fade-in-up {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
.otp-bounce   { animation: otp-bounce 0.38s cubic-bezier(.36,.07,.19,.97) both; }
.otp-shake    { animation: otp-shake  0.55s cubic-bezier(.36,.07,.19,.97) both; }
.shield-float { animation: shield-float 3s ease-in-out infinite; }
.fade-in-up   { animation: fade-in-up 0.35s ease both; }
`;

interface OtpStepProps {
  email: string;
  otpToken: string;
  onBack: () => void;
  onSuccess: (user: unknown, accessToken: string, refreshToken: string) => void;
}

function OtpStep({ email, otpToken, onBack, onSuccess }: OtpStepProps) {
  const [code,          setCode]          = useState('');
  const [lastTyped,     setLastTyped]     = useState<number | null>(null);
  const [isShaking,     setIsShaking]     = useState(false);
  const [resent,        setResent]        = useState(false);
  const [cooldown,      setCooldown]      = useState(0);
  const [localToken,    setLocalToken]    = useState(otpToken);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // countdown
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const verifyMutation = useMutation({
    mutationFn: (otp: string) => authApi.verifyOtp({ otpToken: localToken, code: otp }),
    onSuccess: (data) => onSuccess(data.user, data.accessToken, data.refreshToken),
    onError: () => {
      setIsShaking(true);
      setTimeout(() => {
        setIsShaking(false);
        setCode('');
        inputsRef.current[0]?.focus();
      }, 600);
    },
  });

  const resendMutation = useMutation({
    mutationFn: () => authApi.resendOtp({ otpToken: localToken }),
    onSuccess: (data) => {
      setLocalToken(data.otpToken);
      setCode('');
      setResent(true);
      setCooldown(60);
      setTimeout(() => setResent(false), 4000);
      inputsRef.current[0]?.focus();
    },
  });

  const submit = (otp: string) => {
    if (otp.length === 6 && !verifyMutation.isPending) {
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
      if (i < 5) {
        inputsRef.current[i + 1]?.focus();
      } else if (next.length === 6) {
        // last box filled — auto-submit after brief pause so user sees the fill
        setTimeout(() => submit(next), 180);
      }
    }
  };

  const handleKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!code[i] && i > 0) {
        const arr  = code.split('');
        arr[i - 1] = '';
        setCode(arr.join(''));
        inputsRef.current[i - 1]?.focus();
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!digits) return;
    setCode(digits);
    const focusIdx = Math.min(digits.length, 5);
    inputsRef.current[focusIdx]?.focus();
    if (digits.length === 6) setTimeout(() => submit(digits), 180);
  };

  const verifyError = verifyMutation.error instanceof Error ? verifyMutation.error.message : null;
  const resendError = resendMutation.error instanceof Error ? resendMutation.error.message : null;
  const isPending   = verifyMutation.isPending;
  const remaining   = 6 - code.length;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden fade-in-up">
      <style>{OTP_ANIM_CSS}</style>

      {/* Dark header */}
      <div className="relative bg-slate-950 px-8 pt-7 pb-12 text-center overflow-hidden">
        {/* decorative blobs */}
        <div className="absolute -top-10 -right-10 w-44 h-44 bg-blue-600/10 rounded-full blur-2xl pointer-events-none"/>
        <div className="absolute -bottom-8 -left-8  w-36 h-36 bg-indigo-500/8  rounded-full blur-xl  pointer-events-none"/>

        <button
          onClick={onBack}
          className="absolute top-4 left-4 flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-white/8 transition"
        >
          <ArrowLeft size={13}/> Back
        </button>

        <div className="w-16 h-16 bg-blue-500/15 border border-blue-400/25 rounded-2xl flex items-center justify-center mx-auto mb-4 shield-float">
          <Shield size={28} className="text-blue-400"/>
        </div>
        <h1 className="text-lg font-black text-white">Verify your identity</h1>
        <p className="text-xs text-slate-500 mt-1.5">6-digit code bheja gaya</p>
        <div className="inline-flex items-center gap-1.5 mt-2 bg-white/8 border border-white/10 rounded-full px-3 py-1">
          <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full"/>
          <span className="text-xs font-semibold text-slate-300 truncate max-w-48">{email}</span>
        </div>
      </div>

      {/* OTP boxes — overlap header */}
      <div className="px-8 -mt-6">
        <div className={`flex gap-2.5 justify-center ${isShaking ? 'otp-shake' : ''}`}>
          {Array.from({ length: 6 }).map((_, i) => {
            const filled = !!code[i];
            return (
              <div key={i} className="flex flex-col items-center gap-1.5">
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
                  disabled={isPending}
                  className={[
                    'w-11 h-14 text-center text-2xl font-black border-2 rounded-2xl outline-none transition-all duration-150 select-none',
                    isPending
                      ? 'border-blue-300 bg-blue-50 text-blue-300 cursor-not-allowed'
                      : filled
                        ? 'border-blue-600 bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                        : 'border-slate-200 bg-white text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:bg-blue-50/30',
                    lastTyped === i ? 'otp-bounce' : '',
                  ].join(' ')}
                />
                {/* dot tracker */}
                <div className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${filled ? 'bg-blue-500 scale-110' : 'bg-slate-200'}`}/>
              </div>
            );
          })}
        </div>

        {/* Status line */}
        <div className="h-8 flex items-center justify-center mt-3">
          {isPending ? (
            <span className="flex items-center gap-2 text-xs font-bold text-blue-500">
              <span className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"/>
              Verifying…
            </span>
          ) : verifyError ? null : remaining > 0 ? (
            <span className="text-xs text-slate-400">
              {code.length === 0
                ? 'Pehla digit daalo'
                : `${remaining} aur digit${remaining !== 1 ? 's' : ''} baqi`}
            </span>
          ) : (
            <span className="text-xs font-bold text-blue-600 flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
              Auto-verify ho raha hai…
            </span>
          )}
        </div>

        {/* Error */}
        {verifyError && (
          <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mt-1 mb-2">
            <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5"/>
            <p className="text-sm text-red-600">{verifyError}</p>
          </div>
        )}

        {/* Resent confirmation */}
        {resent && (
          <div className="flex items-center justify-center gap-2 text-sm text-emerald-600 font-semibold bg-emerald-50 border border-emerald-100 rounded-xl py-2.5 mt-1 mb-2">
            <CheckCircle2 size={14}/> Naya code bhej diya!
          </div>
        )}
        {resendError && (
          <p className="text-center text-xs text-red-500 mt-1 mb-2">{resendError}</p>
        )}

        {/* Resend */}
        <div className="py-6 border-t border-slate-100 mt-3 text-center">
          {cooldown > 0 ? (
            <p className="text-sm text-slate-400">
              Resend karo <span className="font-black text-slate-700 tabular-nums">{cooldown}s</span> mein
            </p>
          ) : (
            <button
              type="button"
              onClick={() => resendMutation.mutate()}
              disabled={resendMutation.isPending}
              className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700 transition disabled:opacity-50"
            >
              <RefreshCw size={13} className={resendMutation.isPending ? 'animate-spin' : ''}/>
              {resendMutation.isPending ? 'Bhej raha hai…' : 'Code dobara bhejo'}
            </button>
          )}
        </div>
      </div>
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
    setMode(next);
    setStep('credentials');
    setOtpToken('');
    reset();
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

      <div className="flex-1 flex items-center justify-center bg-gray-50 px-6 py-12">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2 justify-center mb-8">
            <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center">
              <CreditCard size={15} className="text-white"/>
            </div>
            <span className="font-bold text-gray-900">Assaan Electronics</span>
          </div>

          {step === 'otp' ? (
            <OtpStep
              email={getValues('email')}
              otpToken={otpToken}
              onBack={() => setStep('credentials')}
              onSuccess={(user, accessToken, refreshToken) => {
                setAuth(user as Parameters<typeof setAuth>[0], accessToken, refreshToken);
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
                        errors.email
                          ? 'border-red-300 focus:border-red-400 focus:ring-1 focus:ring-red-200'
                          : isOwner
                            ? 'border-gray-200 focus:border-amber-400 focus:ring-1 focus:ring-amber-100'
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
                        <Link to="/forgot-password" className="text-xs text-blue-600 hover:underline">Forgot password?</Link>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type={showPw ? 'text' : 'password'} autoComplete="current-password" placeholder="••••••••"
                        {...register('password')}
                        className={`w-full px-4 py-3 pr-11 border rounded-xl text-sm outline-none transition ${
                          errors.password
                            ? 'border-red-300 focus:border-red-400 focus:ring-1 focus:ring-red-200'
                            : isOwner
                              ? 'border-gray-200 focus:border-amber-400 focus:ring-1 focus:ring-amber-100'
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
