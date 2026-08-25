import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register Service Worker for PWA capabilities
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('PWA ServiceWorker registered successfully with scope:', registration.scope);
      })
      .catch((error) => {
        console.warn('PWA ServiceWorker registration warning:', error);
      });
  });
}

// Gracefully suppress benign Vite HMR WebSocket connection events in the preview container
if (typeof window !== 'undefined') {
  const origConsoleError = console.error;
  console.error = (...args: any[]) => {
    const text = args.map(a => (a && (a.message || a.stack || String(a))) || '').join(' ');
    if (text.includes('WebSocket') || text.includes('websocket') || text.includes('[vite]')) {
      return;
    }
    origConsoleError.apply(console, args);
  };

  window.addEventListener('unhandledrejection', (event) => {
    const reasonStr = event?.reason?.message || event?.reason?.toString?.() || '';
    if (reasonStr.includes('WebSocket') || reasonStr.includes('websocket') || reasonStr.includes('[vite]')) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  });

  window.addEventListener('error', (event) => {
    const msg = event?.message || (event?.error && event.error.message) || '';
    if (msg.includes('WebSocket') || msg.includes('websocket') || msg.includes('[vite]')) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

