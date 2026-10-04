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

function VisibilityIcon({ visible }) {
  return visible ? (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 4.2A9.8 9.8 0 0112 4c6.5 0 10 8 10 8a15.7 15.7 0 01-2.1 3.2M6.2 6.2C3.5 8.1 2 12 2 12s3.5 8 10 8a9.8 9.8 0 005.1-1.4" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2 12s3.5-8 10-8 10 8 10 8-3.5 8-10 8S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export default function PasswordRecovery() {
  const navigate = useNavigate();
  const location = useLocation();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
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
    <img className="acceso-cuenta-recovery__logo" src="/brand/padbol-match-logo-positive.svg" alt="Padbol Match" />
    <section className="acceso-cuenta-panel acceso-cuenta-recovery__panel">
      <h1>Creá tu contraseña de QA</h1>
      <p>La definís una sola vez. Después ingresás normalmente con tu correo y esta contraseña.</p>
      <form onSubmit={submit}>
        <label htmlFor="qa-password">Nueva contraseña</label>
        <div className="acceso-cuenta-recovery__password-field">
          <input id="qa-password" className="acceso-cuenta-input" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" />
          <button type="button" className="acceso-cuenta-recovery__visibility" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Ocultar nueva contraseña' : 'Mostrar nueva contraseña'} aria-pressed={showPassword}>
            <VisibilityIcon visible={showPassword} />
          </button>
        </div>
        <label htmlFor="qa-password-confirm">Repetir contraseña</label>
        <div className="acceso-cuenta-recovery__password-field">
          <input id="qa-password-confirm" className="acceso-cuenta-input" type={showConfirm ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" />
          <button type="button" className="acceso-cuenta-recovery__visibility" onClick={() => setShowConfirm(value => !value)} aria-label={showConfirm ? 'Ocultar contraseña repetida' : 'Mostrar contraseña repetida'} aria-pressed={showConfirm}>
            <VisibilityIcon visible={showConfirm} />
          </button>
        </div>
        {error ? <p className="acceso-cuenta-message acceso-cuenta-message--error">{error}</p> : null}
        <button type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar contraseña e ingresar'}</button>
      </form>
    </section>
  </main>;
}
