import { useState, useEffect } from 'react';
import { X, Download, Share } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'pwa-install-dismissed';

// iOS Safari never fires beforeinstallprompt — Apple doesn't support that API
// at all, by design — so the banner below silently never showed on iPhones.
// There's no programmatic install trigger on iOS either; the only path is
// Share → Add to Home Screen, done manually, so this just walks the user
// through it instead of trying (and failing) to auto-prompt.
function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
function isStandalone(): boolean {
  return (navigator as { standalone?: boolean }).standalone === true
    || window.matchMedia('(display-mode: standalone)').matches;
}

export default function InstallBanner() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [offline,  setOffline]  = useState(!navigator.onLine);

  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY)) return;

    if (isIos()) {
      if (!isStandalone()) setShowIosHelp(true);
      return;
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline  = () => setOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online',  goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online',  goOnline);
    };
  }, []);

  const dismiss = () => {
    setDeferred(null);
    setShowIosHelp(false);
    localStorage.setItem(DISMISSED_KEY, '1');
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === 'accepted') setDeferred(null);
  };

  return (
    <>
      {/* Offline indicator */}
      {offline && (
        <div className="fixed top-0 inset-x-0 z-[9999] bg-amber-500 text-white text-xs font-medium py-1.5 text-center">
          You're offline — showing cached data
        </div>
      )}

      {/* Install prompt */}
      {deferred && !offline && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-[9998] bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 flex items-start gap-3 animate-slide-up">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
            <Download size={18} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">Install Assaan</p>
            <p className="text-xs text-gray-500 mt-0.5">Add to home screen for faster access — works offline too</p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={install}
                className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition"
              >
                Install
              </button>
              <button
                onClick={dismiss}
                className="px-3 py-1.5 text-gray-500 text-xs hover:bg-gray-50 rounded-lg transition border border-gray-200"
              >
                Not now
              </button>
            </div>
          </div>
          <button onClick={dismiss} className="text-gray-300 hover:text-gray-500 shrink-0">
            <X size={14} />
          </button>
        </div>
      )}

      {/* iOS has no install prompt API — walk through the manual Share step instead */}
      {showIosHelp && !offline && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-[9998] bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 flex items-start gap-3 animate-slide-up">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
            <Download size={18} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">Install Assaan</p>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              Niche <Share size={12} className="inline -mt-0.5 mx-0.5" /> Share button dabayein, phir
              {' '}<strong className="text-gray-700">"Add to Home Screen"</strong> chunein.
            </p>
            <button
              onClick={dismiss}
              className="mt-3 px-3 py-1.5 text-gray-500 text-xs hover:bg-gray-50 rounded-lg transition border border-gray-200"
            >
              Samajh gaya
            </button>
          </div>
          <button onClick={dismiss} className="text-gray-300 hover:text-gray-500 shrink-0">
            <X size={14} />
          </button>
        </div>
      )}
    </>
  );
}
