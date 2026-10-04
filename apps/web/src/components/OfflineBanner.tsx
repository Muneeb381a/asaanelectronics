import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus.ts';

// App-wide notice — the service worker keeps showing last-known data while
// offline, but every write (payment, new installment, expense…) will fail
// until connectivity returns. This just makes that visible instead of
// letting each action fail silently with a confusing network error.
export default function OfflineBanner() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="sticky top-0 z-[60] flex items-center justify-center gap-2 bg-amber-500 text-white text-xs font-semibold px-3 py-2">
      <WifiOff size={13} />
      Offline — purana data dikh raha hai. Naya payment/entry save karne ke liye internet wapis aana zaroori hai.
    </div>
  );
}
