import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Eye, EyeOff, RefreshCw, Shield, BarChart3, Zap,
  CreditCard, AlertCircle, Crown, Store,
} from 'lucide-react';
import { loginSchema, type LoginInput } from '@assaan/shared';
import { authApi } from '../api/auth.api.ts';
import { useAuthStore } from '../store/auth.store.ts';

type Step = 'credentials' | 'otp';
type Mode = 'owner' | 'shop';

const ownerBullets = [
  { icon: Crown,    text: 'Manage all registered shops from one place' },
  { icon: BarChart3, text: 'Monitor payments and performance across shops' },
  { icon: Shield,   text: 'Full platform control — no OTP required' },
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
            "Best decision we made for our shop. Collections are up, chaos is down."
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

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth  = useAuthStore((s) => s.setAuth);

  const [mode, setMode]         = useState<Mode>('shop');
  const [step, setStep]         = useState<Step>('credentials');
  const [otpToken, setOtpToken] = useState('');
  const [code, setCode]         = useState('');
  const [resent, setResent]     = useState(false);
  const [showPw, setShowPw]     = useState(false);
  const inputsRef               = useRef<(HTMLInputElement | null)[]>([]);

  const { register, handleSubmit, getValues, reset, formState: { errors } } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  function switchMode(next: Mode) {
    setMode(next);
    setStep('credentials');
    setCode('');
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

  const verifyMutation = useMutation({
    mutationFn: () => authApi.verifyOtp({ otpToken, code }),
    onSuccess: (data) => {
      setAuth(data.user, data.accessToken, data.refreshToken);
      void navigate('/dashboard');
    },
  });

  const resendMutation = useMutation({
    mutationFn: () => authApi.resendOtp({ otpToken }),
    onSuccess: (data) => {
      setOtpToken(data.otpToken);
      setCode('');
      setResent(true);
      setTimeout(() => setResent(false), 5000);
    },
  });

  const handleOtpKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[i] && i > 0) inputsRef.current[i - 1]?.focus();
  };
  const handleOtpChange = (i: number, val: string) => {
    const digit = val.replace(/\D/, '').slice(-1);
    const arr = code.split('');
    arr[i] = digit;
    const next = arr.join('').slice(0, 6);
    setCode(next);
    if (digit && i < 5) inputsRef.current[i + 1]?.focus();
  };

  const loginError  = loginMutation.error  instanceof Error ? loginMutation.error.message  : null;
  const verifyError = verifyMutation.error instanceof Error ? verifyMutation.error.message : null;
  const resendError = resendMutation.error instanceof Error ? resendMutation.error.message : null;
  const isOwner     = mode === 'owner';

  return (
    <div className="min-h-screen flex">
      <BrandPanel mode={mode} />

      {/* Right: form */}
      <div className="flex-1 flex items-center justify-center bg-gray-50 px-6 py-12">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2 justify-center mb-8">
            <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center">
              <CreditCard size={15} className="text-white" />
            </div>
            <span className="font-bold text-gray-900">Assaan Electronics</span>
          </div>

          {step === 'credentials' ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">

              {/* Mode tab switcher */}
              <div className="flex border-b border-gray-100">
                <button
                  onClick={() => switchMode('shop')}
                  className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-semibold transition ${
                    !isOwner
                      ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Store size={15} />
                  Shop Owner
                </button>
                <button
                  onClick={() => switchMode('owner')}
                  className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-semibold transition ${
                    isOwner
                      ? 'text-amber-600 border-b-2 border-amber-500 bg-amber-50/50'
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Crown size={15} />
                  Owner Login
                </button>
              </div>

              <div className="p-8">
                <div className="mb-7">
                  {isOwner ? (
                    <>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
                          <Crown size={15} className="text-amber-500" />
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
                          <Store size={15} className="text-blue-500" />
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
                      type="email"
                      autoComplete="email"
                      autoFocus
                      placeholder="you@example.com"
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
                        <AlertCircle size={11} /> {errors.email.message}
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
                        type={showPw ? 'text' : 'password'}
                        autoComplete="current-password"
                        placeholder="••••••••"
                        {...register('password')}
                        className={`w-full px-4 py-3 pr-11 border rounded-xl text-sm outline-none transition ${
                          errors.password
                            ? 'border-red-300 focus:border-red-400 focus:ring-1 focus:ring-red-200'
                            : isOwner
                              ? 'border-gray-200 focus:border-amber-400 focus:ring-1 focus:ring-amber-100'
                              : 'border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-100'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw((p) => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                      >
                        {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="flex items-center gap-1 text-xs text-red-500 mt-1.5">
                        <AlertCircle size={11} /> {errors.password.message}
                      </p>
                    )}
                  </div>

                  {!isOwner && (
                    <div className="flex items-center gap-2.5 px-3 py-2.5 bg-blue-50 border border-blue-100 rounded-xl">
                      <Shield size={14} className="text-blue-500 shrink-0" />
                      <p className="text-xs text-blue-600">A one-time code will be sent to your email after this step.</p>
                    </div>
                  )}

                  {loginError && (
                    <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                      <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
                      <p className="text-sm text-red-600">{loginError}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loginMutation.isPending}
                    className={`w-full py-3 text-white text-sm font-semibold rounded-xl transition shadow-sm disabled:opacity-60 ${
                      isOwner
                        ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-200'
                        : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
                    }`}
                  >
                    {loginMutation.isPending ? 'Signing in…' : 'Continue'}
                  </button>
                </form>

                {!isOwner && (
                  <p className="text-center text-sm text-gray-500 mt-6">
                    No account?{' '}
                    <Link to="/register" className="text-blue-600 font-medium hover:underline">
                      Create one free
                    </Link>
                  </p>
                )}
              </div>
            </div>

          ) : (
            /* OTP step — only reached by shop owners */
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
              <button
                onClick={() => { setStep('credentials'); setCode(''); }}
                className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 mb-7 transition"
              >
                <ArrowLeft size={14} /> Back
              </button>

              <div className="text-center mb-8">
                <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Shield size={26} className="text-blue-600" />
                </div>
                <h1 className="text-xl font-bold text-gray-900">Check your inbox</h1>
                <p className="text-sm text-gray-500 mt-1.5">
                  We sent a 6-digit code to{' '}
                  <span className="font-semibold text-gray-700">{getValues('email')}</span>
                </p>
              </div>

              <div className="flex gap-2.5 justify-center mb-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <input
                    key={i}
                    ref={(el) => { inputsRef.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={code[i] ?? ''}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKey(i, e)}
                    className={`w-11 text-center text-xl font-bold border-2 rounded-xl outline-none transition ${
                      code[i]
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
                    }`}
                    style={{ height: '52px' }}
                  />
                ))}
              </div>

              {verifyError && (
                <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
                  <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-600">{verifyError}</p>
                </div>
              )}

              {resent && (
                <p className="text-center text-sm text-green-600 font-medium mb-4">New code sent!</p>
              )}

              {resendError && (
                <p className="text-center text-sm text-red-500 mb-4">{resendError}</p>
              )}

              <button
                onClick={() => verifyMutation.mutate()}
                disabled={code.length < 6 || verifyMutation.isPending}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold rounded-xl transition shadow-sm shadow-blue-200 mb-3"
              >
                {verifyMutation.isPending ? 'Verifying…' : 'Verify code'}
              </button>

              <button
                onClick={() => resendMutation.mutate()}
                disabled={resendMutation.isPending}
                className="w-full flex items-center justify-center gap-2 text-sm text-gray-400 hover:text-gray-700 py-2 transition disabled:opacity-50"
              >
                <RefreshCw size={13} className={resendMutation.isPending ? 'animate-spin' : ''} />
                {resendMutation.isPending ? 'Sending…' : 'Resend code'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
