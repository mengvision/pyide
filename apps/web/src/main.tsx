import React from 'react';
import ReactDOM from 'react-dom/client';
import { PlatformProvider, WebPlatformService } from '@pyide/platform';
import App from './App';

// Import shared styles from desktop (order matters: theme → global → web overrides)
import '@desktop/styles/theme.css';
import '@desktop/styles/global.css';
// Web-specific style overrides (applied last so they take precedence)
import './styles/web.css';

// The API base URL can be configured via environment variable.
// In dev, Vite proxies /api → http://localhost:8000, so an empty string works.
const apiUrl = import.meta.env.VITE_API_URL ?? '';
const platform = new WebPlatformService(apiUrl);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <PlatformProvider platform={platform}>
      <App />
    </PlatformProvider>
  </React.StrictMode>,
);
