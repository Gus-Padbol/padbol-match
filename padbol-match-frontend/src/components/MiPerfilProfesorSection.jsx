import React, { useCallback, useEffect, useState } from 'react';
import { fetchMiPerfilProfesor, patchMiPerfilProfesor } from '../utils/clasesApi';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';

/**
 * Visible solo si GET /api/profesor/mi-perfil devuelve fila (profesores.user_id = auth.uid).
 * Requiere migración sql/profesores_user_id.sql y vincular user_id en la fila del profesor.
 */
export default function MiPerfilProfesorSection({ accessToken }) {
  const { t } = useTranslation();
  const [prof, setProf] = useState(null);
  const [loading, setLoading] = useState(true);
  const [whatsapp, setWhatsapp] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState('');

  const load = useCallback(async () => {
    if (!accessToken) {
      setProf(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setMsg('');
    try {
      const row = await fetchMiPerfilProfesor({ accessToken });
      setProf(row);
      setWhatsapp(String(row?.whatsapp || '').trim());
    } catch (e) {
      setProf(null);
      if (e?.message && !String(e.message).includes('404')) setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const guardar = async () => {
    setSaving(true);
    setMsg('');
    setOk('');
    try {
      const updated = await patchMiPerfilProfesor({
        accessToken,
        body: { whatsapp: String(whatsapp || '').trim() || null },
      });
      setProf(updated);
      setWhatsapp(String(updated?.whatsapp || '').trim());
      setOk(t('profesor.miPerfil.guardado'));
    } catch (e) {
      setMsg(e?.message || 'Error');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !prof) return null;

  const nombre =
    [String(prof.nombre || '').trim(), String(prof.apellido || '').trim()].filter(Boolean).join(' ') ||
    prof.nombre ||
    '—';

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '16px 20px',
        marginBottom: 16,
        boxShadow: '0 1px 6px rgba(0,0,0,0.07)',
      }}
    >
      <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
        {t('profesor.miPerfil.titulo')}
      </h3>
      <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
        {t('profesor.miPerfil.subtitulo', { nombre })}
        {prof.sede_nombre ? ` · ${prof.sede_nombre}` : ''}
      </p>
      {msg ? <p style={{ color: 'var(--pm-color-error, #dc2626)', fontSize: 13, marginBottom: 10 }}>{msg}</p> : null}
      {ok ? <p style={{ color: 'var(--pm-color-success, #16a34a)', fontSize: 13, marginBottom: 10, fontWeight: 600 }}>{ok}</p> : null}
      <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6, color: 'var(--text-primary)' }}>
        {t('profesor.miPerfil.whatsappLabel')}
      </label>
      <input
        type="tel"
        className="admin-mi-sede-theme-input"
        value={whatsapp}
        onChange={(e) => setWhatsapp(e.target.value)}
        placeholder="+54 9 221 000-0000"
        style={{
          width: '100%',
          boxSizing: 'border-box',
          minHeight: 44,
          padding: '10px 14px',
          marginBottom: 12,
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: 'var(--bg-input)',
          color: 'var(--text-primary)',
          fontSize: 16,
        }}
      />
      <button
        type="button"
        disabled={saving}
        onClick={() => void guardar()}
        style={{
          border: 'none',
          borderRadius: 10,
          padding: '12px 18px',
          background: 'var(--accent)',
          color: 'var(--bg-card)',
          fontWeight: 800,
          fontSize: 14,
          cursor: saving ? 'wait' : 'pointer',
          opacity: saving ? 0.7 : 1,
        }}
      >
        {saving ? t('admin.metricas.saving') : t('profesor.miPerfil.guardar')}
      </button>
    </div>
  );
}
