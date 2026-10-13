import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Lock, Loader2, Eye, EyeOff } from 'lucide-react';
import { authApi } from '../../api/auth.api.ts';
import { getErrorMessage } from '../../utils/error.ts';

interface Props {
  open: boolean;
  title?: string;
  description?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function PasswordGateModal({
  open, title = 'Password Confirm Karein', description = 'Ye sensitive data hai — apna password dobara enter karein.',
  onSuccess, onCancel,
}: Props) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password || checking) return;
    setChecking(true);
    setError(null);
    try {
      await authApi.verifyPassword({ password });
      setPassword('');
      onSuccess();
    } catch (err) {
      setError(getErrorMessage(err, 'Password ghalat hai'));
    } finally {
      setChecking(false);
    }
  }

  function handleCancel() {
    setPassword('');
    setError(null);
    onCancel();
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !checking) handleCancel(); }}
    >
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
          <Lock size={20} className="text-amber-600" />
        </div>
        <h3 className="text-base font-semibold text-gray-900 text-center mb-1.5">{title}</h3>
        <p className="text-sm text-gray-500 text-center mb-5 leading-relaxed">{description}</p>

        <div className="relative mb-2">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(null); }}
            autoFocus
            placeholder="Apna password"
            className={`w-full px-4 py-2.5 pr-11 border rounded-xl text-sm outline-none transition ${
              error ? 'border-red-300 focus:border-red-400 focus:ring-1 focus:ring-red-200'
              : 'border-gray-200 focus:border-amber-400 focus:ring-1 focus:ring-amber-100'
            }`}
          />
          <button type="button" onClick={() => setShowPassword((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {error && <p className="text-xs text-red-500 mb-4">{error}</p>}
        {!error && <div className="mb-4" />}

        <div className="flex gap-2">
          <button type="button" onClick={handleCancel} disabled={checking}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 font-medium hover:bg-gray-50 transition disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" disabled={checking || !password}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed bg-amber-600 hover:bg-amber-700">
            {checking ? <><Loader2 size={14} className="animate-spin" />Checking…</> : 'Confirm'}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
