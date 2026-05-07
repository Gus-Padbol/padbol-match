import './utils/ignoreResizeObserver';
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { AuthProvider } from './context/AuthContext';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

/** PWA: service worker solo en producción (evita caché raro en `npm start`). Requiere HTTPS en el host. */
if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const base = String(process.env.PUBLIC_URL || '').replace(/\/$/, '');
    const swUrl = `${base}/sw.js`;
    navigator.serviceWorker.register(swUrl).catch(() => {
      /* sin SW la app sigue siendo usable; el manifest igual permite atajo en algunos navegadores */
    });
  });
}
