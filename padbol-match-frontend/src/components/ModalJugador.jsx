import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { PAISES_TELEFONO_PRINCIPALES, PAISES_TELEFONO_OTROS } from '../constants/paisesTelefono';
import { nombreCompletoJugadorPerfil, formatAliasConArroba } from '../utils/jugadorPerfil';

const API_BASE_MODAL =
  typeof process !== 'undefined' && process.env.REACT_APP_API_BASE_URL
    ? String(process.env.REACT_APP_API_BASE_URL).replace(/\/$/, '')
    : 'https://padbol-backend.onrender.com';

const FLAG_MAP = {};
[...PAISES_TELEFONO_PRINCIPALES, ...PAISES_TELEFONO_OTROS].forEach((p) => {
  FLAG_MAP[p.nombre.toLowerCase()] = p.bandera;
});

function flagForPais(pais) {
  if (!pais) return '';
  const p = String(pais).trim();
  if ([...p][0]?.match(/\p{Emoji_Presentation}/u)) return [...p][0];
  return FLAG_MAP[p.toLowerCase()] || '';
}

export function stripAliasSlug(s) {
  return String(s || '')
    .replace(/^@+/u, '')
    .trim();
}

/** @param {object|null|undefined} p fila agregada del ranking */
export function hintFromRankingPlayer(p) {
  if (!p || typeof p !== 'object') return null;
  return {
    user_id: p.user_id != null ? String(p.user_id).trim() : '',
    email: p.email != null ? String(p.email).trim() : '',
    alias: p.alias != null ? String(p.alias).trim() : '',
    nombre: p.nombre != null ? String(p.nombre).trim() : '',
    apellido: p.apellido != null ? String(p.apellido).trim() : '',
    foto_url: p.foto_url != null ? String(p.foto_url).trim() : '',
    nivel: p.nivel != null ? String(p.nivel).trim() : '',
    pais: p.pais != null ? String(p.pais).trim() : '',
    ciudad: p.ciudad != null ? String(p.ciudad).trim() : '',
    sede_id: p.sede_id != null && p.sede_id !== '' ? p.sede_id : null,
  };
}

/** @param {object|null|undefined} row respuesta GET /api/jugadores/buscar */
export function hintFromBuscarRow(row) {
  if (!row || typeof row !== 'object') return null;
  return {
    user_id: row.user_id != null ? String(row.user_id).trim() : '',
    email: row.email != null ? String(row.email).trim() : '',
    alias: row.alias != null ? String(row.alias).trim() : '',
    nombre: row.nombre != null ? String(row.nombre).trim() : '',
    apellido: row.apellido != null ? String(row.apellido).trim() : '',
    foto_url: row.foto_url != null ? String(row.foto_url).trim() : '',
  };
}

