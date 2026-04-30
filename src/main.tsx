import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { handleGlobalError } from './utils/errorHandler';
import './index.css';
import 'ol/ol.css';

// Global error listeners for unhandled exceptions outside React
window.addEventListener('unhandledrejection', (event) => {
  // Prevent the default browser console error (red text)
  event.preventDefault();
  
  const error = event.reason || new Error('Unknown unhandled promise rejection');
  
  // Only handle if it's not already handled by React Query or other systems
  if (error && (error as any).__handled) return;
  
  // Ignore harmless extension/network aborted promises to reduce console noise
  const errMsg = error.message || String(error);
  if (errMsg.includes('aborted') || errMsg.includes('Network Error')) return;
  
  // Natively log to console without triggering the database/Toast UI
  console.warn('[Benign Unhandled Promise]', error);
});

window.addEventListener('error', (event) => {
  // Prevent the default browser console error
  event.preventDefault();
  
  const error = event.error || new Error(event.message || 'Unknown uncaught exception');
  if (error && (error as any).__handled) return;
  
  // Ignore ResizeObserver loop limit exceeded (benign React warning)
  if (event.message && event.message.includes('ResizeObserver loop')) return;
  
  handleGlobalError(error, 'Uncaught Exception');
});

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.meta?.suppressGlobalError) return;
      handleGlobalError(error, 'Query Error');
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (mutation.meta?.suppressGlobalError) return;
      handleGlobalError(error, 'Mutation Error');
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster 
        position="top-center" 
        containerClassName="toast-container"
        gutter={8}
        toastOptions={{
          className: 'font-bold text-sm select-none shadow-2xl border border-gray-800 bg-[#1E1E2D] text-white',
          duration: 4000,
          style: {
            background: '#1E1E2D',
            color: '#fff',
            border: '1px solid #374151',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            duration: 5000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
    </QueryClientProvider>
  </ErrorBoundary>
);

