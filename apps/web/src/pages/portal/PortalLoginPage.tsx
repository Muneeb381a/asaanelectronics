import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Loader2, Eye, EyeOff } from 'lucide-react';
import { portalApi } from '../../api/portal.api.ts';
import { usePortalStore } from '../../store/portal.store.ts';
import toast from 'react-hot-toast';

function formatCnic(raw: string) {
  const digits = raw.replace(/\D/g, '').slice(0, 13);
  if (digits.length <= 5)  return digits;
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

export default function PortalLoginPage() {
  const navigate = useNavigate();
  const login    = usePortalStore((s) => s.login);

  const [cnic,    setCnic]    = useState('');
  const [phone,   setPhone]   = useState('');
  const [showPh,  setShowPh]  = useState(false);
  const [loading, setLoading] = useState(false);

  const cnicDigits = cnic.replace(/\D/g, '');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (cnicDigits.length !== 13) { toast.error('Enter complete 13-digit CNIC'); return; }
    if (!phone.trim())             { toast.error('Enter your registered phone number'); return; }

    setLoading(true);
    try {
      const res = await portalApi.login(cnicDigits, phone.trim());
      login({ token: res.token, customerId: res.customer.id, name: res.customer.name, shopName: res.shopName });
      navigate('/portal/dashboard', { replace: true });
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'No account found with these details');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Brand */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
            <ShieldCheck size={30} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Customer Portal</h1>
          <p className="text-sm text-gray-500 mt-1">View your account & installment plans</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">

            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                CNIC Number
              </label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="XXXXX-XXXXXXX-X"
                value={cnic}
                onChange={(e) => setCnic(formatCnic(e.target.value))}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
              <p className="text-[11px] text-gray-400 mt-1">{cnicDigits.length}/13 digits</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                Registered Phone Number
              </label>
              <div className="relative">
                <input
                  type={showPh ? 'text' : 'password'}
                  inputMode="tel"
                  placeholder="0300-1234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-3 pr-10 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
                <button type="button" onClick={() => setShowPh(!showPh)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPh ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || cnicDigits.length !== 13}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold rounded-xl text-sm transition flex items-center justify-center gap-2 mt-2"
            >
              {loading
                ? <><Loader2 size={16} className="animate-spin" /> Checking…</>
                : 'View My Account'
              }
            </button>
          </form>
        </div>

        {/* Security note */}
        <p className="text-center text-xs text-gray-400 mt-5 flex items-center justify-center gap-1.5">
          <ShieldCheck size={12} className="text-green-500" />
          Your data is encrypted and secure
        </p>
      </div>
    </div>
  );
}