function rowLine(label, value) {
  const v = value != null && String(value).trim() ? String(value).trim() : '—';
  return (
    <div style={{ marginBottom: '12px' }}>
      <div
        style={{
          fontSize: '11px',
          fontWeight: 800,
          color: '#64748b',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>{v}</div>
    </div>
  );
}

/**
 * Modal reutilizable: datos básicos del jugador y enlace al perfil público (`/jugador/:alias`).
 * Cierra con clic fuera, botón X o Escape.
 */
export default function ModalJugador({ open, onClose, hint }) {
  const navigate = useNavigate();
  const [resolved, setResolved] = useState(null);
  const [sedeNombre, setSedeNombre] = useState('');
  const [loading, setLoading] = useState(false);
  const [statsMini, setStatsMini] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const hintRef = useRef(hint);
  hintRef.current = hint;

  const loadKey =
    hint && typeof hint === 'object'
      ? `${hint.user_id || ''}|${String(hint.email || '').toLowerCase()}|${stripAliasSlug(hint.alias)}`
      : '';

  useEffect(() => {
    const h = hintRef.current;
    if (!open || !h || typeof h !== 'object') {
      setResolved(null);
      setSedeNombre('');
      return;
    }
    let cancelled = false;
    setLoading(true);
    setResolved({ ...h });
    setSedeNombre('');

    (async () => {
      try {
        let row = null;
        const uid = String(h.user_id || '').trim();
        const em = String(h.email || '').trim();
        const al = stripAliasSlug(h.alias || '');

        if (uid) {
          const { data, error } = await supabase.from('jugadores_perfil').select('*').eq('user_id', uid).maybeSingle();
          if (error) throw error;
          row = data;
        } else if (em) {
          const { data, error } = await supabase.from('jugadores_perfil').select('*').ilike('email', em).maybeSingle();
          if (error) throw error;
          row = data;
        } else if (al) {
          const { data: rows, error } = await supabase.from('jugadores_perfil').select('*').ilike('alias', al).limit(8);
          if (error) throw error;
          const list = Array.isArray(rows) ? rows : [];
          const low = al.toLowerCase();
          row =
            list.find((r) => String(r.alias || '').trim().toLowerCase() === low) ||
            (list.length === 1 ? list[0] : null);
        }

        if (cancelled) return;
        const merged =
          row && typeof row === 'object'
            ? {
                ...h,
                ...row,
                foto_url: row.foto_url || h.foto_url || '',
                alias: row.alias || h.alias || '',
                nombre: row.nombre || h.nombre || '',
                apellido: row.apellido != null ? row.apellido : h.apellido,
              }
            : h;
        setResolved(merged);

        const sidRaw = merged.sede_id != null && merged.sede_id !== '' ? Number(merged.sede_id) : NaN;
        if (Number.isFinite(sidRaw)) {
          const { data: sede } = await supabase.from('sedes').select('nombre').eq('id', sidRaw).maybeSingle();
          if (!cancelled) setSedeNombre(String(sede?.nombre || '').trim());
        } else if (!cancelled) {
          setSedeNombre('');
        }
      } catch (e) {
        if (!cancelled) {
          console.error('[ModalJugador]', e);
          setResolved(h);
          setSedeNombre('');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, loadKey]);

  useEffect(() => {
    if (!open) {
      setStatsMini(null);
      setLoadingStats(false);
      return undefined;
    }
    const al = stripAliasSlug(resolved?.alias || hint?.alias || '');
    if (!al) {
      setStatsMini(null);
      setLoadingStats(false);
      return undefined;
    }
    let cancelled = false;
    setLoadingStats(true);
    setStatsMini(null);
    (async () => {
      try {
        const res = await fetch(`${API_BASE_MODAL}/api/jugador/${encodeURIComponent(al)}/estadisticas`);
        if (cancelled) return;
        if (!res.ok) {
          setStatsMini(null);
          return;
        }
        const j = await res.json();
        if (!cancelled) setStatsMini(j);
      } catch (e) {
        if (!cancelled) {
          console.warn('[ModalJugador] estadisticas', e);
          setStatsMini(null);
        }
      } finally {
        if (!cancelled) setLoadingStats(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, resolved?.alias, hint?.alias]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const irPerfilCompleto = useCallback(() => {
    const slug = stripAliasSlug(resolved?.alias || hint?.alias || '');
    if (!slug) return;
    navigate(`/jugador/${encodeURIComponent(slug)}`);
    onClose();
  }, [navigate, onClose, resolved, hint]);

  if (!open || !hint) return null;

  const display = resolved || hint;
  const nombreCompleto = nombreCompletoJugadorPerfil(display) || String(display.nombre || '').trim() || 'Jugador';
  const aliasRaw = String(display.alias || '').trim();
  const aliasUi = aliasRaw ? formatAliasConArroba(aliasRaw) : '—';
  const categoria = String(display.nivel || '').trim() || '—';
  const sedeTxt = (sedeNombre && sedeNombre.trim()) || String(display.ciudad || '').trim() || '—';
  const paisTxt = String(display.pais || '').trim() || '—';
  const flag = flagForPais(display.pais);
  const foto = String(display.foto_url || '').trim();
  const puedeVerPerfil = Boolean(stripAliasSlug(display.alias || ''));

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10040,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box',
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-jugador-titulo"
        style={{
          position: 'relative',
          background: 'var(--bg-card)',
          borderRadius: '16px',
          maxWidth: '400px',
          width: '100%',
          boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
          padding: '22px 20px 18px',
          boxSizing: 'border-box',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            border: 'none',
            background: 'var(--bg-input)',
            color: 'var(--text-secondary)',
            fontSize: '20px',
            lineHeight: 1,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
          }}
        >
          ×
        </button>

        {loading ? (
          <div style={{ padding: '24px 8px', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>
            Cargando…
          </div>
        ) : (
          <>
            <div style={{ textAlign: 'center', marginBottom: '16px', paddingRight: '28px' }}>
              {foto ? (
                <img
                  src={foto}
                  alt=""
                  style={{
                    width: '88px',
                    height: '88px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    objectPosition: 'top center',
                    border: '3px solid #e2e8f0',
                  }}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div
                  aria-hidden
                  style={{
                    width: '88px',
                    height: '88px',
                    borderRadius: '50%',
                    margin: '0 auto',
                    background: 'linear-gradient(135deg, #E11B22, #b91c1c)',
                    color: '#fff',
                    fontSize: '32px',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {(nombreCompleto || '?').charAt(0).toUpperCase()}
                </div>
              )}
              <h2
                id="modal-jugador-titulo"
                style={{
                  margin: '14px 0 0',
                  fontSize: '1.15rem',
                  fontWeight: 900,
                  color: 'var(--text-primary)',
                  lineHeight: 1.3,
                }}
              >
                {nombreCompleto}
              </h2>
              <p style={{ margin: '6px 0 0', fontSize: '13px', fontWeight: 600, color: '#b91c1c' }}>{aliasUi}</p>
            </div>

            {rowLine('Categoría', categoria === '—' ? null : categoria)}
            {loadingStats ? (
              <div style={{ marginBottom: '12px', fontSize: '13px', color: '#94a3b8', fontWeight: 600 }}>
                Cargando estadísticas…
              </div>
            ) : statsMini ? (
              <div
                style={{
                  marginBottom: '14px',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  background: 'var(--bg-card)',
                  border: '1px solid #e2e8f0',
                  fontSize: '13px',
                  color: '#475569',
                  fontWeight: 600,
                  lineHeight: 1.45,
                }}
              >
                <span>
                  Torneos jugados:{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>{statsMini.torneos_jugados ?? 0}</strong>
                </span>
                <span style={{ margin: '0 8px', color: '#cbd5e1' }}>|</span>
                <span>
                  Win rate:{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {Number(statsMini.partidos_jugados) > 0 ? `${statsMini.win_rate_pct ?? 0}%` : '—'}
                  </strong>
                </span>
              </div>
            ) : null}
            {rowLine('Sede / club', sedeTxt === '—' ? null : sedeTxt)}
            <div style={{ marginBottom: '12px' }}>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  color: '#64748b',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                País
              </div>
              <div
                style={{
                  fontSize: '15px',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  marginTop: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                {flag ? <span style={{ fontSize: '22px' }}>{flag}</span> : null}
                <span>{paisTxt === '' ? '—' : paisTxt}</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
              <button
                type="button"
                disabled={!puedeVerPerfil}
                onClick={irPerfilCompleto}
                title={!puedeVerPerfil ? 'Este jugador aún no tiene alias público' : undefined}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '10px',
                  border: '2px solid #E11B22',
                  background: puedeVerPerfil ? '#fff' : '#f1f5f9',
                  color: puedeVerPerfil ? '#E11B22' : '#94a3b8',
                  fontWeight: 800,
                  fontSize: '15px',
                  cursor: puedeVerPerfil ? 'pointer' : 'not-allowed',
                }}
              >
                Ver perfil completo
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
