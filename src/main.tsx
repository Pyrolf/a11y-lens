import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { WorkbenchErrorBoundary } from './components/layout/WorkbenchErrorBoundary';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WorkbenchErrorBoundary>
      <App />
    </WorkbenchErrorBoundary>
  </StrictMode>,
);
