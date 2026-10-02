import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './AccesoCuenta.css';
import { supabase } from '../supabaseClient';
import { handleAuthOnce } from '../utils/handleAuthOnce';

function safeDestination(search) {
  try {
    const value = new URLSearchParams(search).get('redirect') || '/admin';
    return value.startsWith('/') && !value.startsWith('//') ? value : '/admin';
  } catch { return '/admin'; }
}

export default function PasswordRecovery() {
  const navigate = useNavigate();
  const location = useLocation();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async event => {
    event.preventDefault(); setError('');
    if (password.length < 8) return setError('Usá al menos 8 caracteres.');
    if (password !== confirm) return setError('Las contraseñas no coinciden.');
    setBusy(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.user) return setError('El enlace venció o ya fue utilizado. Solicitá uno nuevo desde el acceso.');
      const { error: updateError } = await handleAuthOnce({ kind: 'updateUser', updates: { password } });
      if (updateError) return setError('No pudimos guardar la contraseña. Solicitá un enlace nuevo e intentá otra vez.');
      navigate(safeDestination(location.search), { replace: true });
    } finally { setBusy(false); }
  };
  return <main className="acceso-cuenta-page acceso-cuenta-recovery">
    <img className="acceso-cuenta-recovery__logo" src="/media/public-site/jero/padbol-match-logo-white.svg" alt="Padbol Match" />
    <section className="acceso-cuenta-panel acceso-cuenta-recovery__panel">
      <h1>Creá tu contraseña de QA</h1>
      <p>La definís una sola vez. Después ingresás normalmente con tu correo y esta contraseña.</p>
      <form onSubmit={submit}>
        <label htmlFor="qa-password">Nueva contraseña</label>
        <input id="qa-password" className="acceso-cuenta-input" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" />
        <label htmlFor="qa-password-confirm">Repetir contraseña</label>
        <input id="qa-password-confirm" className="acceso-cuenta-input" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" />
        {error ? <p className="acceso-cuenta-message acceso-cuenta-message--error">{error}</p> : null}
        <button type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar contraseña e ingresar'}</button>
      </form>
    </section>
  </main>;
}
