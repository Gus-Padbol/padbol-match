import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  return [...map.values()].sort((a, b) => String(a?.nombre || '').localeCompare(String(b?.nombre || ''), 'es'));
}

const LICENCIA_TIPO_OPTIONS = [
  { id: 'club_afiliado', label: 'Club Afiliado', alcance: 'sede' },
  { id: 'padbol_point', label: 'Padbol Point Franquicia', alcance: 'sede' },
  { id: 'master_ciudad', label: 'Master Ciudad', alcance: 'ciudad' },
  { id: 'master_provincia', label: 'Master Provincia / Estado', alcance: 'provincia' },
  { id: 'master_pais', label: 'Master País / Nacional', alcance: 'pais' },
];

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
  fecha_inicio_contrato: '',
  fecha_vencimiento_contrato: '',
  referencia_contrato: '',
  metodo_pago: 'mercadopago',
  stripe_account_id: '',
  mp_access_token: '',
  pago_manual_instrucciones: '',
  tipo_licencia: 'club_afiliado',
  ciudad_representa: '',
  provincia_representa: '',
  pais_representa: 'Argentina',
  licenciatario_nombre: '',
  licenciatario_email: '',
  licenciatario_telefono: '',
  licenciatario_pais: 'Argentina',
});

async function fetchWithAuth(url, options = {}) {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess?.session?.access_token;
  if (!token) throw new Error('Sesión no disponible');
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers = {
    Authorization: `Bearer ${token}`,
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
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
  const location = useLocation();
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
  const [contratoFile, setContratoFile] = useState(null);

  const paises = useMemo(() => paisesOpciones(), []);
  const licenciaTipoActual = useMemo(
    () => LICENCIA_TIPO_OPTIONS.find((x) => x.id === form.tipo_licencia) || LICENCIA_TIPO_OPTIONS[0],
    [form.tipo_licencia]
  );

  const setField = useCallback((k, v) => {
    setForm((prev) => ({ ...prev, [k]: v }));
  }, []);

  useEffect(() => {
    const pre = location.state?.prefillSolicitud;
    if (!pre || typeof pre !== 'object') return;
    setForm((prev) => ({
      ...prev,
      nombre: String(pre.nombre_club || pre.club_nombre || '').trim() || prev.nombre,
      pais: String(pre.pais || '').trim() || prev.pais,
      ciudad: String(pre.ciudad || '').trim() || prev.ciudad,
      licenciatario_nombre: String(pre.responsable_nombre || '').trim() || prev.licenciatario_nombre,
      licenciatario_email: String(pre.email || '').trim().toLowerCase() || prev.licenciatario_email,
      licenciatario_telefono: String(pre.whatsapp || '').trim() || prev.licenciatario_telefono,
      tipo_licencia: (() => {
        const t = String(pre.tipo_interes || '').trim().toLowerCase();
        if (!t || t === 'pendiente_definicion') return prev.tipo_licencia;
        if (t.includes('master')) return 'master_pais';
        if (t.includes('point')) return 'padbol_point';
        return prev.tipo_licencia;
      })(),
    }));
  }, [location.state]);

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
    if (!form.fecha_inicio_contrato) {
      setErr('La fecha de inicio de contrato es obligatoria.');
      return;
    }
    if (licenciaTipoActual.alcance === 'ciudad' && !form.ciudad_representa.trim()) {
      setErr('Para Master Ciudad debes indicar la ciudad que representa.');
      return;
    }
    if (licenciaTipoActual.alcance === 'provincia' && !form.provincia_representa.trim()) {
      setErr('Para Master Provincia debes indicar la provincia/estado que representa.');
      return;
    }
    if (licenciaTipoActual.alcance === 'pais' && !form.pais_representa.trim()) {
      setErr('Para Master País debes indicar el país que representa.');
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
        fecha_inicio_contrato: form.fecha_inicio_contrato || null,
        fecha_vencimiento_contrato: form.fecha_vencimiento_contrato || null,
        referencia_contrato: form.referencia_contrato.trim() || null,
        metodo_pago: form.metodo_pago,
        stripe_account_id: form.stripe_account_id.trim() || null,
        mp_access_token: form.mp_access_token.trim() || null,
        pago_manual_instrucciones: form.pago_manual_instrucciones.trim() || null,
        tipo_licencia: LICENCIA_TIPO_OPTIONS.some((x) => x.id === form.tipo_licencia) ? form.tipo_licencia : 'club_afiliado',
        ciudad_representa: form.ciudad_representa.trim() || null,
        provincia_representa: form.provincia_representa.trim() || null,
        pais_representa: form.pais_representa.trim() || null,
        licenciatario_nombre: form.licenciatario_nombre.trim() || null,
        licenciatario_email: form.licenciatario_email.trim().toLowerCase(),
        licenciatario_telefono: form.licenciatario_telefono.trim() || null,
        licenciatario_pais: form.licenciatario_pais.trim() || null,
      };

      if (isSuper) {
        const created = await fetchWithAuth(`${apiBaseUrl}/api/admin/sedes-directa`, {
          method: 'POST',
          body: JSON.stringify(body),
        });
        if (created?.sede_id) {
          const fd = new FormData();
          fd.append('fecha_inicio', form.fecha_inicio_contrato);
          if (form.fecha_vencimiento_contrato) fd.append('fecha_vencimiento', form.fecha_vencimiento_contrato);
          if (form.referencia_contrato.trim()) fd.append('referencia', form.referencia_contrato.trim());
          if (contratoFile) fd.append('archivo', contratoFile, contratoFile.name || 'contrato');
          await fetchWithAuth(`${apiBaseUrl}/api/sedes/${created.sede_id}/contrato`, {
            method: 'POST',
            body: fd,
          });
        }
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
        No tienes permiso para esta sección.
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
        background: '#FFFFFF',
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
            border: '1px solid #e5e7eb',
            background: '#ffffff',
            color: '#111827',
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
                <option key={p.nombre} value={p.nombre}>
                  {p.bandera ? `${p.bandera} ` : ''}{p.nombre}
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
            <label style={{ ...labelStyle, marginTop: 12 }}>Fecha de inicio de contrato *</label>
            <input
              required
              style={inputStyle}
              type="date"
              value={form.fecha_inicio_contrato}
              onChange={(e) => setField('fecha_inicio_contrato', e.target.value)}
            />
            <label style={{ ...labelStyle, marginTop: 12 }}>Fecha de vencimiento de contrato</label>
            <input
              style={inputStyle}
              type="date"
              value={form.fecha_vencimiento_contrato}
              onChange={(e) => setField('fecha_vencimiento_contrato', e.target.value)}
            />
            <label style={{ ...labelStyle, marginTop: 12 }}>Número o referencia de contrato</label>
            <input
              style={inputStyle}
              value={form.referencia_contrato}
              onChange={(e) => setField('referencia_contrato', e.target.value)}
              placeholder="Ej: CT-2026-AR-0012"
            />
            <label style={{ ...labelStyle, marginTop: 12 }}>Archivo del contrato (PDF o imagen)</label>
            <input
              style={{ ...inputStyle, padding: '8px 10px' }}
              type="file"
              accept=".pdf,image/*"
              onChange={(e) => setContratoFile(e.target.files?.[0] || null)}
            />
            {contratoFile ? (
              <p style={{ margin: '6px 0 0', color: '#475569', fontSize: '12px' }}>
                Archivo seleccionado: {contratoFile.name}
              </p>
            ) : null}
            <label style={{ ...labelStyle, marginTop: 12 }}>Tipo</label>
            <select style={inputStyle} value={form.tipo_licencia} onChange={(e) => setField('tipo_licencia', e.target.value)}>
              {LICENCIA_TIPO_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p style={{ margin: '8px 0 0', color: '#475569', fontSize: '12px', fontWeight: 600 }}>
              Alcance resultante: {licenciaTipoActual.alcance}
            </p>
            {licenciaTipoActual.alcance === 'ciudad' ? (
              <>
                <label style={{ ...labelStyle, marginTop: 12 }}>Ciudad que representa</label>
                <input
                  style={inputStyle}
                  value={form.ciudad_representa}
                  onChange={(e) => setField('ciudad_representa', e.target.value)}
                />
              </>
            ) : null}
            {licenciaTipoActual.alcance === 'provincia' ? (
              <>
                <label style={{ ...labelStyle, marginTop: 12 }}>Provincia / Estado que representa</label>
                <input
                  style={inputStyle}
                  value={form.provincia_representa}
                  onChange={(e) => setField('provincia_representa', e.target.value)}
                />
              </>
            ) : null}
            {licenciaTipoActual.alcance === 'pais' ? (
              <>
                <label style={{ ...labelStyle, marginTop: 12 }}>País que representa</label>
                <select style={inputStyle} value={form.pais_representa} onChange={(e) => setField('pais_representa', e.target.value)}>
                  {paises.map((p) => (
                    <option key={`rep-${p.nombre}`} value={p.nombre}>
                      {p.bandera ? `${p.bandera} ` : ''}{p.nombre}
                    </option>
                  ))}
                </select>
              </>
            ) : null}
            <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '16px 0 12px' }} />
            <h3 style={{ margin: '0 0 10px', fontSize: '15px', color: '#0f172a' }}>Método de pago</h3>
            <label style={labelStyle}>Método</label>
            <select style={inputStyle} value={form.metodo_pago} onChange={(e) => setField('metodo_pago', e.target.value)}>
              <option value="mercadopago">Mercado Pago</option>
              <option value="stripe">Stripe</option>
              <option value="manual">Manual (transferencia u otras instrucciones)</option>
              <option value="efectivo">Efectivo en sede (sin pasarela ni fee 3%)</option>
            </select>
            {form.metodo_pago === 'mercadopago' ? (
              <>
                <label style={{ ...labelStyle, marginTop: 12 }}>Access Token Mercado Pago</label>
                <input
                  type="password"
                  style={inputStyle}
                  value={form.mp_access_token}
                  onChange={(e) => setField('mp_access_token', e.target.value)}
                  placeholder="APP_USR-..."
                />
              </>
            ) : null}
            {form.metodo_pago === 'stripe' ? (
              <>
                <label style={{ ...labelStyle, marginTop: 12 }}>Stripe Account ID</label>
                <input
                  style={inputStyle}
                  value={form.stripe_account_id}
                  onChange={(e) => setField('stripe_account_id', e.target.value)}
                  placeholder="acct_..."
                />
                <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#64748b' }}>
                  Conectar con Stripe (próximamente). Por ahora guardamos el Account ID manualmente.
                </p>
              </>
            ) : null}
            {form.metodo_pago === 'efectivo' ? (
              <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#64748b', lineHeight: 1.5 }}>
                Las reservas quedan en estado pendiente de cobro en el club; el jugador no paga online por Padbol Match.
              </p>
            ) : null}
            {form.metodo_pago === 'manual' ? (
              <>
                <label style={{ ...labelStyle, marginTop: 12 }}>Instrucciones para el jugador</label>
                <textarea
                  rows={4}
                  style={{ ...inputStyle, maxWidth: '100%', resize: 'vertical' }}
                  value={form.pago_manual_instrucciones}
                  onChange={(e) => setField('pago_manual_instrucciones', e.target.value)}
                  placeholder="Ej: Transferir a CBU ... y enviar comprobante por WhatsApp."
                />
              </>
            ) : null}
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
                <option key={`l-${p.nombre}`} value={p.nombre}>
                  {p.bandera ? `${p.bandera} ` : ''}{p.nombre}
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
              background: isSuper ? '#15803d' : '#E11B22',
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
