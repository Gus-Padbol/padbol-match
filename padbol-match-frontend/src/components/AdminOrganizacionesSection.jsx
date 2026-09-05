import React, { useCallback, useEffect, useMemo, useState } from 'react';

const fieldStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  borderRadius: 9,
  border: '1px solid var(--border)',
  background: 'var(--bg-input)',
  color: 'var(--text-primary)',
  font: 'inherit',
};

const buttonStyle = {
  padding: '10px 14px',
  borderRadius: 9,
  border: '1px solid var(--border)',
  background: 'var(--accent)',
  color: '#fff',
  fontWeight: 800,
  cursor: 'pointer',
};

const FEATURES = [
  ['reservas', 'Reservas'],
  ['torneos', 'Torneos'],
  ['jugadores', 'Jugadores'],
  ['reportes', 'Reportes'],
  ['notificaciones', 'Notificaciones'],
  ['scoreboard', 'Marcador'],
];

const emptyOrganization = () => ({
  nombre: '',
  pais_principal: '',
  email_contacto: '',
  whatsapp_contacto: '',
  limite_sedes: 1,
  limite_canchas_total: 1,
  limite_admins_centrales: 1,
  funciones_habilitadas: ['reservas', 'torneos', 'jugadores', 'reportes'],
});

async function requestJson(url, accessToken, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error || 'No se pudo completar la operación');
  return json;
}

