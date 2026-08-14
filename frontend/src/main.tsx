import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { App } from './App';
import { loadRuntimeConfig } from './lib/runtime-config';
import { useUiStore } from './stores/ui-store';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found');
}

// 同步主题到 html，避免等待 React 挂载时出现浅色闪烁
useUiStore.persist.rehydrate();
document.documentElement.classList.toggle('dark', useUiStore.getState().theme === 'dark');

loadRuntimeConfig().then(() => {
  createRoot(rootElement).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
        <Toaster position="top-right" richColors closeButton />
      </QueryClientProvider>
    </StrictMode>,
  );
});
