import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { PAISES_TELEFONO_PRINCIPALES, PAISES_TELEFONO_OTROS } from '../constants/paisesTelefono';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import {
  HUB_CONTENT_PADDING_BOTTOM_PX,
  hubContentPaddingTopCss,
  hubInstagramColumnWrapStyle,
} from '../constants/hubLayout';
import { padbolLogoImgStyle } from '../constants/padbolLogoStyle';
import { supabase } from '../supabaseClient';
import { nombreCompletoJugadorPerfil } from '../utils/jugadorPerfil';

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

function etiquetaRankingJugador(player) {
  if (!player) return '—';
  const main = nombreCompletoJugadorPerfil(player);
  if (main) return main;
  return String(player.nombre || '').trim() || '—';
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
  { id: 'local',         label: '🏟️ Local'              },
  { id: 'nacional',      label: '🌍 Nacional'            },
  { id: 'internacional', label: '🌐 Internacional FIPA'  },
];

const MEDAL = ['🥇', '🥈', '🥉'];

/** Pantalla estrecha: menos columnas y padding para evitar scroll horizontal en la tabla. */
function useMediaNarrow(maxWidth = 520) {
  const [narrow, setNarrow] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= maxWidth : false
  );
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const fn = () => setNarrow(mq.matches);
    fn();
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, [maxWidth]);
  return narrow;
}