export default function AdminOrganizacionesSection({ apiBaseUrl, accessToken, sedes = [] }) {
  const [organizaciones, setOrganizaciones] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [magicLink, setMagicLink] = useState('');
  const [newOrg, setNewOrg] = useState(emptyOrganization);
  const [license, setLicense] = useState(null);
  const [sedeId, setSedeId] = useState('');
  const [admin, setAdmin] = useState({ nombre: '', email: '' });

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      const rows = await requestJson(`${apiBaseUrl}/api/admin/organizaciones`, accessToken);
      const list = Array.isArray(rows) ? rows : [];
      setOrganizaciones(list);
      setSelectedId((current) => (list.some((row) => row.id === current) ? current : list[0]?.id || ''));
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [accessToken, apiBaseUrl]);

  useEffect(() => { void load(); }, [load]);

  const selected = useMemo(
    () => organizaciones.find((row) => row.id === selectedId) || null,
    [organizaciones, selectedId],
  );
  useEffect(() => {
    if (!selected) return setLicense(null);
    setLicense({
      limite_sedes: Number(selected.limite_sedes) || 1,
      limite_canchas_total: Number(selected.limite_canchas_total) || 1,
      limite_admins_centrales: Number(selected.limite_admins_centrales) || 1,
      funciones_habilitadas: Array.isArray(selected.funciones_habilitadas) ? selected.funciones_habilitadas : [],
    });
  }, [selected]);
  const linkedIds = useMemo(
    () => new Set(organizaciones.flatMap((org) => (org.sedes || []).map((sede) => String(sede.id)))),
    [organizaciones],
  );
  const availableSedes = useMemo(
    () => sedes.filter((row) => !linkedIds.has(String(row.id))),
    [linkedIds, sedes],
  );

  const run = async (operation, successMessage) => {
    setSaving(true);
    setError('');
    setMessage('');
    setMagicLink('');
    try {
      const result = await operation();
      if (result?.magic_link) setMagicLink(result.magic_link);
      setMessage(successMessage);
      await load();
      return result;
    } catch (operationError) {
      setError(operationError.message);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const createOrganization = async (event) => {
    event.preventDefault();
    if (!newOrg.nombre.trim()) return setError('Escribí el nombre de la cadena.');
    const created = await run(
      () => requestJson(`${apiBaseUrl}/api/admin/organizaciones`, accessToken, {
        method: 'POST',
        body: JSON.stringify(newOrg),
      }),
      'Cadena creada. Ya podés vincular sedes y asignar su administrador central.',
    );
    if (created?.id) {
      setSelectedId(created.id);
      setNewOrg(emptyOrganization());
    }
  };

  const toggleFeature = (setter, feature) => {
    setter((current) => {
      const values = new Set(current.funciones_habilitadas || []);
      if (values.has(feature)) values.delete(feature); else values.add(feature);
      return { ...current, funciones_habilitadas: [...values] };
    });
  };

  const updateLicense = async (event) => {
    event.preventDefault();
    if (!selected || !license) return;
    await run(
      () => requestJson(`${apiBaseUrl}/api/admin/organizaciones/${selected.id}`, accessToken, {
        method: 'PATCH',
        body: JSON.stringify(license),
      }),
      'Cupos y funciones actualizados.',
    );
  };

  const linkVenue = async (event) => {
    event.preventDefault();
    if (!selected || !sedeId) return;
    const result = await run(
      () => requestJson(`${apiBaseUrl}/api/admin/organizaciones/${selected.id}/sedes`, accessToken, {
        method: 'POST',
        body: JSON.stringify({ sede_id: Number(sedeId) }),
      }),
      'Sede vinculada a la cadena.',
    );
    if (result) setSedeId('');
  };

  const addAdmin = async (event) => {
    event.preventDefault();
    if (!selected || !admin.email.trim()) return;
    const result = await run(
      () => requestJson(`${apiBaseUrl}/api/admin/organizaciones/${selected.id}/administradores`, accessToken, {
        method: 'POST',
        body: JSON.stringify(admin),
      }),
      'Administrador central asignado. Su acceso queda limitado a esta cadena.',
    );
    if (result) setAdmin({ nombre: '', email: '' });
  };

  return (
    <div className="section" data-testid="admin-organizaciones-section">
      <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: '0 0 6px' }}>Cadenas multisede</h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)', maxWidth: 720 }}>
            Cada administrador central ve únicamente las sedes vinculadas a su organización. Los administradores locales de cada sede se mantienen independientes.
          </p>
        </div>
        <button type="button" style={buttonStyle} onClick={load} disabled={loading || saving}>Actualizar</button>
      </div>

      {error ? <p role="alert" style={{ color: '#dc2626', fontWeight: 800 }}>{error}</p> : null}
      {message ? <p role="status" style={{ color: '#15803d', fontWeight: 800 }}>{message}</p> : null}
      {magicLink ? (
        <div style={{ padding: 12, borderRadius: 10, background: 'var(--bg-input)', border: '1px solid var(--border)', margin: '12px 0' }}>
          <strong>Enlace de acceso del administrador:</strong>{' '}
          <a href={magicLink} target="_blank" rel="noreferrer" style={{ overflowWrap: 'anywhere' }}>{magicLink}</a>
        </div>
      ) : null}

      <form onSubmit={createOrganization} style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))', marginTop: 20 }}>
        <label>Nombre de la cadena *<input style={fieldStyle} value={newOrg.nombre} onChange={(e) => setNewOrg((p) => ({ ...p, nombre: e.target.value }))} /></label>
        <label>País principal<input style={fieldStyle} value={newOrg.pais_principal} onChange={(e) => setNewOrg((p) => ({ ...p, pais_principal: e.target.value }))} /></label>
        <label>Email de contacto<input type="email" style={fieldStyle} value={newOrg.email_contacto} onChange={(e) => setNewOrg((p) => ({ ...p, email_contacto: e.target.value }))} /></label>
        <label>WhatsApp<input style={fieldStyle} value={newOrg.whatsapp_contacto} onChange={(e) => setNewOrg((p) => ({ ...p, whatsapp_contacto: e.target.value }))} /></label>
        <label>Máximo de sedes<input type="number" min="1" required style={fieldStyle} value={newOrg.limite_sedes} onChange={(e) => setNewOrg((p) => ({ ...p, limite_sedes: e.target.value }))} /></label>
        <label>Máximo total de canchas<input type="number" min="1" required style={fieldStyle} value={newOrg.limite_canchas_total} onChange={(e) => setNewOrg((p) => ({ ...p, limite_canchas_total: e.target.value }))} /></label>
        <label>Administradores centrales<input type="number" min="1" required style={fieldStyle} value={newOrg.limite_admins_centrales} onChange={(e) => setNewOrg((p) => ({ ...p, limite_admins_centrales: e.target.value }))} /></label>
        <fieldset style={{ gridColumn: '1 / -1', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
          <legend style={{ fontWeight: 800 }}>Funciones habilitadas</legend>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
            {FEATURES.map(([id, label]) => <label key={id}><input type="checkbox" checked={newOrg.funciones_habilitadas.includes(id)} onChange={() => toggleFeature(setNewOrg, id)} /> {label}</label>)}
          </div>
        </fieldset>
        <button type="submit" style={{ ...buttonStyle, alignSelf: 'end' }} disabled={saving}>Crear cadena</button>
      </form>

      {loading ? <p>Cargando cadenas…</p> : organizaciones.length === 0 ? <p style={{ color: 'var(--text-secondary)' }}>Todavía no hay cadenas creadas.</p> : (
        <div style={{ marginTop: 24 }}>
          <label style={{ display: 'grid', gap: 6, maxWidth: 520, fontWeight: 800 }}>
            Organización
            <select style={fieldStyle} value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              {organizaciones.map((org) => <option key={org.id} value={org.id}>{org.nombre}</option>)}
            </select>
          </label>

          {selected ? (
            <>
              <form onSubmit={updateLicense} style={{ marginTop: 18, padding: 16, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--bg-card)' }}>
                <h3 style={{ marginTop: 0 }}>Habilitación otorgada por Padbol Match</h3>
                <p style={{ color: 'var(--text-secondary)' }}>
                  Uso actual: <strong>{selected.resumen?.sedes_total || 0} de {selected.limite_sedes} sedes</strong> · <strong>{selected.resumen?.canchas_total || 0} de {selected.limite_canchas_total} canchas</strong> · <strong>{selected.administradores?.length || 0} de {selected.limite_admins_centrales} administradores centrales</strong>.
                </p>
                <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))' }}>
                  <label>Máximo de sedes<input type="number" min={selected.resumen?.sedes_total || 1} required style={fieldStyle} value={license?.limite_sedes || 1} onChange={(e) => setLicense((p) => ({ ...p, limite_sedes: e.target.value }))} /></label>
                  <label>Máximo total de canchas<input type="number" min={selected.resumen?.canchas_total || 1} required style={fieldStyle} value={license?.limite_canchas_total || 1} onChange={(e) => setLicense((p) => ({ ...p, limite_canchas_total: e.target.value }))} /></label>
                  <label>Administradores centrales<input type="number" min={selected.administradores?.length || 1} required style={fieldStyle} value={license?.limite_admins_centrales || 1} onChange={(e) => setLicense((p) => ({ ...p, limite_admins_centrales: e.target.value }))} /></label>
                </div>
                <fieldset style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, margin: '14px 0' }}>
                  <legend style={{ fontWeight: 800 }}>Funciones contratadas</legend>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
                    {FEATURES.map(([id, label]) => <label key={id}><input type="checkbox" checked={(license?.funciones_habilitadas || []).includes(id)} onChange={() => toggleFeature(setLicense, id)} /> {label}</label>)}
                  </div>
                </fieldset>
                <button type="submit" style={buttonStyle} disabled={saving}>Guardar habilitación</button>
              </form>
              <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', marginTop: 18 }}>
              <div style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--bg-card)' }}>
                <h3 style={{ marginTop: 0 }}>Sedes de {selected.nombre}</h3>
                {(selected.sedes || []).length === 0 ? <p style={{ color: 'var(--text-secondary)' }}>Sin sedes vinculadas.</p> : (
                  <ul style={{ paddingLeft: 20 }}>
                    {(selected.sedes || []).map((sede) => (
                      <li key={sede.id} style={{ marginBottom: 9 }}>
                        <strong>{sede.nombre}</strong> · {[sede.ciudad, sede.pais].filter(Boolean).join(', ') || 'Sin ubicación'}
                        <button
                          type="button"
                          onClick={() => run(
                            () => requestJson(`${apiBaseUrl}/api/admin/organizaciones/${selected.id}/sedes/${sede.id}`, accessToken, { method: 'DELETE' }),
                            'Sede desvinculada de la cadena.',
                          )}
                          style={{ marginLeft: 8, color: '#dc2626', background: 'transparent', border: 0, cursor: 'pointer', fontWeight: 800 }}
                        >Desvincular</button>
                      </li>
                    ))}
                  </ul>
                )}
                <form onSubmit={linkVenue} style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
                  <label style={{ flex: '1 1 220px' }}>Sumar sede existente
                    <select style={fieldStyle} value={sedeId} onChange={(e) => setSedeId(e.target.value)}>
                      <option value="">Elegir sede</option>
                      {availableSedes.map((sede) => <option key={sede.id} value={sede.id}>{sede.nombre} · {sede.ciudad || sede.pais || '—'}</option>)}
                    </select>
                  </label>
                  <button type="submit" style={buttonStyle} disabled={!sedeId || saving}>Vincular</button>
                </form>
              </div>

              <div style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--bg-card)' }}>
                <h3 style={{ marginTop: 0 }}>Administradores centrales</h3>
                {(selected.administradores || []).length === 0 ? <p style={{ color: 'var(--text-secondary)' }}>Sin administrador central.</p> : (
                  <ul style={{ paddingLeft: 20 }}>
                    {(selected.administradores || []).map((row) => (
                      <li key={row.email} style={{ marginBottom: 9 }}>
                        <strong>{row.nombre || row.email}</strong>{row.nombre ? ` · ${row.email}` : ''}
                        <button
                          type="button"
                          onClick={() => run(
                            () => requestJson(`${apiBaseUrl}/api/admin/organizaciones/${selected.id}/administradores/${encodeURIComponent(row.email)}`, accessToken, { method: 'DELETE' }),
                            'Acceso central revocado.',
                          )}
                          style={{ marginLeft: 8, color: '#dc2626', background: 'transparent', border: 0, cursor: 'pointer', fontWeight: 800 }}
                        >Revocar</button>
                      </li>
                    ))}
                  </ul>
                )}
                <form onSubmit={addAdmin} style={{ display: 'grid', gap: 8 }}>
                  <label>Nombre y apellido<input style={fieldStyle} value={admin.nombre} onChange={(e) => setAdmin((p) => ({ ...p, nombre: e.target.value }))} /></label>
                  <label>Email *<input type="email" required style={fieldStyle} value={admin.email} onChange={(e) => setAdmin((p) => ({ ...p, email: e.target.value }))} /></label>
                  <button type="submit" style={buttonStyle} disabled={saving}>Asignar administrador central</button>
                </form>
              </div>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
