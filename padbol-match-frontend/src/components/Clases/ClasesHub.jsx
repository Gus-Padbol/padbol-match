import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import HubDeporteSelect from '../HubDeporteSelect';
import { DEPORTES_CANCHA_SEDE_OPTIONS } from '../../constants/deportesCanchaSede';
import { readHubDeporteFilterPersisted, writeHubDeporteFilterToSession } from '../../constants/hubDeporteSession';
import { fetchClases, fetchProfesores } from '../../utils/clasesApi';

const COL_MAX = 390;
const ACCENT = '#E11B22';

function labelDeporte(key) {
  const k = String(key || '').trim().toLowerCase();
  return DEPORTES_CANCHA_SEDE_OPTIONS.find((d) => d.key === k)?.label || k;
}

function deportesLabel(prof) {
  const list = Array.isArray(prof?.deportes) ? prof.deportes : [];
  if (!list.length) return '—';
  return list.map(labelDeporte).join(' · ');
}

function ProfesorCard({ prof, onClick }) {
  const foto = String(prof?.foto_url || '').trim();
  const bio = String(prof?.bio || '').trim();
  const bioCorta = bio.length > 120 ? `${bio.slice(0, 117)}…` : bio;
  return (
    <button type="button" onClick={onClick} style={{
      display: 'flex', width: '100%', maxWidth: COL_MAX, margin: '0 auto 10px',
      borderRadius: 14, overflow: 'hidden', border: '0.5px solid var(--border)',
      background: 'var(--bg-card)', minHeight: 100, padding: 0, textAlign: 'left',
      cursor: 'pointer', boxSizing: 'border-box', fontFamily: 'inherit', color: 'inherit',
    }}>
      <div style={{ width: 130, flexShrink: 0, background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch', minHeight: 100 }}>
        {foto ? (
          <img src={foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <span style={{ fontSize: 40, opacity: 0.45, lineHeight: 1 }} aria-hidden>👤</span>
        )}
      </div>
      <div style={{ flex: 1, padding: '12px 14px', minWidth: 0, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.25 }}>{prof.nombre}</h3>
          {prof.certificado_fipa ? (
            <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 800, padding: '4px 8px', borderRadius: 999, background: 'rgba(225, 27, 34, 0.12)', color: ACCENT, letterSpacing: '0.02em' }}>Cert. FIPA</span>
          ) : null}
        </div>
        <p style={{ margin: '6px 0 0', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{deportesLabel(prof)}</p>
        {bioCorta ? <p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.45, color: 'var(--text-secondary)' }}>{bioCorta}</p> : null}
      </div>
    </button>
  );
}

function ClaseMiniCard({ clase, onClick }) {
  const tipo = String(clase.tipo || 'grupal').toLowerCase() === 'individual' ? 'Individual' : 'Grupal';
  return (
    <button type="button" onClick={onClick} style={{
      width: '100%', maxWidth: COL_MAX, margin: '0 auto 8px', display: 'block', textAlign: 'left',
      padding: '14px 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-card)',
      cursor: 'pointer', boxSizing: 'border-box', fontFamily: 'inherit', color: 'inherit',
    }}>
      <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-primary)', marginBottom: 4 }}>{clase.titulo}</div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        {labelDeporte(clase.deporte)} · {tipo}
        {clase.precio != null ? ` · desde $${Math.round(Number(clase.precio)).toLocaleString('es-AR')}` : ''}
      </div>
    </button>
  );
}

export default function ClasesHub({ sedeId }) {
  const navigate = useNavigate();
  const [deporteElegido, setDeporteElegido] = useState(() => readHubDeporteFilterPersisted());
  const [profesores, setProfesores] = useState([]);
  const [clases, setClases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [profesorSel, setProfesorSel] = useState(null);
  const sid = Number(sedeId);

  useEffect(() => {
    if (!Number.isFinite(sid)) {
      setProfesores([]);
      setClases([]);
      setLoading(false);
      return undefined;
    }
    const ac = new AbortController();
    setLoading(true);
    setErr('');
    const dep = String(deporteElegido || '').trim().toLowerCase();
    Promise.all([
      fetchProfesores({ sedeId: sid, deporte: dep || undefined, signal: ac.signal }),
      fetchClases({ sedeId: sid, deporte: dep || undefined, signal: ac.signal }),
    ])
      .then(([profs, cls]) => {
        setProfesores(profs);
        setClases(cls);
      })
      .catch((e) => {
        if (e?.name === 'AbortError') return;
        setErr(e?.message || String(e));
        setProfesores([]);
        setClases([]);
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [sid, deporteElegido]);

  const clasesDelProfesor = useMemo(() => {
    if (!profesorSel?.id) return [];
    const pid = Number(profesorSel.id);
    return clases.filter((c) => Number(c.profesor_id) === pid || Number(c.profesor?.id) === pid);
  }, [clases, profesorSel]);

  if (!Number.isFinite(sid)) {
    return (
      <p style={{ margin: '24px auto', maxWidth: COL_MAX, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 15 }}>
        Elegí una sede en tu perfil para ver clases y profesores.
      </p>
    );
  }

  return (
        <div style={{ width: '100%', maxWidth: COL_MAX, margin: '0 auto', boxSizing: 'border-box' }}>
      <HubDeporteSelect compact id="clases-deporte-select" value={deporteElegido} onChange={(v) => { setDeporteElegido(v); writeHubDeporteFilterToSession(v); setProfesorSel(null); }} />
      {profesorSel ? (
        <>
          <button type="button" onClick={() => setProfesorSel(null)} style={{ margin: '14px 0 10px', padding: 0, border: 'none', background: 'none', color: ACCENT, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>← Volver a profesores</button>
          <h2 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>Clases de {profesorSel.nombre}</h2>
          {clasesDelProfesor.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>No hay clases publicadas para este profesor.</p>
          ) : (
            clasesDelProfesor.map((c) => <ClaseMiniCard key={c.id} clase={c} onClick={() => navigate(`/clases/${c.id}`)} />)
          )}
        </>
      ) : (
        <>
          <h2 style={{ margin: '16px 0 12px', fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>Profesores</h2>
          {loading ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Cargando…</p>
          ) : err ? (
            <p style={{ color: 'var(--pm-color-error, #dc2626)', fontSize: 14 }}>{err}</p>
          ) : profesores.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>No hay profesores disponibles en tu sede.</p>
          ) : (
            profesores.map((p) => <ProfesorCard key={p.id} prof={p} onClick={() => setProfesorSel(p)} />)
          )}
        </>
      )}
    </div>
  );
}