export default function Rankings() {
  const location = useLocation();
  const narrow = useMediaNarrow(520);
  const [activeTab, setActiveTab] = useState('local');
  const [sedes, setSedes] = useState([]);
  const [sedesLoadError, setSedesLoadError] = useState('');
  const [selectedSede, setSelectedSede] = useState('');
  const [selectedCategoria, setSelectedCategoria] = useState('');
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(false);
  /** Si el fetch falla (red, timeout, 5xx), mostramos vacío amigable en lugar del mensaje de error técnico. */
  const [rankingSinDatosDisponibles, setRankingSinDatosDisponibles] = useState(false);

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

  /** Si hay sesión, aplicar categoría del perfil (`nivel`) al filtro cuando exista en la lista. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const user = auth?.user;
        if (!user || cancelled) return;

        let nivel = null;
        const uid = user.id;
        if (uid) {
          const { data: byUid } = await supabase
            .from('jugadores_perfil')
            .select('nivel')
            .eq('user_id', uid)
            .maybeSingle();
          nivel = byUid?.nivel != null ? String(byUid.nivel).trim() : '';
        }
        const email = String(user.email || '').trim().toLowerCase();
        if (!nivel && email) {
          const { data: byEmail } = await supabase
            .from('jugadores_perfil')
            .select('nivel')
            .ilike('email', email)
            .maybeSingle();
          nivel = byEmail?.nivel != null ? String(byEmail.nivel).trim() : '';
        }

        if (cancelled) return;
        const n = String(nivel || '').trim();
        if (n && CATEGORIAS.includes(n)) {
          setSelectedCategoria(n);
        }
      } catch {
        /* sin sesión o error de red: se deja "Todas las categorías" */
      }
    })();
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
    setRankingSinDatosDisponibles(false);
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
          setRankingSinDatosDisponibles(true);
          setRankings([]);
          return;
        }

        if (!res.ok) {
          setRankingSinDatosDisponibles(true);
          setRankings(Array.isArray(data) ? data : []);
          return;
        }
        setRankingSinDatosDisponibles(false);
        setRankings(Array.isArray(data) ? data : []);
      } catch (err) {
        if (cancelled) return;
        setRankingSinDatosDisponibles(true);
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

  const containerStyle = useMemo(
    () => ({
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: `${hubContentPaddingTopCss(location.pathname)} 0 ${HUB_CONTENT_PADDING_BOTTOM_PX}px 0`,
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    }),
    [location.pathname]
  );

  const innerStyle = {
    ...hubInstagramColumnWrapStyle,
    paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))',
    paddingRight: 'max(16px, env(safe-area-inset-right, 0px))',
  };

  const thStyle = {
    padding: narrow ? '8px 6px' : '11px 14px',
    fontSize: narrow ? '10px' : '11px',
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: narrow ? '0.04em' : '0.06em',
    background: '#f9fafb',
    borderBottom: '2px solid #e5e7eb',
    whiteSpace: 'nowrap',
  };

  const trStyle = (idx) => ({
    background: idx === 0 ? '#fffbeb' : idx === 1 ? '#f9fafb' : idx === 2 ? '#fdf8f0' : 'white',
    borderBottom: '1px solid #f3f4f6',
    transition: 'background 0.15s',
  });

  const tdStyle = { padding: narrow ? '8px 6px' : '11px 14px', verticalAlign: 'middle' };

  const showPaisCol = activeTab === 'internacional';
  /** En mobile el encabezado "Torneos" se cortaba; el conteo es secundario frente a puntos. */
  const showTorneosCol = !narrow;

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
            display: 'block',
            marginLeft: 'auto',
            marginRight: 'auto',
            paddingTop: '20px',
            marginBottom: '14px',
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
          ) : rankings.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>🏆</div>
              <div style={{ color: '#9ca3af', fontSize: '15px', fontWeight: '600' }}>
                {rankingSinDatosDisponibles ? 'Sin datos disponibles' : 'Sin datos de ranking todavía'}
              </div>
              {!rankingSinDatosDisponibles ? (
                <div style={{ color: '#d1d5db', fontSize: '12px', marginTop: '6px' }}>
                  Los puntos se asignan automáticamente al finalizar torneos.
                </div>
              ) : (
                <div style={{ color: '#d1d5db', fontSize: '12px', marginTop: '6px' }}>
                  No pudimos cargar el ranking en este momento.
                </div>
              )}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: narrow ? '40px' : '52px' }} />
                <col />
                {showPaisCol ? <col style={{ width: narrow ? '44px' : '56px' }} /> : null}
                <col style={{ width: showTorneosCol ? (narrow ? '22%' : '24%') : (narrow ? '28%' : '30%') }} />
                {showTorneosCol ? <col style={{ width: narrow ? '52px' : '76px' }} /> : null}
                <col style={{ width: narrow ? '64px' : '88px' }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={{ ...thStyle, textAlign: 'center' }}>#</th>
                  <th style={{ ...thStyle, textAlign: 'left' }}>Jugador</th>
                  {showPaisCol ? (
                    <th style={{ ...thStyle, textAlign: 'center' }}>País</th>
                  ) : null}
                  <th style={{ ...thStyle, textAlign: 'left' }}>Equipo</th>
                  {showTorneosCol ? (
                    <th style={{ ...thStyle, textAlign: 'center', whiteSpace: 'normal', lineHeight: 1.2 }}>
                      Torneos
                    </th>
                  ) : null}
                  <th style={{ ...thStyle, textAlign: 'center', color: '#3b2f6e' }}>Puntos</th>
                </tr>
              </thead>
              <tbody>
                {rankings.map((player, idx) => {
                  const pos  = idx + 1;
                  const flag = getFlag(player.pais);
                  const avatarPx = narrow ? 32 : 38;
                  return (
                    <tr key={player.email || idx} style={trStyle(idx)}>

                      {/* Position */}
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        {pos <= 3
                          ? <span style={{ fontSize: narrow ? '17px' : '20px' }}>{MEDAL[pos - 1]}</span>
                          : <span style={posStyle(pos)}>{pos}</span>}
                      </td>

                      {/* Player info */}
                      <td style={{ ...tdStyle, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: narrow ? '6px' : '10px', minWidth: 0 }}>
                          {player.foto_url ? (
                            <img
                              src={player.foto_url}
                              alt=""
                              style={{
                                width: `${avatarPx}px`,
                                height: `${avatarPx}px`,
                                borderRadius: '50%',
                                objectFit: 'cover',
                                objectPosition: 'top center',
                                transform: 'scale(0.85)',
                                transformOrigin: 'top center',
                                flexShrink: 0,
                                border: '2px solid #e5e7eb',
                              }}
                            />
                          ) : (
                            <div style={{ width: `${avatarPx}px`, height: `${avatarPx}px`, borderRadius: '50%', background: 'linear-gradient(135deg, #667eea, #764ba2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: narrow ? '14px' : '17px' }}>
                              👤
                            </div>
                          )}
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: narrow ? '12px' : '14px', fontWeight: '600', color: '#111', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {etiquetaRankingJugador(player)}
                            </div>
                            {player.nivel && !narrow && (
                              <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>{player.nivel}</div>
                            )}
                          </div>
                        </div>
                      </td>

                      {showPaisCol ? (
                        <td style={{ ...tdStyle, textAlign: 'center', fontSize: narrow ? '18px' : '22px' }}>
                          {flag || <span style={{ fontSize: '13px', color: '#d1d5db' }}>—</span>}
                        </td>
                      ) : null}

                      <td style={{ ...tdStyle, fontSize: narrow ? '11px' : '12px', color: '#6b7280', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {player.equipo_nombre || <span style={{ color: '#d1d5db' }}>—</span>}
                      </td>

                      {showTorneosCol ? (
                        <td style={{ ...tdStyle, textAlign: 'center', fontSize: narrow ? '11px' : '13px', color: '#6b7280' }}>
                          {player.torneos_count}
                        </td>
                      ) : null}

                      {/* Points */}
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <span style={{
                          background: pos === 1 ? '#fef3c7' : pos === 2 ? '#f1f5f9' : pos === 3 ? '#fdf4eb' : '#ede9fe',
                          color:      pos === 1 ? '#92400e' : pos === 2 ? '#475569' : pos === 3 ? '#92400e' : '#3b2f6e',
                          borderRadius: '10px',
                          padding: narrow ? '2px 8px' : '3px 12px',
                          fontSize: narrow ? '12px' : '14px',
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
