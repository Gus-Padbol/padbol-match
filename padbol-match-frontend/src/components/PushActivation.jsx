import React, {useEffect, useState} from 'react';
import {crmAdminApi} from '../utils/crmAdminApi';

// Activa las notificaciones del CRM en la PWA instalada (iPhone incluido).
function fromBase64(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
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
      const config = await crmAdminApi.pushConfig(token);
      if (!config?.enabled || !config.publicKey) throw new Error('El servidor no tiene la clave pública configurada.');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        return setState({status: 'blocked', message: 'Permiso de notificaciones bloqueado. En iPhone: Ajustes → Notificaciones → PADBOL CRM → Permitir. Luego recargá esta pantalla.'});
      }
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.subscribe({userVisibleOnly: true, applicationServerKey: fromBase64(config.publicKey)});
      await crmAdminApi.pushSubscribe(token, subscription.toJSON());
      setState({status: 'active', message: 'Notificaciones activadas en este dispositivo.'});
    } catch (error) {
      setState({status: 'error', message: error?.message || 'No se pudieron activar las notificaciones.'});
    }
  }

  return (
    <div className="push-activation">
      <strong>Notificaciones del CRM</strong>
      <p>{state.message}</p>
      {(state.status === 'idle' || state.status === 'error') && (
        <button type="button" onClick={activate}>Activar notificaciones</button>
      )}
      {state.status === 'working' && <button type="button" disabled>Activando…</button>}
      {state.status === 'active' && <span role="status">✅ Activadas</span>}
    </div>
  );
}
