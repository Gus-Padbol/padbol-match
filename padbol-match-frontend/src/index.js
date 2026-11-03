

// Padbol Match frontend entry point.
import './utils/ignoreResizeObserver';
import React from 'react';
import ReactDOM from 'react-dom/client';
/** i18n antes de App: init + react-i18next (useSuspense: false en ./i18n/index.js). */
import './i18n';
import './index.css';
import './components/torneo/NationsCupPanel.css';
import './styles/TournamentParticipants.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { AuthProvider } from './context/AuthContext';
import { PadbolI18nProvider } from './context/PadbolI18nContext';
import { ThemeProvider } from './context/ThemeContext';
import { registerServiceWorker } from './registerServiceWorker';

// PADBOL CRM instalado en la pantalla de inicio: iOS arranca la app en la raiz
// ('/') porque el manifest con el que se instalo tenia start_url '/'. No hay
// storage compartido entre Safari y la app instalada, asi que la unica marca
// confiable es el modo standalone. Si la app instalada abre en la raiz, se va
// al CRM. El panel de administracion sigue accesible en /admin.
if (typeof window !== 'undefined' && window.navigator.standalone === true
  && (window.location.pathname === '/' || window.location.pathname === '')) {
  window.location.replace('/crm-leads');
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <PadbolI18nProvider>
          <App />
        </PadbolI18nProvider>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

registerServiceWorker();

// Actualizacion automatica de la app instalada: al abrir, busca una version
// nueva del service worker y recarga una sola vez cuando toma el control.
// Evita que un iPhone quede semanas con un bundle viejo en la pantalla de inicio.
if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
  let recargando = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (recargando) return;
    recargando = true;
    window.location.reload();
  });
  navigator.serviceWorker.getRegistration()
    .then((reg) => reg && reg.update())
    .catch(() => {});
}
