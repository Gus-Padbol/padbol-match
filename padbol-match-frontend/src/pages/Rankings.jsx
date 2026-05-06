import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { PAISES_TELEFONO_PRINCIPALES, PAISES_TELEFONO_OTROS } from '../constants/paisesTelefono';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import OpcionListaBusquedaInput from '../components/OpcionListaBusquedaInput';
import {
  HUB_CONTENT_PADDING_BOTTOM_PX,
  HUB_LOGO_CLEARANCE_TOP_PX,
  hubContentPaddingTopCss,
  hubInstagramColumnWrapStyle,
} from '../constants/hubLayout';
import { padbolLogoImgStyle } from '../constants/padbolLogoStyle';
import { supabase } from '../supabaseClient';
import { nombreCompletoJugadorPerfil, formatAliasConArroba } from '../utils/jugadorPerfil';
import { buildJugadorPreviewModalData } from '../utils/jugadorPreviewModalData';
import JugadorPreviewModal from '../components/JugadorPreviewModal';

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

/** Mismo aspecto que los filtros anteriores (inputs blancos). */
const RANKING_FILTER_INPUT_STYLE = {
  padding: '8px 12px',
  borderRadius: '8px',
  border: 'none',
  fontSize: '13px',
  background: 'white',
  color: '#333',
  minWidth: '160px',
  width: '100%',
  boxSizing: 'border-box',
};

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

