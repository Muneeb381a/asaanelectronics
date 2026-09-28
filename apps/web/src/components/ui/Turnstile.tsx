import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: {
        sitekey: string;
        callback: (token: string) => void;
        'error-callback'?: () => void;
        'expired-callback'?: () => void;
        theme?: 'light' | 'dark' | 'auto';
      }) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

// Lets a form gate its submit button until a token exists — the widget's background
// verification takes a moment, and submitting before it finishes sends an empty
// token that the server has to reject and the user has to retry.
export function isTurnstileEnabled(): boolean {
  return !!SITE_KEY;
}

let scriptPromise: Promise<void> | null = null;
function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Turnstile'));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export interface TurnstileHandle {
  reset: () => void;
}

interface TurnstileProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
}

// Renders nothing when VITE_TURNSTILE_SITE_KEY isn't set — forms work exactly as
// before in any environment that hasn't configured Cloudflare Turnstile yet.
const Turnstile = forwardRef<TurnstileHandle, TurnstileProps>(function Turnstile({ onVerify, onExpire }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  useImperativeHandle(ref, () => ({
    reset: () => { if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current); },
  }));

  useEffect(() => {
    if (!SITE_KEY || !containerRef.current) return;
    let mounted = true;
    loadTurnstileScript()
      .then(() => {
        if (!mounted || !containerRef.current || !window.turnstile) return;
        widgetId.current = window.turnstile.render(containerRef.current, {
          sitekey: SITE_KEY,
          callback: onVerify,
          'expired-callback': onExpire,
        });
      })
      .catch(() => {});
    return () => {
      mounted = false;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!SITE_KEY) return null;
  return <div ref={containerRef} className="flex justify-center" />;
});

export default Turnstile;
