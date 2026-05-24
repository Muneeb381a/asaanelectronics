import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Store, Phone, MapPin, AlertCircle, Sparkles } from 'lucide-react';
import { createSellerSchema, type CreateSellerInput } from '@assaan/shared';
import { sellersApi } from '../api/sellers.api.ts';
import { useAuthStore } from '../store/auth.store.ts';

export default function OnboardingPage() {
  const navigate = useNavigate();
  const setAuth  = useAuthStore((s) => s.setAuth);
  const user     = useAuthStore((s) => s.user);

  const { register, handleSubmit, formState: { errors } } = useForm<CreateSellerInput>({
    resolver: zodResolver(createSellerSchema),
  });

  const { mutate, isPending, error } = useMutation({
    mutationFn: sellersApi.create,
    onSuccess: (data) => {
      setAuth(data.user, data.accessToken, data.refreshToken);
      void navigate('/dashboard');
    },
  });

  const apiError = error instanceof Error ? error.message : null;
  const firstName = user?.name.split(' ')[0] ?? 'there';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6 py-12">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
            <Sparkles size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome, {firstName}!
          </h1>
          <p className="text-sm text-gray-500 mt-1.5">
            Set up your shop in 30 seconds. You can update this anytime.
          </p>
        </div>

        {/* Trial badge */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-full">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <p className="text-xs font-semibold text-amber-700">14-day free trial started · No credit card needed</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <form onSubmit={handleSubmit((d) => mutate(d))} className="space-y-5">

            {/* Shop name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Store size={14} className="text-gray-400" />
                  Shop name
                </span>
              </label>
              <input
                type="text"
                autoFocus
                placeholder="e.g. City Electronics"
                {...register('shopName')}
                className={`w-full px-4 py-3 border rounded-xl text-sm outline-none transition ${
                  errors.shopName
                    ? 'border-red-300 focus:border-red-400 focus:ring-1 focus:ring-red-200'
                    : 'border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-100'
                }`}
              />
              {errors.shopName && (
                <p className="flex items-center gap-1 text-xs text-red-500 mt-1.5">
                  <AlertCircle size={11} /> {errors.shopName.message}
                </p>
              )}
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Phone size={14} className="text-gray-400" />
                  Phone number
                </span>
              </label>
              <input
                type="tel"
                placeholder="03XX-XXXXXXX"
                {...register('phone')}
                className={`w-full px-4 py-3 border rounded-xl text-sm outline-none transition ${
                  errors.phone
                    ? 'border-red-300 focus:border-red-400 focus:ring-1 focus:ring-red-200'
                    : 'border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-100'
                }`}
              />
              {errors.phone && (
                <p className="flex items-center gap-1 text-xs text-red-500 mt-1.5">
                  <AlertCircle size={11} /> {errors.phone.message}
                </p>
              )}
            </div>

            {/* Address */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <MapPin size={14} className="text-gray-400" />
                  Address{' '}
                  <span className="text-gray-400 font-normal text-xs">(optional)</span>
                </span>
              </label>
              <input
                type="text"
                placeholder="e.g. Shop 5, Urdu Bazaar, Lahore"
                {...register('address')}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 transition"
              />
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
              {isPending ? 'Setting up…' : 'Launch my shop →'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-5">
          Your data is encrypted and stays private to your shop only.
        </p>
      </div>
    </div>
  );
}
