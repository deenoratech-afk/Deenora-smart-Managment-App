
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

/**
 * SERVICE WORKER REGISTRATION WITH UPDATE DETECTION
 */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isSecureContext = window.isSecureContext;
    
    if (isSecureContext || isLocalhost) {
      navigator.serviceWorker.register('./sw.js')
        .then(registration => {
          console.log('SW registered:', registration.scope);
          
          // Listen for updates
          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (installingWorker == null) return;
            
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  // New content is available; please refresh.
                  console.log('New content is available; please refresh.');
                  // Optionally show a "Refresh" toast here.
                  // For now, we'll force a reload after a short delay to apply updates.
                  setTimeout(() => {
                    window.location.reload();
                  }, 1000);
                }
              }
            };
          };
        })
        .catch(err => {
          console.warn('Service Worker registration skipped (Environment limitation).', err.message);
        });
    }
  });
}
