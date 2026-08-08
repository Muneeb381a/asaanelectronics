import { useState } from 'react';
import { CreditCard, Bike } from 'lucide-react';
import InstallmentsPage from './InstallmentsPage.tsx';
import VehicleInstallmentsPage from './VehicleInstallmentsPage.tsx';

type Tab = 'electronics' | 'vehicles';

export default function InstallmentsContainerPage() {
  const [tab, setTab] = useState<Tab>('electronics');

  return (
    <div className="flex flex-col min-h-full">
      {/* Tab switcher */}
      <div className="px-4 pt-4 pb-0 sm:px-6 shrink-0">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
          <button
            onClick={() => setTab('electronics')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === 'electronics'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <CreditCard size={14} />
            Electronics
          </button>
          <button
            onClick={() => setTab('vehicles')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === 'vehicles'
                ? 'bg-white text-violet-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <Bike size={14} />
            Vehicle Finance
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {tab === 'electronics' ? <InstallmentsPage /> : <VehicleInstallmentsPage />}
      </div>
    </div>
  );
}
