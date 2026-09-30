import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { z } from 'zod';
import { friendlyErrorMap, applyFriendlyZodMessages } from '@assaan/shared';
import App from './App.tsx';
import './index.css';
import { initAppearance } from './utils/themes.ts';

// Readable validation messages for both local form schemas and shared schemas.
z.setErrorMap(friendlyErrorMap);
applyFriendlyZodMessages();

// Apply the last-known shop theme/font immediately (before the authenticated
// shop-me query resolves) so returning users don't see a flash of the
// default look. DashboardLayout re-applies the authoritative server value.
initAppearance();

// Auto-reload when a lazy chunk is missing after a new deployment
window.addEventListener('vite:preloadError', () => window.location.reload());

// Register service worker for PWA / offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // SW registration failure is non-fatal — app still works online
    });
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,   // 5 min — data considered fresh, no refetch
      gcTime:    1000 * 60 * 10,  // 10 min — keep unused data in cache
      refetchOnWindowFocus: false, // don't refetch on every tab switch
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster
        position="top-right"
        gutter={8}
        toastOptions={{
          duration: 3000,
          style: { fontSize: '13px', borderRadius: '12px', padding: '10px 14px', maxWidth: '420px' },
          success: { duration: 2500, iconTheme: { primary: '#0E8A4C', secondary: '#fff' } },
          error:   { duration: 5500, iconTheme: { primary: '#D42828', secondary: '#fff' } },
        }}
      />
    </QueryClientProvider>
  </StrictMode>,
);
