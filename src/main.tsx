import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './index.css';
import { RootApp } from './RootApp';
import { registerPushServiceWorker } from './services/push-notifications';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootApp />
  </StrictMode>,
);

if (
  'serviceWorker' in navigator
  && 'PushManager' in window
  && 'Notification' in window
) {
  void registerPushServiceWorker().catch(() => {
    // La Player App resta utilizzabile anche se il browser non abilita la PWA.
  });
}
