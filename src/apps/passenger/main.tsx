import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../index.css';
import PassengerApp from './App';
import { ErrorBoundary } from '../../components/common/ErrorBoundary';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <PassengerApp />
    </ErrorBoundary>
  </StrictMode>
);
