import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Hourglass, LogOut, Mail } from 'lucide-react';
import { sellersApi } from '../api/sellers.api.ts';
import { authApi } from '../api/auth.api.ts';
import { useAuthStore } from '../store/auth.store.ts';

// Shown right after self-signup while the platform admin reviews the trial. Polls
// GET /sellers/me — it 403s while trialApprovalStatus is PENDING (see checkSession()
// in middleware/auth.ts) and succeeds the moment an admin approves it.
export default function TrialPendingPage() {
  const navigate = useNavigate();
  const qc       = useQueryClient();
  const user     = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const { data: shop, isSuccess } = useQuery({
    queryKey: ['trial-pending-check'],
    queryFn: sellersApi.getMe,
    retry: false,
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (isSuccess && shop) void navigate('/dashboard', { replace: true });
  }, [isSuccess, shop, navigate]);

  const logoutMutation = useMutation({
    mutationFn: () => authApi.logout(localStorage.getItem('refresh_token') ?? ''),
    onSettled: () => { clearAuth(); qc.clear(); void navigate('/login'); },
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6 py-12">
      <div className="w-full max-w-md text-center">
        <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <Hourglass size={26} className="text-amber-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Your trial is under review</h1>
        <p className="text-sm text-gray-500 mt-2 leading-relaxed">
          Thanks for signing up{user?.name ? `, ${user.name.split(' ')[0]}` : ''}. Our team reviews every
          new shop before activating the trial — this usually takes a few hours. You'll get access
          automatically here, no need to keep refreshing.
        </p>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mt-7 text-left">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            <Mail size={12} /> What happens next
          </div>
          <ol className="space-y-2.5 text-sm text-gray-600">
            <li className="flex gap-2"><span className="text-amber-500 font-bold">1.</span> An admin reviews your shop details.</li>
            <li className="flex gap-2"><span className="text-amber-500 font-bold">2.</span> Once approved, this page moves to your dashboard on its own.</li>
            <li className="flex gap-2"><span className="text-amber-500 font-bold">3.</span> Your 14-day trial clock only starts once approved.</li>
          </ol>
        </div>

        <button
          onClick={() => logoutMutation.mutate()}
          disabled={logoutMutation.isPending}
          className="mt-7 inline-flex items-center gap-1.5 text-sm font-medium text-gray-400 hover:text-gray-600 transition disabled:opacity-50"
        >
          <LogOut size={14} /> {logoutMutation.isPending ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </div>
  );
}
