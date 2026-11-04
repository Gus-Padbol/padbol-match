import React, {useCallback, useEffect, useState} from 'react';
import {crmAdminApi} from '../utils/crmAdminApi';

// Activa las notificaciones del CRM en la PWA instalada (iPhone incluido) y
// muestra la bandeja de avisos de nuevos leads. La campana no depende de que
// el permiso push esté concedido: primero informa dentro del CRM.
function fromBase64(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}


// Ninguna espera puede quedar colgada: cada paso tiene tope y mensaje propio.
function withTimeout(promise, ms, code) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(Object.assign(new Error(code), {code})), ms)),
  ]);
}

export default function PushActivation({token}) {
  const [state, setState] = useState({status: 'loading', message: ''});
  const [panel, setPanel] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const supported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;

  const loadNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const result = await crmAdminApi.leadNotifications(token);
      setNotifications(result.notifications || []);
      setUnread(Number(result.unread) || 0);
    } catch { /* La campana no bloquea el CRM si el endpoint falla. */ }
  }, [token]);

  useEffect(() => {
    (async () => {
      if (!supported) return setState({status: 'unsupported', message: 'Este navegador no permite notificaciones. En iPhone, abrí el CRM desde el ícono instalado en la pantalla de inicio.'});
      try {
        const config = await crmAdminApi.pushConfig(token);
        if (!config?.enabled) return setState({status: 'disabled', message: 'El servidor todavía no tiene las claves de notificación configuradas.'});
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        if (sub) {
          try {
            await crmAdminApi.pushSubscribe(token, sub.toJSON());
            return setState({status: 'active', message: 'Notificaciones activadas en este dispositivo.'});
          } catch {
            return setState({status: 'idle', message: 'Este dispositivo todavía no está registrado en el servidor. Tocá para completar el registro.'});
          }
        }
        setState({status: 'idle', message: 'Activá las notificaciones para recibir leads y recordatorios en este teléfono.'});
      } catch (error) {
        setState({status: 'error', message: error?.message || 'No se pudo consultar el estado de las notificaciones.'});
      }
    })();
    return undefined;
  }, [token, supported]);

  useEffect(() => {
    loadNotifications();
    const timer = setInterval(loadNotifications, 60000);
    const onFocus = () => loadNotifications();
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(timer); window.removeEventListener('focus', onFocus); };
  }, [loadNotifications]);

  async function activate() {
    setState({status: 'working', message: 'Activando…'});
    try {
      const config = await withTimeout(crmAdminApi.pushConfig(token), 15000, 'TIMEOUT_CONFIG');
      if (!config?.enabled || !config.publicKey) throw new Error('El servidor no tiene la clave pública configurada.');
      const permission = await withTimeout(Notification.requestPermission(), 20000, 'TIMEOUT_PERMISO');
      if (permission !== 'granted') {
        return setState({status: 'blocked', message: 'Permiso de notificaciones bloqueado. En iPhone: Ajustes → Notificaciones → PADBOL CRM → Permitir. Luego recargá esta pantalla.'});
      }
      const reg = await withTimeout(navigator.serviceWorker.register('/sw.js'), 20000, 'TIMEOUT_SW');
      await withTimeout(navigator.serviceWorker.ready, 20000, 'TIMEOUT_SW_LISTO');
      const subscription = await withTimeout(
        reg.pushManager.subscribe({userVisibleOnly: true, applicationServerKey: fromBase64(config.publicKey)}),
        25000, 'TIMEOUT_SUSCRIPCION');
      await withTimeout(crmAdminApi.pushSubscribe(token, subscription.toJSON()), 20000, 'TIMEOUT_REGISTRO');
      setState({status: 'active', message: 'Notificaciones activadas en este dispositivo.'});
    } catch (error) {
      const code = error?.code || '';
      const map = {
        TIMEOUT_CONFIG: 'El servidor no respondió al pedir la configuración. Revisá tu conexión e intentá otra vez.',
        TIMEOUT_PERMISO: 'El teléfono no respondió al pedido de permiso. Cerrá y volvé a abrir el CRM desde el ícono, e intentá de nuevo.',
        TIMEOUT_SW: 'No se pudo preparar la aplicación en segundo plano. Cerrá el CRM y abrila otra vez desde el ícono.',
        TIMEOUT_SW_LISTO: 'La aplicación no terminó de prepararse. Recargá la pantalla e intentá de nuevo.',
        TIMEOUT_SUSCRIPCION: 'El teléfono no completó el registro de notificaciones. Verificá que la app esté abierta desde el ícono y reintentá.',
        TIMEOUT_REGISTRO: 'No se pudo guardar el dispositivo en el servidor. Reintentá en unos segundos.',
      };
      setState({status: 'error', message: map[code] || error?.message || 'No se pudieron activar las notificaciones.'});
    }
  }

  async function openNotification(item) {
    try { await crmAdminApi.markLeadNotificationRead(token, item.id); } catch { /* se conserva visible */ }
    setNotifications(current => current.map(n => n.id === item.id ? {...n, read_at: n.read_at || new Date().toISOString()} : n));
    setUnread(current => Math.max(0, current - (item.read_at ? 0 : 1)));
    window.dispatchEvent(new CustomEvent('crm-open-notification', {detail:item}));
    setPanel(false);
  }

  const ok = state.status === 'active';
  return (
    <div className="push-activation" style={{position:'relative', display:'inline-flex', alignItems:'center'}}>
      <button
        type="button"
        onClick={() => setPanel(value => !value)}
        disabled={state.status === 'working'}
        aria-expanded={panel}
        title={state.message || (ok ? 'Notificaciones activadas' : 'Activar notificaciones')}
        aria-label={unread ? `Notificaciones, ${unread} sin leer` : 'Notificaciones'}
        style={{background:'transparent', border:'none', cursor:'pointer', padding:'4px 6px', fontSize:'20px', lineHeight:1, display:'inline-flex', alignItems:'center', gap:2, position:'relative'}}
      >
        <span aria-hidden>🔔</span>
        {unread > 0 ? <b className="crm-bell-count" aria-hidden>{unread > 9 ? '9+' : unread}</b> : null}
        {ok ? <span aria-hidden style={{color:'#22c55e', fontSize:'13px', fontWeight:700}}>✓</span>
            : <span aria-hidden style={{color:'#ef4444', fontSize:'13px', fontWeight:700}}>!</span>}
      </button>
      {panel && (
        <div className="crm-bell-panel" role="dialog" aria-label="Notificaciones del CRM">
          <header><strong>Notificaciones</strong><button type="button" onClick={() => setPanel(false)} aria-label="Cerrar notificaciones">×</button></header>
          {unread > 0 && <small>{unread} sin leer</small>}
          {notifications.length ? <ul>{notifications.slice(0,8).map(item => <li key={item.id}><button type="button" className={item.read_at ? '' : 'is-unread'} onClick={() => openNotification(item)}><strong>{item.title}</strong><span>{item.body}</span><time>{new Date(item.created_at).toLocaleString('es-AR')}</time></button></li>)}</ul> : <p>No hay avisos nuevos. Cuando ingrese un lead, va a aparecer acá.</p>}
          <footer>
            <span>{state.message}</span>
            {!ok && <button type="button" onClick={activate} disabled={state.status === 'working'}>{state.status === 'working' ? 'Activando…' : 'Activar push'}</button>}
          </footer>
        </div>
      )}
    </div>
  );
}
