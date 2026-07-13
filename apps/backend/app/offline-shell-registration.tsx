'use client';

import { useEffect } from 'react';

export default function OfflineShellRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') {
      void navigator.serviceWorker.getRegistrations().then((registrations) => Promise.all(
        registrations
          .filter((registration) => registration.active?.scriptURL.endsWith('/sw.js'))
          .map((registration) => registration.unregister()),
      ));
      if ('caches' in window) {
        void caches.keys().then((names) => Promise.all(
          names.filter((name) => name.startsWith('spice-')).map((name) => caches.delete(name)),
        ));
      }
      return;
    }
    void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error) => {
      console.warn('SPICE offline shell registration failed:', error);
    });
  }, []);

  return null;
}
