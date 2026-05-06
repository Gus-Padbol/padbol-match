import React, { useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from './AppHeader';
import { HUB_CONTENT_PADDING_BOTTOM_PX, hubContentPaddingTopCss } from '../constants/hubLayout';
import { PAISES_TELEFONO_OTROS, PAISES_TELEFONO_PRINCIPALES } from '../constants/paisesTelefono';
import { useAuth } from '../context/AuthContext';
import useUserRole from '../hooks/useUserRole';
import { supabase } from '../supabaseClient';

const API_DEFAULT = 'https://padbol-backend.onrender.com';

const LEGACY_SUPER = [
  'padbolinternacional@gmail.com',
  'admin@padbol.com',
  'sm@padbol.com',
  'juanpablo@padbol.com',
];

function paisesOpciones() {
  const map = new Map();
  [...PAISES_TELEFONO_PRINCIPALES, ...PAISES_TELEFONO_OTROS].forEach((p) => {
    if (p?.nombre) map.set(p.nombre, p);
  });
  return [...map.keys()].sort((a, b) => a.localeCompare(b, 'es'));
}

const emptyForm = () => ({
  nombre: '',
  direccion: '',
  ciudad: '',
  provincia: '',
  pais: 'Argentina',
  latitud: '',
  longitud: '',
  horario_apertura: '',
  horario_cierre: '',
  precio_base: '',
  moneda: 'ARS',
  whatsapp: '',
  email_contacto: '',
  numero_licencia: '',
  fecha_contrato: '',
  tipo_licencia: 'club_afiliado',
  licenciatario_nombre: '',
  licenciatario_email: '',
  licenciatario_telefono: '',
  licenciatario_pais: 'Argentina',
});

async function fetchWithAuth(url, options = {}) {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess?.session?.access_token;
  if (!token) throw new Error('Sesión no disponible');
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...(options.headers || {}),
  };
  const res = await fetch(url, { ...options, headers });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || res.statusText || 'Error');
  return json;
}

/**
 * Alta de sede: admin_nacional → solicitud pendiente + WhatsApp a super admin.
 * super_admin → creación directa en `sedes` + `user_roles`.
 */
