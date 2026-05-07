import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { HUB_CONTENT_PADDING_BOTTOM_PX, hubContentPaddingTopCss } from '../constants/hubLayout';
import { PAISES_TELEFONO_OTROS, PAISES_TELEFONO_PRINCIPALES } from '../constants/paisesTelefono';

const API_BASE =
  typeof process !== 'undefined' && process.env.REACT_APP_API_BASE_URL
    ? String(process.env.REACT_APP_API_BASE_URL).replace(/\/$/, '')
    : 'https://padbol-backend.onrender.com';

function countries() {
  const m = new Map();
  [...PAISES_TELEFONO_PRINCIPALES, ...PAISES_TELEFONO_OTROS].forEach((p) => {
    if (p?.nombre) m.set(p.nombre, p);
  });
  return [...m.values()].sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'));
}

export default function UnirsePage() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [form, setForm] = useState({
    club_nombre: '',
    pais: 'Argentina',
    ciudad: '',
    responsable_nombre: '',
    email: '',
    whatsapp: '',
    cantidad_canchas: '',
    tipo_interes: 'Club Afiliado',
    mensaje: '',
  });
  const paises = useMemo(() => countries(), []);

  const onField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    setMsg('');
    if (!form.club_nombre.trim() || !form.pais.trim() || !form.ciudad.trim() || !form.responsable_nombre.trim() || !form.email.trim() || !form.whatsapp.trim()) {
      setErr('Completá todos los campos obligatorios.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/solicitudes-licencia`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          cantidad_canchas:
            form.cantidad_canchas != null && String(form.cantidad_canchas).trim() !== ''
              ? parseInt(String(form.cantidad_canchas), 10)
              : null,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || res.statusText);
      setMsg('Solicitud enviada. Te contactaremos pronto.');
      setForm((p) => ({ ...p, club_nombre: '', ciudad: '', responsable_nombre: '', email: '', whatsapp: '', cantidad_canchas: '', mensaje: '' }));
    } catch (e2) {
      setErr(e2?.message || 'No se pudo enviar la solicitud');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    width: '100%',
    maxWidth: '520px',
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid #cbd5e1',
    fontSize: '15px',
    boxSizing: 'border-box',
  };
  const labelStyle = { display: 'block', fontWeight: 700, color: '#1e293b', marginBottom: '6px', fontSize: '14px' };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg,#667eea,#764ba2)',
        paddingTop: hubContentPaddingTopCss('/unirse'),
        paddingBottom: `${HUB_CONTENT_PADDING_BOTTOM_PX}px`,
      }}
    >
      <AppHeader title="Unirse" onBack={() => navigate(-1)} />
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '16px' }}>
        <img src="/logo-padbol-match.png" alt="Padbol Match" style={{ width: '160px', display: 'block', marginBottom: '16px' }} />
        <h1 style={{ color: '#fff', margin: '0 0 8px' }}>Sumá tu club a Padbol Match</h1>
        <p style={{ color: 'rgba(255,255,255,0.92)', margin: '0 0 16px', lineHeight: 1.5 }}>
          Gestioná reservas, torneos y ranking global en una sola plataforma para potenciar tu comunidad.
        </p>

        {err ? <div style={{ background: '#fef2f2', color: '#991b1b', padding: '10px 12px', borderRadius: 10, marginBottom: 10 }}>{err}</div> : null}
        {msg ? <div style={{ background: '#ecfdf5', color: '#065f46', padding: '10px 12px', borderRadius: 10, marginBottom: 10 }}>{msg}</div> : null}

        <form onSubmit={onSubmit} style={{ background: '#fff', borderRadius: '14px', padding: '18px', boxSizing: 'border-box' }}>
          <label style={labelStyle}>Nombre del club *</label>
          <input style={inputStyle} value={form.club_nombre} onChange={(e) => onField('club_nombre', e.target.value)} required />

          <label style={{ ...labelStyle, marginTop: 12 }}>País *</label>
          <select style={inputStyle} value={form.pais} onChange={(e) => onField('pais', e.target.value)} required>
            {paises.map((p) => (
              <option key={p.nombre} value={p.nombre}>
                {p.bandera ? `${p.bandera} ` : ''}{p.nombre}
              </option>
            ))}
          </select>

          <label style={{ ...labelStyle, marginTop: 12 }}>Ciudad *</label>
          <input style={inputStyle} value={form.ciudad} onChange={(e) => onField('ciudad', e.target.value)} required />

          <label style={{ ...labelStyle, marginTop: 12 }}>Nombre del responsable *</label>
          <input style={inputStyle} value={form.responsable_nombre} onChange={(e) => onField('responsable_nombre', e.target.value)} required />

          <label style={{ ...labelStyle, marginTop: 12 }}>Email *</label>
          <input type="email" style={inputStyle} value={form.email} onChange={(e) => onField('email', e.target.value)} required />

          <label style={{ ...labelStyle, marginTop: 12 }}>WhatsApp (código país) *</label>
          <input style={inputStyle} value={form.whatsapp} onChange={(e) => onField('whatsapp', e.target.value)} placeholder="+549..." required />

          <label style={{ ...labelStyle, marginTop: 12 }}>Cantidad de canchas</label>
          <input type="number" min="0" style={inputStyle} value={form.cantidad_canchas} onChange={(e) => onField('cantidad_canchas', e.target.value)} />

          <label style={{ ...labelStyle, marginTop: 12 }}>Tipo de interés</label>
          <select style={inputStyle} value={form.tipo_interes} onChange={(e) => onField('tipo_interes', e.target.value)}>
            <option value="Club Afiliado">Club Afiliado</option>
            <option value="Padbol Point Franquicia">Padbol Point Franquicia</option>
            <option value="Master Nacional">Master Nacional</option>
          </select>

          <label style={{ ...labelStyle, marginTop: 12 }}>Mensaje adicional</label>
          <textarea rows={4} style={{ ...inputStyle, maxWidth: '100%', resize: 'vertical' }} value={form.mensaje} onChange={(e) => onField('mensaje', e.target.value)} />

          <button
            type="submit"
            disabled={saving}
            style={{
              marginTop: '16px',
              width: '100%',
              maxWidth: '520px',
              padding: '13px 16px',
              border: 'none',
              borderRadius: '10px',
              background: '#4f46e5',
              color: '#fff',
              fontWeight: 800,
              fontSize: '15px',
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Enviando…' : 'Enviar solicitud'}
          </button>
        </form>
      </div>
    </div>
  );
}
