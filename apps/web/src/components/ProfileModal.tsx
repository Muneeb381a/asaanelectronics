import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';
import { profileApi } from '../api/profile.api.ts';
import { useAuthStore } from '../store/auth.store.ts';

interface Props { onClose: () => void }

export default function ProfileModal({ onClose }: Props) {
  const { user, setAuth, accessToken } = useAuthStore();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'info' | 'password'>('info');
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [cur, setCur] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');

  const updateMutation = useMutation({
    mutationFn: () => profileApi.update({ name, email }),
    onSuccess: (updated) => {
      setAuth({ ...user!, name: updated.name, email: updated.email }, accessToken!, localStorage.getItem('refresh_token')!);
      qc.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Profile updated');
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Update failed'),
  });

  const pwMutation = useMutation({
    mutationFn: () => profileApi.changePassword({ currentPassword: cur, newPassword: newPw }),
    onSuccess: () => { toast.success('Password changed'); onClose(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  const pwInvalid = newPw.length < 8 || newPw !== confirmPw || !cur;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-sm">
              {user?.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">{user?.name}</p>
              <p className="text-xs text-gray-400">{user?.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4">
          {(['info', 'password'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                tab === t ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {t === 'info' ? 'Profile' : 'Password'}
            </button>
          ))}
        </div>

        <div className="px-6 py-5 space-y-4">
          {tab === 'info' ? (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Full name</label>
                <input value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Email address</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <button
                onClick={() => updateMutation.mutate()}
                disabled={(!name && !email) || updateMutation.isPending}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition disabled:opacity-50">
                {updateMutation.isPending ? 'Saving…' : 'Save changes'}
              </button>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Current password</label>
                <input type="password" value={cur} onChange={(e) => setCur(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">New password</label>
                <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)}
                  placeholder="Min 8 characters"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Confirm new password</label>
                <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)}
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    confirmPw && newPw !== confirmPw ? 'border-red-300' : 'border-gray-200'
                  }`} />
                {confirmPw && newPw !== confirmPw && (
                  <p className="text-xs text-red-500 mt-1">Passwords don't match</p>
                )}
              </div>
              <button
                onClick={() => pwMutation.mutate()}
                disabled={pwInvalid || pwMutation.isPending}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition disabled:opacity-50">
                {pwMutation.isPending ? 'Changing…' : 'Change password'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