export default function NuevaSede({ apiBaseUrl = API_DEFAULT }) {
  const navigate = useNavigate();
  const { session } = useAuth();
  const currentCliente = useMemo(() => {
    const em = String(session?.user?.email || '').trim();
    if (!em) return null;
    return { email: em };
  }, [session?.user?.email]);
  const { rol, loading: roleLoading } = useUserRole(currentCliente);

  const emailLower = String(session?.user?.email || '').trim().toLowerCase();
  const isSuper = rol === 'super_admin' || LEGACY_SUPER.includes(emailLower);
  const isNacional = rol === 'admin_nacional';
  const puede = isSuper || isNacional;

  const [form, setForm] = useState(emptyForm);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const paises = useMemo(() => paisesOpciones(), []);

  const setField = useCallback((k, v) => {
    setForm((prev) => ({ ...prev, [k]: v }));
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    setMsg('');
    if (!form.nombre.trim()) {
      setErr('El nombre del club es obligatorio.');
      return;
    }
    if (!form.licenciatario_email.trim()) {
      setErr('El email del licenciatario es obligatorio.');
      return;
    }
    setSending(true);
    try {
      const body = {
        nombre: form.nombre.trim(),
        direccion: form.direccion.trim() || null,
        ciudad: form.ciudad.trim() || null,
        provincia: form.provincia.trim() || null,
        pais: form.pais.trim() || null,
        latitud: form.latitud,
        longitud: form.longitud,
        horario_apertura: form.horario_apertura.trim() || null,
        horario_cierre: form.horario_cierre.trim() || null,
        precio_base: form.precio_base,
        moneda: form.moneda,
        whatsapp: form.whatsapp.trim() || null,
        email_contacto: form.email_contacto.trim() || null,
        numero_licencia: isSuper ? form.numero_licencia.trim() || null : form.numero_licencia.trim() || null,
        fecha_contrato: form.fecha_contrato || null,
        tipo_licencia: form.tipo_licencia === 'padbol_point' ? 'padbol_point' : 'club_afiliado',
        licenciatario_nombre: form.licenciatario_nombre.trim() || null,
        licenciatario_email: form.licenciatario_email.trim().toLowerCase(),
        licenciatario_telefono: form.licenciatario_telefono.trim() || null,
        licenciatario_pais: form.licenciatario_pais.trim() || null,
      };

      if (isSuper) {
        await fetchWithAuth(`${apiBaseUrl}/api/admin/sedes-directa`, {
          method: 'POST',
          body: JSON.stringify(body),
        });
        setMsg('Sede creada. El licenciatario recibió aviso por WhatsApp (si había teléfono).');
      } else {
        await fetchWithAuth(`${apiBaseUrl}/api/admin/sedes-pendientes`, {
          method: 'POST',
          body: JSON.stringify(body),
        });
        setMsg('Solicitud enviada. Gus revisará y aprobará en breve.');
      }
      setTimeout(() => navigate('/admin?tab=resumen'), 2200);
    } catch (ex) {
      setErr(ex.message || String(ex));
    } finally {
      setSending(false);
    }
  };

  if (!session?.user) {
    return null;
  }
  if (roleLoading && !LEGACY_SUPER.includes(emailLower)) {
    return (
      <div style={{ minHeight: '100vh', padding: 24, color: '#fff', textAlign: 'center' }}>
        Cargando permisos…
      </div>
    );
  }
  if (!puede) {
    return (
      <div style={{ minHeight: '100vh', padding: 24, color: '#fff', textAlign: 'center' }}>
        No tenés permiso para esta sección.
        <button type="button" style={{ marginTop: 16, padding: '10px 16px' }} onClick={() => navigate('/admin')}>
          Volver al panel
        </button>
      </div>
    );
  }

  const inputStyle = {
    width: '100%',
    maxWidth: '420px',
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid #cbd5e1',
    fontSize: '15px',
    boxSizing: 'border-box',
  };
  const labelStyle = { display: 'block', fontWeight: 700, color: '#1e293b', marginBottom: '6px', fontSize: '14px' };
  const sectionStyle = {
    background: '#fff',
    borderRadius: '14px',
    padding: '18px 16px',
    marginBottom: '16px',
    maxWidth: '520px',
    width: '100%',
    boxSizing: 'border-box',
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg,#667eea,#764ba2)',
        paddingTop: hubContentPaddingTopCss('/admin/nueva-sede'),
        paddingBottom: `${HUB_CONTENT_PADDING_BOTTOM_PX}px`,
        paddingLeft: 16,
        paddingRight: 16,
        boxSizing: 'border-box',
      }}
    >
      <AppHeader title="Nueva sede" showBack={false} adminPanelMinimalHeader />
      <div style={{ maxWidth: '560px', margin: '0 auto' }}>
        <button
          type="button"
          onClick={() => navigate('/admin')}
          style={{
            marginBottom: '14px',
            padding: '8px 14px',
            borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.35)',
            background: 'rgba(255,255,255,0.15)',
            color: '#fff',
            cursor: 'pointer',
            fontWeight: 700,
          }}
        >
          ← Volver al panel
        </button>

        {err ? (
          <div style={{ background: '#fef2f2', color: '#991b1b', padding: 12, borderRadius: 10, marginBottom: 12 }}>
            {err}
          </div>
        ) : null}
        {msg ? (
          <div style={{ background: '#ecfdf5', color: '#065f46', padding: 12, borderRadius: 10, marginBottom: 12 }}>
            {msg}
          </div>
        ) : null}

        <form onSubmit={onSubmit}>
          <div style={sectionStyle}>
            <h2 style={{ margin: '0 0 14px', fontSize: '18px', color: '#0f172a' }}>1 — Datos de la sede</h2>
            <label style={labelStyle}>Nombre del club *</label>
            <input
              required
              style={inputStyle}
              value={form.nombre}
              onChange={(e) => setField('nombre', e.target.value)}
            />
            <label style={{ ...labelStyle, marginTop: 12 }}>Dirección</label>
            <input style={inputStyle} value={form.direccion} onChange={(e) => setField('direccion', e.target.value)} />
            <label style={{ ...labelStyle, marginTop: 12 }}>Ciudad</label>
            <input style={inputStyle} value={form.ciudad} onChange={(e) => setField('ciudad', e.target.value)} />
            <label style={{ ...labelStyle, marginTop: 12 }}>Provincia / Estado / Región</label>
            <input
              style={inputStyle}
              value={form.provincia}
              onChange={(e) => setField('provincia', e.target.value)}
              placeholder="Opcional"
            />
            <label style={{ ...labelStyle, marginTop: 12 }}>País</label>
            <select style={inputStyle} value={form.pais} onChange={(e) => setField('pais', e.target.value)}>
              {paises.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 160px' }}>
                <label style={labelStyle}>Latitud</label>
                <input style={{ ...inputStyle, maxWidth: '100%' }} value={form.latitud} onChange={(e) => setField('latitud', e.target.value)} />
              </div>
              <div style={{ flex: '1 1 160px' }}>
                <label style={labelStyle}>Longitud</label>
                <input style={{ ...inputStyle, maxWidth: '100%' }} value={form.longitud} onChange={(e) => setField('longitud', e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 160px' }}>
                <label style={labelStyle}>Horario apertura</label>
                <input
                  style={{ ...inputStyle, maxWidth: '100%' }}
                  placeholder="ej. 09:00"
                  value={form.horario_apertura}
                  onChange={(e) => setField('horario_apertura', e.target.value)}
                />
              </div>
              <div style={{ flex: '1 1 160px' }}>
                <label style={labelStyle}>Horario cierre</label>
                <input
                  style={{ ...inputStyle, maxWidth: '100%' }}
                  placeholder="ej. 23:00"
                  value={form.horario_cierre}
                  onChange={(e) => setField('horario_cierre', e.target.value)}
                />
              </div>
            </div>
            <label style={{ ...labelStyle, marginTop: 12 }}>Precio base por turno</label>
            <input style={inputStyle} type="number" min="0" step="1" value={form.precio_base} onChange={(e) => setField('precio_base', e.target.value)} />
            <label style={{ ...labelStyle, marginTop: 12 }}>Moneda</label>
            <select style={inputStyle} value={form.moneda} onChange={(e) => setField('moneda', e.target.value)}>
              <option value="ARS">ARS</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
            <label style={{ ...labelStyle, marginTop: 12 }}>WhatsApp de contacto</label>
            <input style={inputStyle} value={form.whatsapp} onChange={(e) => setField('whatsapp', e.target.value)} />
            <label style={{ ...labelStyle, marginTop: 12 }}>Email de contacto</label>
            <input style={inputStyle} type="email" value={form.email_contacto} onChange={(e) => setField('email_contacto', e.target.value)} />
          </div>

          <div style={sectionStyle}>
            <h2 style={{ margin: '0 0 14px', fontSize: '18px', color: '#0f172a' }}>2 — Datos de licencia</h2>
            <label style={labelStyle}>Número de licencia {!isSuper ? '(solo super admin puede editar)' : null}</label>
            <input
              style={{ ...inputStyle, background: isSuper ? '#fff' : '#f1f5f9' }}
              readOnly={!isSuper}
              value={form.numero_licencia}
              onChange={(e) => isSuper && setField('numero_licencia', e.target.value)}
            />
            <label style={{ ...labelStyle, marginTop: 12 }}>Fecha de contrato</label>
            <input
              style={inputStyle}
              type="date"
              value={form.fecha_contrato}
              onChange={(e) => setField('fecha_contrato', e.target.value)}
            />
            <label style={{ ...labelStyle, marginTop: 12 }}>Tipo</label>
            <select style={inputStyle} value={form.tipo_licencia} onChange={(e) => setField('tipo_licencia', e.target.value)}>
              <option value="club_afiliado">Club Afiliado</option>
              <option value="padbol_point">Padbol Point</option>
            </select>
          </div>

          <div style={sectionStyle}>
            <h2 style={{ margin: '0 0 14px', fontSize: '18px', color: '#0f172a' }}>3 — Licenciatario</h2>
            <label style={labelStyle}>Nombre completo</label>
            <input style={inputStyle} value={form.licenciatario_nombre} onChange={(e) => setField('licenciatario_nombre', e.target.value)} />
            <label style={{ ...labelStyle, marginTop: 12 }}>Email * (futuro admin_club)</label>
            <input
              required
              type="email"
              style={inputStyle}
              value={form.licenciatario_email}
              onChange={(e) => setField('licenciatario_email', e.target.value)}
            />
            <label style={{ ...labelStyle, marginTop: 12 }}>Teléfono</label>
            <input style={inputStyle} value={form.licenciatario_telefono} onChange={(e) => setField('licenciatario_telefono', e.target.value)} />
            <label style={{ ...labelStyle, marginTop: 12 }}>País</label>
            <select
              style={inputStyle}
              value={form.licenciatario_pais}
              onChange={(e) => setField('licenciatario_pais', e.target.value)}
            >
              {paises.map((p) => (
                <option key={`l-${p}`} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={sending}
            style={{
              width: '100%',
              maxWidth: '520px',
              padding: '14px 18px',
              borderRadius: '12px',
              border: 'none',
              background: isSuper ? '#15803d' : '#4f46e5',
              color: '#fff',
              fontWeight: 800,
              fontSize: '16px',
              cursor: sending ? 'wait' : 'pointer',
              marginBottom: '24px',
            }}
          >
            {sending ? 'Enviando…' : isSuper ? 'Crear sede' : 'Enviar para aprobación'}
          </button>
        </form>
      </div>
    </div>
  );
}
