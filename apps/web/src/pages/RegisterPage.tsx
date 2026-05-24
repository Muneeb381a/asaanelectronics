import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, CreditCard, Shield, BarChart3, Zap, AlertCircle, Check } from 'lucide-react';
import { registerSchema, type RegisterInput } from '@assaan/shared';
import { authApi } from '../api/auth.api.ts';
import { useAuthStore } from '../store/auth.store.ts';

const bullets = [
  { icon: Shield,    text: '14-day free trial — no credit card needed' },
  { icon: BarChart3, text: 'Live dashboard from day one' },
  { icon: Zap,       text: 'Setup takes under 2 minutes' },
];

function BrandPanel() {
  return (
    <div className="hidden lg:flex lg:w-105 xl:w-120 flex-col justify-between bg-gray-950 p-12 shrink-0">
      <div>
        <div className="flex items-center gap-2.5 mb-16">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
            <CreditCard size={17} className="text-white" />
          </div>
          <span className="font-bold text-white text-base tracking-tight">Assaan Electronics</span>
        </div>

        <h2 className="text-3xl font-extrabold text-white leading-tight mb-4">
          Join 500+ shops already<br />
          <span className="text-blue-400">managing digitally.</span>
        </h2>
        <p className="text-gray-400 text-sm leading-relaxed mb-10">
          Stop losing money to missed payments and paper records. Get started free in seconds.
        </p>

        <ul className="space-y-4">
          {bullets.map((b) => (
            <li key={b.text} className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center shrink-0">
                <b.icon size={15} className="text-blue-400" />
              </div>
              <span className="text-sm text-gray-300">{b.text}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="border-t border-white/10 pt-8">
        <div className="flex items-center gap-4">
          {['PKR 2Cr+', '500+', '99.9%'].map((v, i) => (
            <div key={v} className={i < 2 ? 'border-r border-white/10 pr-4' : ''}>
              <p className="text-lg font-bold text-white">{v}</p>
              <p className="text-xs text-gray-500">{['Tracked', 'Shops', 'Uptime'][i]}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const setAuth  = useAuthStore((s) => s.setAuth);
  const [showPw, setShowPw] = useState(false);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  });

  const pw = watch('password') ?? '';
  const pwChecks = [
    { label: 'At least 8 characters', ok: pw.length >= 8 },
  ];

  const { mutate, isPending, error } = useMutation({
    mutationFn: authApi.register,
    onSuccess: (data) => {
      setAuth(data.user, data.accessToken, data.refreshToken);
      void navigate('/onboarding');
    },
  });

  const apiError = error instanceof Error ? error.message : null;

  return (
    <div className="min-h-screen flex">
      <BrandPanel />

      <div className="flex-1 flex items-center justify-center bg-gray-50 px-6 py-12">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2 justify-center mb-8">
            <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center">
              <CreditCard size={15} className="text-white" />
            </div>
            <span className="font-bold text-gray-900">Assaan Electronics</span>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <div className="mb-7">
              <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
              <p className="text-sm text-gray-500 mt-1">Free for 14 days. No card required.</p>
            </div>

            <form onSubmit={handleSubmit((d) => mutate(d))} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Full name</label>
                <input
                  type="text"
                  autoComplete="name"
                  autoFocus
                  placeholder="Muhammad Muneeb"
                  {...register('name')}
                  className={`w-full px-4 py-3 border rounded-xl text-sm outline-none transition ${
                    errors.name
                      ? 'border-red-300 focus:border-red-400 focus:ring-1 focus:ring-red-200'
                      : 'border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-100'
                  }`}
                />
                {errors.name && (
                  <p className="flex items-center gap-1 text-xs text-red-500 mt-1.5">
                    <AlertCircle size={11} /> {errors.name.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  {...register('email')}
                  className={`w-full px-4 py-3 border rounded-xl text-sm outline-none transition ${
                    errors.email
                      ? 'border-red-300 focus:border-red-400 focus:ring-1 focus:ring-red-200'
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
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Min 8 characters"
                    {...register('password')}
                    className={`w-full px-4 py-3 pr-11 border rounded-xl text-sm outline-none transition ${
                      errors.password
                        ? 'border-red-300 focus:border-red-400 focus:ring-1 focus:ring-red-200'
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
                {pw.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {pwChecks.map((c) => (
                      <div key={c.label} className="flex items-center gap-1.5">
                        <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${c.ok ? 'bg-green-500' : 'bg-gray-200'}`}>
                          {c.ok && <Check size={8} className="text-white" strokeWidth={3} />}
                        </div>
                        <span className={`text-xs ${c.ok ? 'text-green-600' : 'text-gray-400'}`}>{c.label}</span>
                      </div>
                    ))}
                  </div>
                )}
                {errors.password && (
                  <p className="flex items-center gap-1 text-xs text-red-500 mt-1.5">
                    <AlertCircle size={11} /> {errors.password.message}
                  </p>
                )}
              </div>

              {apiError && (
                <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-600">{apiError}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isPending}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold rounded-xl transition shadow-sm shadow-blue-200"
              >
                {isPending ? 'Creating account…' : 'Create account'}
              </button>
            </form>

            <p className="text-center text-sm text-gray-500 mt-6">
              Already have an account?{' '}
              <Link to="/login" className="text-blue-600 font-medium hover:underline">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
