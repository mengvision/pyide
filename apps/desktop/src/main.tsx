import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { PlatformProvider, TauriPlatformService } from '@pyide/platform';

const platform = new TauriPlatformService();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <PlatformProvider platform={platform}>
      <App />
    </PlatformProvider>
  </React.StrictMode>,
);
