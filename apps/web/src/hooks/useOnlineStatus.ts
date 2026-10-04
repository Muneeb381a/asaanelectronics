import { useState, useEffect } from 'react';

// Lightweight connectivity flag for UI feedback (banners, disabled buttons).
// Not a write-queue — the service worker already serves cached GET responses
// offline; this just tells the UI when to say so and hold off on writes that
// would otherwise fail silently with a confusing network error.
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const goOnline  = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online',  goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online',  goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return isOnline;
}
