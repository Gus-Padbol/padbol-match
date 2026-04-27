import React, { useState, useEffect, useMemo } from 'react';
import { PAISES_TELEFONO_PRINCIPALES, PAISES_TELEFONO_OTROS } from '../constants/paisesTelefono';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import {
  HUB_CONTENT_PADDING_BOTTOM_PX,
  HUB_CONTENT_PADDING_TOP_PX,
} from '../constants/hubLayout';
import { padbolLogoImgStyle } from '../constants/padbolLogoStyle';

/** Misma convención que ReservaForm.jsx */
const API_BASE = (
  typeof process !== 'undefined' && process.env.REACT_APP_API_BASE_URL
    ? String(process.env.REACT_APP_API_BASE_URL).replace(/\/$/, '')
    : 'https://padbol-backend.onrender.com'
);

function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${p}`;
}

const CATEGORIAS = ['Principiante', '5ta', '4ta', '3ra', '2da', '1ra', 'Elite'];

const FLAG_MAP = {};
[...PAISES_TELEFONO_PRINCIPALES, ...PAISES_TELEFONO_OTROS].forEach(p => {
  FLAG_MAP[p.nombre.toLowerCase()] = p.bandera;
});

function getFlag(pais) {
  if (!pais) return '';
  const p = pais.trim();
  if ([...p][0]?.match(/\p{Emoji_Presentation}/u)) return [...p][0];
  return FLAG_MAP[p.toLowerCase()] || '';
}

const TABS = [
  { id: 'local',         label: '🏠 Local'              },
  { id: 'nacional',      label: '🌍 Nacional'            },
  { id: 'internacional', label: '🌐 Internacional FIPA'  },
];

const MEDAL = ['🥇', '🥈', '🥉'];

export default function Rankings() {
  const [activeTab, setActiveTab] = useState('internacional');
  const [sedes, setSedes] = useState([]);
  const [sedesLoadError, setSedesLoadError] = useState('');
  const [selectedSede, setSelectedSede] = useState('');
  const [selectedCategoria, setSelectedCategoria] = useState('');
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const selectedSedeMeta = useMemo(
    () => sedes.find((s) => String(s.id) === selectedSede),
    [sedes, selectedSede]
  );

  useEffect(() => {
    let cancelled = false;
    setSedesLoadError('');
    fetch(apiUrl('/api/sedes'))
      .then(async (res) => {
        const text = await res.text();
        if (cancelled) return;
        if (!res.ok) {
          setSedes([]);
          setSedesLoadError('No se pudieron cargar las sedes.');
          return;
        }
        try {
          const data = JSON.parse(text);
          setSedes(Array.isArray(data) ? data : []);
        } catch {
          setSedes([]);
          setSedesLoadError('Respuesta inválida al cargar sedes.');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSedes([]);
          setSedesLoadError('Error de red al cargar sedes.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const params = new URLSearchParams({ scope: activeTab });
    if (activeTab === 'local' && selectedSede) params.set('sede_id', selectedSede);
    if (selectedCategoria) params.set('categoria', selectedCategoria);

    const url = `${apiUrl('/api/rankings')}?${params.toString()}`;

    setLoading(true);
    setError(null);
    setRankings([]);

    (async () => {
      try {
        const res = await fetch(url, { signal: controller.signal });
        const text = await res.text();
        if (cancelled) return;

        let data;
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error('Respuesta inválida del servidor');
        }

        if (!res.ok) {
          throw new Error((data && data.error) || 'Error al cargar rankings');
        }
        setRankings(Array.isArray(data) ? data : []);
      } catch (err) {
        if (cancelled) return;
        const msg =
          err.name === 'AbortError'
            ? 'El servidor tardó demasiado. Intenta de nuevo.'
            : err.message === 'Failed to fetch'
              ? 'No se pudo conectar al servidor. Revisa tu conexión.'
              : err.message || 'Error al cargar rankings';
        setError(msg);
        setRankings([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [activeTab, selectedSede, selectedCategoria]);

  // ── Styles ──────────────────────────────────────────────────────────────────

  const containerStyle = {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: `${HUB_CONTENT_PADDING_TOP_PX}px 16px ${HUB_CONTENT_PADDING_BOTTOM_PX}px 16px`,
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  };

  const innerStyle = { maxWidth: '960px', margin: '0 auto' };

  const thStyle = {
    padding: '11px 14px',
    fontSize: '11px',
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    background: '#f9fafb',
    borderBottom: '2px solid #e5e7eb',
    whiteSpace: 'nowrap',
  };

  const trStyle = (idx) => ({
    background: idx === 0 ? '#fffbeb' : idx === 1 ? '#f9fafb' : idx === 2 ? '#fdf8f0' : 'white',
    borderBottom: '1px solid #f3f4f6',
    transition: 'background 0.15s',
  });

  const tdStyle = { padding: '11px 14px', verticalAlign: 'middle' };

  const posStyle = (pos) => {
    if (pos === 1) return { fontSize: '20px', fontWeight: '900', color: '#d97706' };
    if (pos === 2) return { fontSize: '17px', fontWeight: '800', color: '#6b7280' };
    if (pos === 3) return { fontSize: '16px', fontWeight: '700', color: '#b45309' };
    return { fontSize: '14px', fontWeight: '600', color: '#9ca3af' };
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={containerStyle}>
      <AppHeader title="Ranking" />
      <div style={innerStyle}>
        <img
          src="/logo-padbol-match.png"
          alt="Padbol Match"
          style={{
            ...padbolLogoImgStyle,
            margin: '0 auto 14px',
          }}
        />

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.25)', borderRadius: '12px', padding: '4px', marginBottom: '12px' }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setSelectedSede('');
              }}
              style={{
                flex: 1,
                padding: '9px 10px',
                border: 'none',
                borderRadius: '9px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: activeTab === tab.id ? '700' : '500',
                background: activeTab === tab.id ? 'white' : 'transparent',
                color: activeTab === tab.id ? '#3b2f6e' : 'rgba(255,255,255,0.72)',
                transition: 'all 0.18s',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
          {activeTab === 'local' && (
            <select
              value={selectedSede}
              onChange={e => setSelectedSede(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '8px', border: 'none', fontSize: '13px', background: 'white', color: '#333', minWidth: '180px', cursor: 'pointer' }}
            >
              <option value="">— Todas las sedes —</option>
              {sedes.map(s => (
                <option key={s.id} value={String(s.id)}>{getFlag(s.pais)} {s.nombre}</option>
              ))}
            </select>
          )}
          {activeTab === 'local' && sedesLoadError ? (
            <span style={{ fontSize: '12px', color: '#fecaca', alignSelf: 'center' }}>{sedesLoadError}</span>
          ) : null}
          <select
            value={selectedCategoria}
            onChange={e => setSelectedCategoria(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: 'none', fontSize: '13px', background: 'white', color: '#333', minWidth: '160px', cursor: 'pointer' }}
          >
            <option value="">Todas las categorías</option>
            {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {(selectedCategoria || (activeTab === 'local' && selectedSede)) && (
            <button
              onClick={() => { setSelectedCategoria(''); setSelectedSede(''); }}
              style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: 'rgba(255,255,255,0.2)', color: 'white', fontSize: '13px', cursor: 'pointer', fontWeight: '600' }}
            >
              ✕ Limpiar
            </button>
          )}
        </div>

        {/* Scope description */}
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)', marginBottom: '12px' }}>
          {activeTab === 'local'         && (selectedSede ? `Sede seleccionada · ${selectedSedeMeta?.nombre || ''}` : 'Selecciona una sede para ver el ranking local')}
          {activeTab === 'nacional'      && 'Puntos acumulados en torneos nacionales e internacionales'}
          {activeTab === 'internacional' && 'Ranking FIPA · Todos los torneos finalizados a nivel mundial'}
        </div>

        {/* Table card */}
        <div style={{ background: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.25)' }}>
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#bbb', fontSize: '15px' }}>
              Cargando rankings...
            </div>
          ) : error ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#ef4444', fontSize: '14px' }}>
              ⚠️ {error}
            </div>
          ) : rankings.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>🏆</div>
              <div style={{ color: '#9ca3af', fontSize: '15px', fontWeight: '600' }}>Sin datos de ranking todavía</div>
              <div style={{ color: '#d1d5db', fontSize: '12px', marginTop: '6px' }}>
                Los puntos se asignan automáticamente al finalizar torneos.
              </div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, textAlign: 'center', width: '52px' }}>#</th>
                  <th style={{ ...thStyle, textAlign: 'left' }}>Jugador</th>
                  <th style={{ ...thStyle, textAlign: 'center', width: '60px' }}>País</th>
                  <th style={{ ...thStyle, textAlign: 'left' }}>Club / Sede</th>
                  <th style={{ ...thStyle, textAlign: 'center', width: '80px' }}>Torneos</th>
                  <th style={{ ...thStyle, textAlign: 'center', width: '80px', color: '#3b2f6e' }}>Puntos</th>
                </tr>
              </thead>
              <tbody>
                {rankings.map((player, idx) => {
                  const pos  = idx + 1;
                  const flag = getFlag(player.pais);
                  return (
                    <tr key={player.email || idx} style={trStyle(idx)}>

                      {/* Position */}
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        {pos <= 3
                          ? <span style={{ fontSize: '20px' }}>{MEDAL[pos - 1]}</span>
                          : <span style={posStyle(pos)}>{pos}</span>}
                      </td>

                      {/* Player info */}
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {player.foto_url ? (
                            <img
                              src={player.foto_url}
                              alt=""
                              style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid #e5e7eb' }}
                            />
                          ) : (
                            <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'linear-gradient(135deg, #667eea, #764ba2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '17px' }}>
                              👤
                            </div>
                          )}
                          <div>
                            <div style={{ fontSize: '14px', fontWeight: '600', color: '#111', lineHeight: 1.2 }}>
                              {player.nombre}
                            </div>
                            {player.nivel && (
                              <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>{player.nivel}</div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Country flag */}
                      <td style={{ ...tdStyle, textAlign: 'center', fontSize: '22px' }}>
                        {flag || <span style={{ fontSize: '13px', color: '#d1d5db' }}>—</span>}
                      </td>

                      {/* Club / sede */}
                      <td style={{ ...tdStyle, fontSize: '12px', color: '#6b7280', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {player.equipo_nombre || <span style={{ color: '#d1d5db' }}>—</span>}
                      </td>

                      {/* Tournaments played */}
                      <td style={{ ...tdStyle, textAlign: 'center', fontSize: '13px', color: '#6b7280' }}>
                        {player.torneos_count}
                      </td>

                      {/* Points */}
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <span style={{
                          background: pos === 1 ? '#fef3c7' : pos === 2 ? '#f1f5f9' : pos === 3 ? '#fdf4eb' : '#ede9fe',
                          color:      pos === 1 ? '#92400e' : pos === 2 ? '#475569' : pos === 3 ? '#92400e' : '#3b2f6e',
                          borderRadius: '10px',
                          padding: '3px 12px',
                          fontSize: '14px',
                          fontWeight: '800',
                          display: 'inline-block',
                        }}>
                          {player.puntos_total}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer note */}
        {rankings.length > 0 && (
          <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
            {rankings.length} jugador{rankings.length !== 1 ? 'es' : ''} en el ranking
            {selectedCategoria && ` · Categoría: ${selectedCategoria}`}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
