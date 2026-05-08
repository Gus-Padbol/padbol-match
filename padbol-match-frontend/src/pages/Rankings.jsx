import React, { useState, useEffect, useMemo, useRef, useId } from 'react';
import { useLocation } from 'react-router-dom';
import { PAISES_TELEFONO_PRINCIPALES, PAISES_TELEFONO_OTROS } from '../constants/paisesTelefono';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import {
  HUB_CONTENT_PADDING_BOTTOM_PX,
  HUB_LOGO_CLEARANCE_TOP_PX,
  hubContentPaddingTopCss,
  hubInstagramColumnWrapStyle,
} from '../constants/hubLayout';
import { padbolLogoImgStyle } from '../constants/padbolLogoStyle';
import { supabase } from '../supabaseClient';
import { nombreCompletoJugadorPerfil, formatAliasConArroba } from '../utils/jugadorPerfil';
import ModalJugador, { hintFromRankingPlayer } from '../components/ModalJugador';
import { CATEGORIAS_NIVEL_TODAS } from '../constants/jugadorCategoria';
import { TORNEO_GENERO_COMPETENCIA_OPTIONS } from '../constants/torneoCompetencia';
import { torneoTipoCompetenciaDb } from '../utils/torneoFormatters';

function etiquetaRankingJugador(player) {
  if (!player) return '—';
  const main = nombreCompletoJugadorPerfil(player);
  if (main) return main;
  return String(player.nombre || '').trim() || '—';
}

const SCOPE_NIVELES_RANKING = {
  local: ['club', 'club_oficial', 'club_no_oficial'],
  nacional: ['nacional'],
  internacional: ['internacional', 'mundial'],
};

const PERFIL_EMAIL_CHUNK = 120;