function useDebouncedValue(value, ms) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export default function Rankings() {
  const location = useLocation();
  const narrow = useMediaNarrow(520);
  const [activeTab, setActiveTab] = useState('local');
  const [sedes, setSedes] = useState([]);
  const [sedesLoadError, setSedesLoadError] = useState('');
  const [selectedCategoria, setSelectedCategoria] = useState('');
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(false);
  /** Si el fetch falla (red, timeout, 5xx), mostramos vacío amigable en lugar del mensaje de error técnico. */
  const [rankingSinDatosDisponibles, setRankingSinDatosDisponibles] = useState(false);
  /** País del perfil (jugadores_perfil), para default en Nacional. */
  const [perfilPais, setPerfilPais] = useState('');
  const skipNacionalDefaultRef = useRef(false);

  const [localPais, setLocalPais] = useState('');
  const [localProvincia, setLocalProvincia] = useState('');
  const [localCiudad, setLocalCiudad] = useState('');
  const debouncedLocalCiudad = useDebouncedValue(localCiudad.trim(), 400);

  const [nacionalPais, setNacionalPais] = useState('');
  const [jugadorPreviewRankings, setJugadorPreviewRankings] = useState(null);

  const nombresPaisesOpciones = useMemo(
    () =>
      [...PAISES_TELEFONO_PRINCIPALES, ...PAISES_TELEFONO_OTROS]
        .map((p) => String(p.nombre || '').trim())
        .filter(Boolean),
    []
  );

  const provinciasLocalOpciones = useMemo(() => {
    const p = String(localPais || '').trim().toLowerCase();
    if (!p) return [];
    const set = new Set();
    for (const s of sedes) {
      if (String(s.pais || '').trim().toLowerCase() !== p) continue;
      const pr = s.provincia != null ? String(s.provincia).trim() : '';
      if (pr) set.add(pr);
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'es'));
  }, [sedes, localPais]);

  /** País por defecto al abrir Nacional (perfil), salvo que el usuario haya limpiado. */
  useEffect(() => {
    if (activeTab !== 'nacional' || skipNacionalDefaultRef.current) return;
    if (nacionalPais.trim()) return;
    const d = String(perfilPais || '').trim();
    if (!d) return;
    setNacionalPais(d);
  }, [activeTab, nacionalPais, perfilPais]);

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
        let paisProf = '';
        const uid = user.id;
        if (uid) {
          const { data: byUid } = await supabase
            .from('jugadores_perfil')
            .select('nivel, pais')
            .eq('user_id', uid)
            .maybeSingle();
          nivel = byUid?.nivel != null ? String(byUid.nivel).trim() : '';
          paisProf = byUid?.pais != null ? String(byUid.pais).trim() : '';
        }
        const email = String(user.email || '').trim().toLowerCase();
        if ((!nivel || !paisProf) && email) {
          const { data: byEmail } = await supabase
            .from('jugadores_perfil')
            .select('nivel, pais')
            .ilike('email', email)
            .maybeSingle();
          if (!nivel && byEmail?.nivel != null) nivel = String(byEmail.nivel).trim();
          if (!paisProf && byEmail?.pais != null) paisProf = String(byEmail.pais).trim();
        }

        if (cancelled) return;
        const n = String(nivel || '').trim();
        if (n && CATEGORIAS.includes(n)) {
          setSelectedCategoria(n);
        }
        const pp = String(paisProf || '').trim();
        if (pp) setPerfilPais(pp);
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

    if (activeTab === 'local' && !String(localPais || '').trim()) {
      setLoading(false);
      setRankingSinDatosDisponibles(false);
      setRankings([]);
      return () => {
        cancelled = true;
        clearTimeout(timeout);
        controller.abort();
      };
    }

    if (activeTab === 'nacional' && !String(nacionalPais || '').trim()) {
      setLoading(false);
      setRankingSinDatosDisponibles(false);
      setRankings([]);
      return () => {
        cancelled = true;
        clearTimeout(timeout);
        controller.abort();
      };
    }

    const params = new URLSearchParams({ scope: activeTab });
    if (selectedCategoria) params.set('categoria', selectedCategoria);

    if (activeTab === 'local') {
      params.set('pais', String(localPais).trim());
      if (String(localProvincia || '').trim()) params.set('provincia', String(localProvincia).trim());
      if (debouncedLocalCiudad) params.set('ciudad', debouncedLocalCiudad);
    }
    if (activeTab === 'nacional') {
      params.set('pais', String(nacionalPais).trim());
    }

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
  }, [
    activeTab,
    selectedCategoria,
    localPais,
    localProvincia,
    debouncedLocalCiudad,
    nacionalPais,
  ]);

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
            marginTop: HUB_LOGO_CLEARANCE_TOP_PX,
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
                setLocalPais('');
                setLocalProvincia('');
                setLocalCiudad('');
                setNacionalPais('');
                setSelectedCategoria('');
                skipNacionalDefaultRef.current = tab.id !== 'nacional';
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
        <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {activeTab === 'local' && (
            <>
              <OpcionListaBusquedaInput
                options={nombresPaisesOpciones}
                value={localPais}
                onChange={(v) => {
                  setLocalPais(v);
                  setLocalProvincia('');
                }}
                placeholder="País…"
                allLabel="Elegí país"
                debounceMs={280}
                minChars={0}
                inputStyle={RANKING_FILTER_INPUT_STYLE}
                aria-label="País para ranking local"
              />
              {localPais ? (
                <OpcionListaBusquedaInput
                  options={provinciasLocalOpciones}
                  value={localProvincia}
                  onChange={setLocalProvincia}
                  placeholder="Provincia / estado…"
                  allLabel="Toda la provincia"
                  debounceMs={280}
                  minChars={0}
                  inputStyle={RANKING_FILTER_INPUT_STYLE}
                  aria-label="Provincia o estado para ranking local"
                />
              ) : null}
              <div style={{ minWidth: '160px', flex: '1 1 180px' }}>
                <input
                  type="text"
                  value={localCiudad}
                  onChange={(e) => setLocalCiudad(e.target.value)}
                  placeholder="Ciudad (opcional)…"
                  aria-label="Ciudad para ranking local"
                  autoComplete="off"
                  style={RANKING_FILTER_INPUT_STYLE}
                />
              </div>
            </>
          )}
          {activeTab === 'local' && sedesLoadError ? (
            <span style={{ fontSize: '12px', color: '#fecaca', alignSelf: 'center' }}>{sedesLoadError}</span>
          ) : null}
          {activeTab === 'nacional' && (
            <OpcionListaBusquedaInput
              options={nombresPaisesOpciones}
              value={nacionalPais}
              onChange={(v) => {
                skipNacionalDefaultRef.current = !String(v || '').trim();
                setNacionalPais(v);
              }}
              placeholder="País del ranking…"
              allLabel="Elegí país"
              debounceMs={280}
              minChars={0}
              inputStyle={RANKING_FILTER_INPUT_STYLE}
              aria-label="País para ranking nacional"
            />
          )}
          <OpcionListaBusquedaInput
            options={CATEGORIAS}
            value={selectedCategoria}
            onChange={setSelectedCategoria}
            placeholder="Categoría — buscá o elegí…"
            allLabel="Todas las categorías"
            debounceMs={280}
            minChars={0}
            inputStyle={RANKING_FILTER_INPUT_STYLE}
            aria-label="Filtrar ranking por categoría"
          />
          {(selectedCategoria ||
            (activeTab === 'local' && (localPais || localProvincia || localCiudad.trim())) ||
            (activeTab === 'nacional' && nacionalPais)) && (
            <button
              type="button"
              onClick={() => {
                setSelectedCategoria('');
                setLocalPais('');
                setLocalProvincia('');
                setLocalCiudad('');
                setNacionalPais('');
                skipNacionalDefaultRef.current = true;
              }}
              style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: 'rgba(255,255,255,0.2)', color: 'white', fontSize: '13px', cursor: 'pointer', fontWeight: '600' }}
            >
              ✕ Limpiar
            </button>
          )}
        </div>

        {/* Scope description */}
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)', marginBottom: '12px' }}>
          {activeTab === 'local' &&
            (localPais
              ? `Ranking en clubes de ${[localPais, localProvincia || null, debouncedLocalCiudad || null].filter(Boolean).join(' · ')}`
              : 'Elegí un país para ver el ranking local (torneos de club en esa zona)')}
          {activeTab === 'nacional' &&
            (nacionalPais
              ? `Ranking nacional · ${nacionalPais}${selectedCategoria ? ` · ${selectedCategoria}` : ''}`
              : 'Elegí un país para ver el ranking nacional')}
          {activeTab === 'internacional' && (
            <>
              Ranking FIPA · torneos internacionales y mundiales finalizados
              {selectedCategoria ? ` · Categoría: ${selectedCategoria}` : ''}
            </>
          )}
        </div>

        {/* Table card */}
        <div style={{ background: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.25)' }}>
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#bbb', fontSize: '15px' }}>
              Cargando rankings...
            </div>
          ) : (activeTab === 'local' && !localPais.trim()) || (activeTab === 'nacional' && !nacionalPais.trim()) ? (
            <div style={{ padding: '60px', textAlign: 'center' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>📍</div>
              <div style={{ color: '#9ca3af', fontSize: '15px', fontWeight: '600' }}>
                {activeTab === 'local' ? 'Elegí un país para el ranking local' : 'Elegí un país para el ranking nacional'}
              </div>
              <div style={{ color: '#d1d5db', fontSize: '12px', marginTop: '6px' }}>
                Usá los filtros de arriba para cargar la tabla.
              </div>
            </div>
          ) : rankings.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>🏆</div>
              <div style={{ color: '#9ca3af', fontSize: '15px', fontWeight: '600' }}>
                {rankingSinDatosDisponibles ? 'Sin datos disponibles' : 'Sin datos de ranking todavía'}
              </div>
              {!rankingSinDatosDisponibles ? (
                <div style={{ color: '#d1d5db', fontSize: '12px', marginTop: '6px' }}>
                  No hay jugadores con puntos para esta combinación de filtros, o los puntos aún no se asignaron.
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
                        <button
                          type="button"
                          onClick={() =>
                            setJugadorPreviewRankings(buildJugadorPreviewModalData(player, null))
                          }
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: narrow ? '6px' : '10px',
                            minWidth: 0,
                            width: '100%',
                            border: 'none',
                            background: 'transparent',
                            padding: 0,
                            cursor: 'pointer',
                            textAlign: 'left',
                            font: 'inherit',
                          }}
                        >
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
                            {String(player.alias || '').trim() ? (
                              <div style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {formatAliasConArroba(String(player.alias).trim())}
                              </div>
                            ) : null}
                          </div>
                        </button>
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
            {rankings.length} jugador{rankings.length !== 1 ? 'es' : ''} mostrado{rankings.length !== 1 ? 's' : ''}
            {selectedCategoria && ` · Categoría: ${selectedCategoria}`}
          </div>
        )}
      </div>
      <JugadorPreviewModal
        open={Boolean(jugadorPreviewRankings)}
        onClose={() => setJugadorPreviewRankings(null)}
        data={jugadorPreviewRankings}
      />
      <BottomNav />
    </div>
  );
}
