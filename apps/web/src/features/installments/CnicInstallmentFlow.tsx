import { useState } from 'react';
import { ChevronLeft, X, User } from 'lucide-react';
import { type CustomerLookupResult } from '../../api/customers.api.ts';
import CnicCustomerLookup from '../customers/CnicCustomerLookup.tsx';
import InstallmentForm from './InstallmentForm.tsx';

interface Props {
  onSubmit: (data: Parameters<React.ComponentProps<typeof InstallmentForm>['onSubmit']>[0]) => void;
  isPending: boolean;
  onClose: () => void;
  murabahaMode?: boolean;
  error?: string | null;
}

export default function CnicInstallmentFlow({ onSubmit, isPending, onClose, murabahaMode, error }: Props) {
  const [customer, setCustomer] = useState<CustomerLookupResult | null>(null);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-2">
          {customer && (
            <button
              onClick={() => setCustomer(null)}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition mr-1"
            >
              <ChevronLeft size={16} />
            </button>
          )}
          <div>
            <h2 className="text-base font-semibold text-gray-900">New Installment</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {customer ? `Step 2 — Fill in details` : 'Step 1 — Find Customer'}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
        >
          <X size={16} />
        </button>
      </div>

      {/* Step indicator */}
      <div className="px-6 py-3 border-b border-gray-50 shrink-0">
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 text-xs font-semibold ${!customer ? 'text-blue-600' : 'text-emerald-600'}`}>
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${!customer ? 'bg-blue-600' : 'bg-emerald-500'}`}>
              {!customer ? '1' : '✓'}
            </div>
            Customer
          </div>
          <div className="flex-1 h-px bg-gray-200" />
          <div className={`flex items-center gap-1.5 text-xs font-semibold ${customer ? 'text-blue-600' : 'text-gray-300'}`}>
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${customer ? 'bg-blue-600' : 'bg-gray-300'}`}>
              2
            </div>
            Installment
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5">
        {!customer ? (
          /* Step 1: CNIC lookup */
          <CnicCustomerLookup
            onFound={(c) => setCustomer(c)}
            title=""
            subtitle="Customer ka CNIC enter karen aur search karen"
          />
        ) : (
          /* Step 2: Installment form */
          <>
            {/* Locked customer banner */}
            <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl px-3.5 py-3 mb-5">
              <div className="w-8 h-8 rounded-full bg-linear-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {customer.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-blue-900 truncate">{customer.name}</p>
                <p className="text-xs text-blue-600">{customer.phone}</p>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-blue-500 shrink-0">
                <User size={10} />
                <span>Locked</span>
              </div>
            </div>

            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <InstallmentForm
              lockedCustomerId={customer.id}
              lockedCustomerName={customer.name}
              isPending={isPending}
              onCancel={onClose}
              onSubmit={onSubmit}
              murabahaMode={murabahaMode}
            />
          </>
        )}
      </div>
    </div>
  );
}
