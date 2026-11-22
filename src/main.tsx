import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { WorkbenchErrorBoundary } from './components/layout/WorkbenchErrorBoundary';
import { startWebVitals } from './lib/webVitals';

startWebVitals();

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Offline support is progressive enhancement; never block app startup.
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WorkbenchErrorBoundary>
      <App />
    </WorkbenchErrorBoundary>
  </StrictMode>,
);
