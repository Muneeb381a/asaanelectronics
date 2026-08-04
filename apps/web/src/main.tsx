import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import App from './App.tsx';
import './index.css';

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
      <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
    </QueryClientProvider>
  </StrictMode>,
);
