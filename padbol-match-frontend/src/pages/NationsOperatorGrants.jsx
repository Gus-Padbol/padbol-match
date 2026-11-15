import {useNationsOperatorText} from '../utils/nationsOperatorText';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { createNationsOperatorApi } from '../utils/nationsOperatorApi';
import './NationsOperator.css';
export default function NationsOperatorGrants() {
 const t=useNationsOperatorText();
  const {
      session
    } = useAuth(),
    token = session?.access_token || '';
  const api = useMemo(() => createNationsOperatorApi(token), [token]);
  const [grants, setGrants] = useState(null),
    [email, setEmail] = useState(''),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  const generation = useRef(0),
    pending = useRef(false);
  useEffect(() => {
    const mine = ++generation.current,
      controller = new AbortController();
    setGrants(null);
    setEmail('');
    setError('');
    setNotice('');
    setBusy(false);
    pending.current = false;
    if (token) api.grants(controller.signal).then(data => {
      if (mine === generation.current) setGrants(data.grants);
    }).catch(e => {
      if (e.name !== 'AbortError' && mine === generation.current) setError(e.message);
    });
    return () => {
      generation.current = mine + 1;
      controller.abort();
    };
  }, [api, token]);
  async function execute(action) {
    if (pending.current) return;
    const mine = generation.current;
    pending.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
      const data = await api.grants();
      if (mine === generation.current) {
        setGrants(data.grants);
        setEmail('');
        setNotice(t("Acceso actualizado. No se envi\xF3 ning\xFAn correo ni se modific\xF3 el rol general de la cuenta."));
      }
    } catch (e) {
      if (mine === generation.current) setError(e.message);
    } finally {
      if (mine === generation.current) {
        pending.current = false;
        setBusy(false);
      }
    }
  }
  return <main className="nations-operator"><h1>{t("Responsable del torneo 57")}</h1><p>{t("Habilita \xFAnicamente la cuenta verificada de la persona designada. Tendr\xE1 operaci\xF3n de N\xE1poles, sin administraci\xF3n general. El acceso caduca despu\xE9s del evento y puede revocarse aqu\xED.")}</p>{error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}{!token ? <p>{t("Inicia sesi\xF3n con la cuenta de la organizaci\xF3n.")}</p> : grants === null && !error ? <p role="status">{t("Comprobando acceso de la organizaci\xF3n\u2026")}</p> : null}
 {grants !== null && <><form onSubmit={e => {
        e.preventDefault();
        execute(() => api.grant(email.trim()));
      }}><label>{t("Correo del responsable")}<input type="email" required value={email} disabled={busy} onChange={e => setEmail(e.target.value)} /></label><button disabled={busy || !email.trim()}>{t("Habilitar s\xF3lo el torneo 57")}</button></form><p>{t("Si todav\xEDa no tiene cuenta, debe registrarse normalmente y verificar el correo. No se crean contrase\xF1as ni permisos generales.")}</p><ul>{grants.map(grant => <li key={grant.id}><strong>{grant.email}</strong> · {grant.revoked_at ? t("Revocado") : `${t("Hasta")} ${new Date(grant.expires_at).toLocaleString()}`} {!grant.revoked_at && <button disabled={busy} onClick={() => execute(() => api.revoke(grant.id))}>{t("Revocar acceso")}</button>}</li>)}</ul><a href="/nations/operador">{t("Abrir dashboard exclusivo")}</a></>}
 </main>;
}
