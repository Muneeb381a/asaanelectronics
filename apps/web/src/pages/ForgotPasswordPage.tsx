import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Eye, EyeOff, AlertCircle, Mail } from 'lucide-react';
import { authApi } from '../api/auth.api.ts';

type Step = 'email' | 'otp' | 'done';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep]           = useState<Step>('email');
  const [email, setEmail]         = useState('');
  const [code, setCode]           = useState('');
  const [newPw, setNewPw]         = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const inputsRef                 = useRef<(HTMLInputElement | null)[]>([]);

  const sendMutation = useMutation({
    mutationFn: () => authApi.forgotPassword({ email }),
    onSuccess: () => setStep('otp'),
  });

  const resetMutation = useMutation({
    mutationFn: () => authApi.resetPassword({ email, code, newPassword: newPw }),
    onSuccess: () => setStep('done'),
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

  const pwMismatch = confirmPw.length > 0 && newPw !== confirmPw;
  const pwInvalid  = newPw.length < 8 || newPw !== confirmPw;
  const sendError  = sendMutation.error  instanceof Error ? sendMutation.error.message  : null;
  const resetError = resetMutation.error instanceof Error ? resetMutation.error.message : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6 py-12">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
              <Mail size={16} className="text-white" />
            </div>
            <span className="font-bold text-gray-900 text-lg">Assaan Electronics</span>
          </div>
        </div>

        {/* Step: email */}
        {step === 'email' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 mb-7 transition"
            >
              <ArrowLeft size={14} /> Back to login
            </Link>

            <div className="mb-7">
              <h1 className="text-2xl font-bold text-gray-900">Reset your password</h1>
              <p className="text-sm text-gray-500 mt-1">
                Enter your email and we'll send a reset code.
              </p>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoFocus
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 transition"
                />
              </div>

              {sendError && (
                <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-600">{sendError}</p>
                </div>
              )}

              <button
                onClick={() => sendMutation.mutate()}
                disabled={!email || sendMutation.isPending}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold rounded-xl transition shadow-sm shadow-blue-200"
              >
                {sendMutation.isPending ? 'Sending…' : 'Send reset code'}
              </button>
            </div>
          </div>
        )}

        {/* Step: otp + new password */}
        {step === 'otp' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <button
              onClick={() => { setStep('email'); setCode(''); }}
              className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 mb-7 transition"
            >
              <ArrowLeft size={14} /> Back
            </button>

            <div className="mb-7">
              <h1 className="text-xl font-bold text-gray-900">Enter reset code</h1>
              <p className="text-sm text-gray-500 mt-1">
                Sent to <span className="font-semibold text-gray-700">{email}</span>
              </p>
            </div>

            {/* OTP boxes */}
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

            {/* New password */}
            <div className="space-y-4 mb-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">New password</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    placeholder="Min 8 characters"
                    className="w-full px-4 py-3 pr-11 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm password</label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    placeholder="Repeat your password"
                    className={`w-full px-4 py-3 pr-11 border rounded-xl text-sm outline-none transition ${
                      pwMismatch
                        ? 'border-red-300 focus:border-red-400 focus:ring-1 focus:ring-red-200'
                        : 'border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-100'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                  >
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {pwMismatch && (
                  <p className="flex items-center gap-1 text-xs text-red-500 mt-1.5">
                    <AlertCircle size={11} /> Passwords don&apos;t match
                  </p>
                )}
              </div>
            </div>

            {resetError && (
              <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-5">
                <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-600">{resetError}</p>
              </div>
            )}

            <button
              onClick={() => resetMutation.mutate()}
              disabled={code.length < 6 || pwInvalid || resetMutation.isPending}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold rounded-xl transition shadow-sm shadow-blue-200 mb-3"
            >
              {resetMutation.isPending ? 'Resetting…' : 'Reset password'}
            </button>

            <button
              onClick={() => { sendMutation.mutate(); setCode(''); }}
              disabled={sendMutation.isPending}
              className="w-full text-sm text-gray-400 hover:text-gray-600 py-2 transition"
            >
              Didn&apos;t receive it? Resend
            </button>
          </div>
        )}

        {/* Step: done */}
        {step === 'done' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
            <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <CheckCircle size={32} className="text-green-500" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Password updated!</h1>
            <p className="text-sm text-gray-500 mb-8 leading-relaxed">
              Your password has been reset successfully.<br />You can now sign in with the new one.
            </p>
            <button
              onClick={() => void navigate('/login')}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition shadow-sm shadow-blue-200"
            >
              Back to login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