function normPaisRanking(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function torneoPasaFiltroTipoCompetenciaRanking(t, filtro) {
  if (!filtro) return true;
  const g = String(torneoTipoCompetenciaDb(t) || '')
    .trim()
    .toLowerCase();
  if (!g) return true;
  if (filtro === 'mixto') return g === 'mixto';
  if (filtro === 'masculino') return g === 'masculino' || g === 'mixto';
  if (filtro === 'femenino') return g === 'femenino' || g === 'mixto';
  return true;
}

/**
 * Misma lógica que GET /api/rankings en el backend; consulta directa a Supabase desde el cliente.
 */
async function fetchRankingsSupabase({ scope, pais, provincia, ciudad, categoria, tipoCompetencia }) {
  const nivelesPermitidos = SCOPE_NIVELES_RANKING[scope] || SCOPE_NIVELES_RANKING.internacional;

  let torneosQuery = supabase
    .from('torneos')
    .select('id, sede_id, nivel_torneo, nombre, tipo_competencia, tipo_torneo_genero, genero_competencia, categoria_edad')
    .eq('estado', 'finalizado')
    .in('nivel_torneo', nivelesPermitidos);

  if (scope === 'local') {
    const pPais = pais && String(pais).trim();
    const pProv = provincia && String(provincia).trim();
    const pCiudad = ciudad && String(ciudad).trim();
    if (pPais || pProv || pCiudad) {
      let sedesQ = supabase.from('sedes').select('id');
      if (pPais) sedesQ = sedesQ.ilike('pais', pPais);
      if (pProv) sedesQ = sedesQ.ilike('provincia', pProv);
      if (pCiudad) {
        const safeCiudad = String(pCiudad).replace(/[%_]/g, ' ');
        sedesQ = sedesQ.ilike('ciudad', `%${safeCiudad}%`);
      }
      const { data: sedeRows, error: errSedes } = await sedesQ;
      if (errSedes) throw errSedes;
      const ids = (sedeRows || []).map((s) => s.id).filter((id) => id != null);
      if (!ids.length) return [];
      torneosQuery = torneosQuery.in('sede_id', ids);
    }
  }

  const { data: torneosRaw, error: errT } = await torneosQuery;
  if (errT) throw errT;
  if (!torneosRaw?.length) return [];

  const torneos = torneosRaw.filter((t) => torneoPasaFiltroTipoCompetenciaRanking(t, tipoCompetencia));
  if (!torneos.length) return [];

  const torneoIds = torneos.map((t) => t.id);

  const { data: puntos, error: errP } = await supabase
    .from('tabla_puntos')
    .select('torneo_id, equipo_id, posicion, puntos')
    .in('torneo_id', torneoIds);
  if (errP) throw errP;
  if (!puntos?.length) return [];

  const equipoIds = [...new Set(puntos.map((p) => p.equipo_id))];
  const { data: equipos, error: errE } = await supabase
    .from('equipos')
    .select('id, nombre, jugadores')
    .in('id', equipoIds);
  if (errE) throw errE;

  const equipoMap = {};
  (equipos || []).forEach((e) => {
    equipoMap[e.id] = e;
  });

  const playerMap = {};

  puntos.forEach((p) => {
    const equipo = equipoMap[p.equipo_id];
    if (!equipo) return;
    const jugadores = Array.isArray(equipo.jugadores) ? equipo.jugadores : [];

    if (jugadores.length === 0) {
      const key = `equipo:${equipo.id}`;
      if (!playerMap[key]) {
        playerMap[key] = {
          nombre: equipo.nombre,
          email: null,
          pais: null,
          foto_url: null,
          nivel: null,
          sede_id: null,
          equipo_nombre: equipo.nombre,
          puntos_total: 0,
          torneos_count: 0,
        };
      }
      playerMap[key].puntos_total += p.puntos;
      playerMap[key].torneos_count += 1;
    } else {
      jugadores.forEach((j) => {
        const key = j.email || j.nombre;
        if (!key) return;
        if (!playerMap[key]) {
          playerMap[key] = {
            nombre: j.nombre || key,
            apellido: j.apellido != null && String(j.apellido).trim() ? String(j.apellido).trim() : null,
            alias: j.alias != null && String(j.alias).trim() ? String(j.alias).trim() : null,
            email: j.email || null,
            pais: null,
            foto_url: null,
            nivel: null,
            sede_id: null,
            equipo_nombre: equipo.nombre,
            puntos_total: 0,
            torneos_count: 0,
          };
        }
        playerMap[key].puntos_total += p.puntos;
        playerMap[key].torneos_count += 1;
      });
    }
  });

  const emails = Object.values(playerMap)
    .map((pl) => pl.email)
    .filter(Boolean);
  for (let i = 0; i < emails.length; i += PERFIL_EMAIL_CHUNK) {
    const chunk = emails.slice(i, i + PERFIL_EMAIL_CHUNK);
    const { data: perfiles, error: errPF } = await supabase
      .from('jugadores_perfil')
      .select('email, nombre, apellido, alias, pais, foto_url, sede_id, nivel')
      .in('email', chunk);
    if (errPF) throw errPF;
    (perfiles || []).forEach((perfil) => {
      const entry = playerMap[perfil.email];
      if (!entry) return;
      entry.foto_url = perfil.foto_url || null;
      entry.pais = perfil.pais || null;
      entry.nivel = perfil.nivel || null;
      entry.sede_id = perfil.sede_id || null;
      entry.nombre = perfil.nombre || entry.nombre;
      const ap = perfil.apellido != null && String(perfil.apellido).trim() ? String(perfil.apellido).trim() : '';
      if (ap) entry.apellido = ap;
      const al = perfil.alias != null && String(perfil.alias).trim() ? String(perfil.alias).trim() : '';
      if (al) entry.alias = al;
    });
  }

  let result = Object.values(playerMap);
  const cat = String(categoria || '').trim();
  if (cat) result = result.filter((pl) => pl.nivel === cat);

  if (scope === 'nacional' && pais && String(pais).trim()) {
    const needle = normPaisRanking(pais);
    result = result.filter((pl) => normPaisRanking(pl.pais) === needle);
  }

  result.sort((a, b) => b.puntos_total - a.puntos_total || b.torneos_count - a.torneos_count);

  return result;
}

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

function countryLabelWithFlag(rawPais) {
  const p = String(rawPais || '').trim();
  if (!p) return '';
  const maybe = getFlag(p);
  if (maybe && p.startsWith(maybe)) return p;
  return maybe ? `${maybe} ${p}` : p;
}

/** Normaliza nombre de país (quita bandera inicial, minúsculas, sin acentos). */
function normalizeNombrePaisRanking(s) {
  return String(s || '')
    .replace(/^[\p{Emoji_Presentation}\uFE0F\s]+/u, '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Etiqueta del filtro subnacional según país (español).
 * Argentina → Provincia · EE. UU. → Estado · España → Región · resto → Estado / Región
 */
function rankingEtiquetaProvinciaSegunPais(paisRaw) {
  const raw = String(paisRaw || '').trim();
  if (!raw) return 'Provincia';
  const n = normalizeNombrePaisRanking(raw);
  if (!n) return 'Provincia';
  if (n === 'argentina' || n.startsWith('argentina')) return 'Provincia';
  if (
    n.includes('estados unidos') ||
    n === 'usa' ||
    n.replace(/\s+/g, '') === 'eeuu' ||
    n.startsWith('ee. uu')
  ) {
    return 'Estado';
  }
  if (n === 'espana' || n === 'españa' || n.startsWith('espana') || n.startsWith('españa')) return 'Región';
  return 'Estado / Región';
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

/** `<select>` compacto alineado con RankingFilterDropdown (fondo oscuro del hub). */
const RANKING_COMPACT_SELECT_STYLE = {
  width: '100%',
  minWidth: 0,
  minHeight: '40px',
  padding: '9px 12px',
  borderRadius: '10px',
  border: '1px solid rgba(255,255,255,0.28)',
  fontSize: '13px',
  fontWeight: 600,
  background: 'rgba(15,23,42,0.42)',
  color: '#f8fafc',
  boxSizing: 'border-box',
  cursor: 'pointer',
  outline: 'none',
  fontFamily: 'inherit',
};

const RANKING_COMPACT_FILTER_CELL = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  minWidth: '130px',
  flex: '1 1 160px',
  maxWidth: '280px',
};

function RankingFilterDropdown({ label, value, onChange, options, disabled, ariaLabel, renderOptionLabel }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const labelId = useId();
  const listId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (ev) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(ev.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const selectedText = value
    ? (renderOptionLabel ? renderOptionLabel(value) : value)
    : 'Todos';

  return (
    <div
      ref={rootRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        minWidth: '130px',
        flex: '1 1 150px',
        position: 'relative',
      }}
    >
      <span id={labelId} style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.88)' }}>
        {label}
      </span>
      <button
        type="button"
        disabled={disabled}
        id={`${listId}-trigger`}
        onClick={() => setOpen((v) => !v)}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        style={{
          width: '100%',
          minHeight: '40px',
          padding: '9px 12px',
          borderRadius: '10px',
          border: '1px solid rgba(255,255,255,0.28)',
          fontSize: '13px',
          background: 'rgba(15,23,42,0.42)',
          color: '#f8fafc',
          boxSizing: 'border-box',
          textAlign: 'left',
          opacity: disabled ? 0.55 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedText}</span>
        <span aria-hidden style={{ fontSize: '12px', opacity: 0.9 }}>▾</span>
      </button>
      {open && !disabled ? (
        <div
          id={listId}
          role="listbox"
          aria-labelledby={labelId}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            zIndex: 70,
            borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(15,23,42,0.92)',
            backdropFilter: 'blur(6px)',
            boxShadow: '0 10px 24px rgba(0,0,0,0.28)',
            maxHeight: '240px',
            overflowY: 'auto',
          }}
        >
          <button
            type="button"
            role="option"
            aria-selected={!value}
            onClick={() => {
              onChange('');
              setOpen(false);
            }}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: 'none',
              background: !value ? 'rgba(99,102,241,0.28)' : 'transparent',
              color: '#fff',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            Todos
          </button>
          {options.map((o) => {
            const active = value === o;
            return (
              <button
                key={o}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(o);
                  setOpen(false);
                }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: 'none',
                  background: active ? 'rgba(99,102,241,0.28)' : 'transparent',
                  color: '#fff',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                {renderOptionLabel ? renderOptionLabel(o) : o}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default function Rankings() {
  const location = useLocation();
  const narrow = useMediaNarrow(520);
  const [activeTab, setActiveTab] = useState('local');
  const [sedes, setSedes] = useState([]);
  const [sedesLoadError, setSedesLoadError] = useState('');
  const [selectedCategoria, setSelectedCategoria] = useState('');
  const [selectedGeneroTorneo, setSelectedGeneroTorneo] = useState('');
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(false);
  /** Si el fetch falla (red, timeout, 5xx), mostramos vacío amigable en lugar del mensaje de error técnico. */
  const [rankingSinDatosDisponibles, setRankingSinDatosDisponibles] = useState(false);

  const [localPais, setLocalPais] = useState('');
  const [localProvincia, setLocalProvincia] = useState('');
  const [localCiudad, setLocalCiudad] = useState('');

  const [nacionalPais, setNacionalPais] = useState('');
  const [modalJugadorRankings, setModalJugadorRankings] = useState(null);

  const paisesDesdeSedes = useMemo(
    () =>
      [...new Set(sedes.map((s) => String(s.pais || '').trim()).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, 'es')
      ),
    [sedes]
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

  const ciudadesLocalOpciones = useMemo(() => {
    const p = String(localPais || '').trim().toLowerCase();
    if (!p) return [];
    const prov = String(localProvincia || '').trim();
    const set = new Set();
    for (const s of sedes) {
      if (String(s.pais || '').trim().toLowerCase() !== p) continue;
      if (prov && String(s.provincia || '').trim() !== prov) continue;
      const c = String(s.ciudad || '').trim();
      if (c) set.add(c);
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'es'));
  }, [sedes, localPais, localProvincia]);

  const etiquetaProvinciaLocal = useMemo(() => rankingEtiquetaProvinciaSegunPais(localPais), [localPais]);

  useEffect(() => {
    let cancelled = false;
    setSedesLoadError('');
    (async () => {
      const { data, error } = await supabase.from('sedes').select('id, nombre, pais, provincia, ciudad');
      if (cancelled) return;
      if (error) {
        console.error('[Rankings] sedes', error);
        setSedes([]);
        setSedesLoadError('No se pudieron cargar las sedes.');
        return;
      }
      setSedes(Array.isArray(data) ? data : []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setRankingSinDatosDisponibles(false);
    setRankings([]);

    (async () => {
      try {
        const data = await fetchRankingsSupabase({
          scope: activeTab,
          pais: activeTab === 'local' ? localPais : activeTab === 'nacional' ? nacionalPais : '',
          provincia: activeTab === 'local' ? localProvincia : '',
          ciudad: activeTab === 'local' ? localCiudad : '',
          categoria: selectedCategoria,
          tipoCompetencia: selectedGeneroTorneo,
        });
        if (cancelled) return;
        setRankingSinDatosDisponibles(false);
        setRankings(Array.isArray(data) ? data : []);
      } catch (e) {
        if (cancelled) return;
        console.error('[Rankings] fetchRankingsSupabase', e);
        setRankingSinDatosDisponibles(true);
        setRankings([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTab, selectedCategoria, selectedGeneroTorneo, localPais, localProvincia, localCiudad, nacionalPais]);

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
                setSelectedGeneroTorneo('');
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

        {/* Filtros: Local = país → provincia → ciudad; categoría y tipo de torneo = selects compactos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '12px' }}>
          {activeTab === 'local' && (
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <RankingFilterDropdown
                label="País"
                value={localPais}
                onChange={(v) => {
                  setLocalPais(v);
                  setLocalProvincia('');
                  setLocalCiudad('');
                }}
                options={paisesDesdeSedes}
                disabled={paisesDesdeSedes.length === 0}
                ariaLabel="País para ranking local"
                renderOptionLabel={countryLabelWithFlag}
              />
              <RankingFilterDropdown
                label={etiquetaProvinciaLocal}
                value={localProvincia}
                onChange={(v) => {
                  setLocalProvincia(v);
                  setLocalCiudad('');
                }}
                options={provinciasLocalOpciones}
                disabled={!localPais.trim()}
                ariaLabel={`${etiquetaProvinciaLocal} para ranking local`}
              />
              <RankingFilterDropdown
                label="Ciudad"
                value={localCiudad}
                onChange={setLocalCiudad}
                options={ciudadesLocalOpciones}
                disabled={!localPais.trim() || ciudadesLocalOpciones.length === 0}
                ariaLabel="Ciudad para ranking local"
              />
            </div>
          )}
          {activeTab === 'local' && sedesLoadError ? (
            <span style={{ fontSize: '12px', color: '#fecaca' }}>{sedesLoadError}</span>
          ) : null}
          {activeTab === 'nacional' && (
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <RankingFilterDropdown
                label="País"
                value={nacionalPais}
                onChange={setNacionalPais}
                options={paisesDesdeSedes}
                disabled={paisesDesdeSedes.length === 0}
                ariaLabel="País para ranking nacional"
                renderOptionLabel={countryLabelWithFlag}
              />
            </div>
          )}
          {(activeTab === 'local' || activeTab === 'nacional' || activeTab === 'internacional') && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'flex-end' }}>
              <div style={RANKING_COMPACT_FILTER_CELL}>
                <label htmlFor="ranking-filtro-categoria" style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.88)' }}>
                  Categoría
                </label>
                <select
                  id="ranking-filtro-categoria"
                  value={selectedCategoria}
                  onChange={(e) => setSelectedCategoria(e.target.value)}
                  aria-label="Filtrar ranking por categoría"
                  style={RANKING_COMPACT_SELECT_STYLE}
                >
                  <option value="">Todos</option>
                  {CATEGORIAS_NIVEL_TODAS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div style={RANKING_COMPACT_FILTER_CELL}>
                <label htmlFor="ranking-filtro-tipo-torneo" style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.88)' }}>
                  Tipo de torneo
                </label>
                <select
                  id="ranking-filtro-tipo-torneo"
                  value={selectedGeneroTorneo}
                  onChange={(e) => setSelectedGeneroTorneo(e.target.value)}
                  aria-label="Filtrar ranking por tipo de torneo (Masculino, Femenino o Mixto)"
                  style={RANKING_COMPACT_SELECT_STYLE}
                >
                  <option value="">Todos</option>
                  {TORNEO_GENERO_COMPETENCIA_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
          {(selectedCategoria ||
            selectedGeneroTorneo ||
            (activeTab === 'local' && (localPais || localProvincia || localCiudad)) ||
            (activeTab === 'nacional' && nacionalPais)) && (
            <button
              type="button"
              onClick={() => {
                setSelectedCategoria('');
                setSelectedGeneroTorneo('');
                setLocalPais('');
                setLocalProvincia('');
                setLocalCiudad('');
                setNacionalPais('');
              }}
              style={{
                alignSelf: 'flex-start',
                padding: '8px 14px',
                borderRadius: '8px',
                border: 'none',
                background: 'rgba(255,255,255,0.2)',
                color: 'white',
                fontSize: '13px',
                cursor: 'pointer',
                fontWeight: '600',
              }}
            >
              ✕ Limpiar filtros
            </button>
          )}
        </div>

        {/* Scope description */}
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)', marginBottom: '12px' }}>
          {activeTab === 'local' &&
            (localPais || localProvincia || localCiudad
              ? `Ranking local · ${[localPais || null, localProvincia || null, localCiudad || null].filter(Boolean).join(' · ')}`
              : 'Ranking local · torneos de club finalizados (filtrá por ubicación o dejá Todos)')}
          {activeTab === 'nacional' &&
            (nacionalPais
              ? `Ranking nacional · ${countryLabelWithFlag(nacionalPais)}${selectedCategoria ? ` · ${selectedCategoria}` : ''}`
              : 'Ranking nacional · todos los países o elegí uno para filtrar jugadores por país del perfil')}
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
                          onClick={() => setModalJugadorRankings(hintFromRankingPlayer(player))}
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
      <ModalJugador
        open={Boolean(modalJugadorRankings)}
        onClose={() => setModalJugadorRankings(null)}
        hint={modalJugadorRankings}
      />
      <BottomNav />
    </div>
  );
}
