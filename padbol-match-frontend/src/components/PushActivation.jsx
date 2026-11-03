import React, {useEffect, useState} from 'react';
import {crmAdminApi} from '../utils/crmAdminApi';

// Activa las notificaciones del CRM en la PWA instalada (iPhone incluido).
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
  const supported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;

  useEffect(() => {
    (async () => {
      if (!supported) return setState({status: 'unsupported', message: 'Este navegador no permite notificaciones. En iPhone, abrí el CRM desde el ícono instalado en la pantalla de inicio.'});
      try {
        const config = await crmAdminApi.pushConfig(token);
        if (!config?.enabled) return setState({status: 'disabled', message: 'El servidor todavía no tiene las claves de notificación configuradas.'});
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        if (sub) return setState({status: 'active', message: 'Notificaciones activadas en este dispositivo.'});
        setState({status: 'idle', message: 'Activá las notificaciones para recibir leads y recordatorios en este teléfono.'});
      } catch (error) {
        setState({status: 'error', message: error?.message || 'No se pudo consultar el estado de las notificaciones.'});
      }
    })();
    return undefined;
  }, [token, supported]);

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

  const ok = state.status === 'active';
  return (
    <div className="push-activation" style={{position:'relative', display:'inline-flex', alignItems:'center'}}>
      <button
        type="button"
        onClick={() => (ok ? setState({...state, open: !state.open}) : activate())}
        disabled={state.status === 'working'}
        title={ok ? 'Notificaciones activadas' : 'Activar notificaciones'}
        aria-label={ok ? 'Notificaciones activadas' : 'Activar notificaciones'}
        style={{background:'transparent', border:'none', cursor:'pointer', padding:'4px 6px', fontSize:'20px', lineHeight:1, display:'inline-flex', alignItems:'center', gap:2}}
      >
        <span aria-hidden>🔔</span>
        {ok ? <span aria-hidden style={{color:'#22c55e', fontSize:'13px', fontWeight:700}}>✓</span>
            : <span aria-hidden style={{color:'#ef4444', fontSize:'13px', fontWeight:700}}>!</span>}
      </button>
      {state.message && (
        <div role="status" style={{position:'absolute', top:'100%', right:0, zIndex:20, width:'min(280px, 80vw)',
          background:'#0b1324', color:'#fff', border:'1px solid rgba(255,255,255,.15)', borderRadius:8,
          padding:'8px 10px', fontSize:'12px', lineHeight:1.35, marginTop:4}}>
          {state.message}
        </div>
      )}
    </div>
  );
}
