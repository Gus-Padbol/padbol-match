import React, { useState, useEffect, useMemo, useRef, useId } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { PAISES_TELEFONO_PRINCIPALES, PAISES_TELEFONO_OTROS } from '../constants/paisesTelefono';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import {
  HUB_CONTENT_PADDING_BOTTOM_PX,
  hubContentPaddingTopCss,
  hubInstagramColumnWrapStyle,
} from '../constants/hubLayout';
import { supabase } from '../supabaseClient';
import { nombreCompletoJugadorPerfil, formatAliasConArroba } from '../utils/jugadorPerfil';
import ModalJugador, { hintFromRankingPlayer } from '../components/ModalJugador';
import { IconGeroFiltros } from '../components/icons/GeroIcons';
import { CATEGORIAS_NIVEL_TODAS } from '../constants/jugadorCategoria';
import { TORNEO_GENERO_COMPETENCIA_OPTIONS } from '../constants/torneoCompetencia';
import { torneoTipoCompetenciaDb } from '../utils/torneoFormatters';
import {
  TORNEO_DEPORTE_PADBOL,
  TORNEO_DEPORTE_OPTIONS,
  etiquetaDeporteTorneo,
  normalizeTorneoDeporte,
} from '../utils/torneoDeporteFormato';

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
async function fetchRankingsSupabase({ scope, pais, provincia, ciudad, categoria, tipoCompetencia, deporte }) {
  const nivelesPermitidos = SCOPE_NIVELES_RANKING[scope] || SCOPE_NIVELES_RANKING.internacional;
  const dep = normalizeTorneoDeporte(deporte);

  let torneosQuery = supabase
    .from('torneos')
    .select('id, sede_id, nivel_torneo, nombre, tipo_competencia, tipo_torneo_genero, genero_competencia, categoria_edad, deporte')
    .eq('estado', 'finalizado')
    .in('nivel_torneo', nivelesPermitidos)
    .eq('deporte', dep);

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

  const depByTorneoId = {};
  torneos.forEach((t) => {
    depByTorneoId[t.id] = normalizeTorneoDeporte(t.deporte);
  });

  const { data: puntosRaw, error: errP } = await supabase
    .from('tabla_puntos')
    .select('torneo_id, equipo_id, posicion, puntos, deporte')
    .in('torneo_id', torneoIds)
    .eq('deporte', dep);
  if (errP) throw errP;
  if (!puntosRaw?.length) return [];

  const puntos = puntosRaw.filter((p) => {
    const d =
      p.deporte != null && String(p.deporte).trim() !== ''
        ? normalizeTorneoDeporte(p.deporte)
        : depByTorneoId[p.torneo_id];
    return d === dep;
  });
  if (!puntos.length) return [];

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

/** Categorías mostradas solo en el tab Internacional FIPA (sin Principiante ni 5ta–3ra). */
const CATEGORIAS_INTERNACIONAL_FIPA = ['2da', '1ra', 'Elite'];

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

/** Fila de filtro dentro del bottom sheet (fondo claro). */
const RANKING_SHEET_FILTER_ROW = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  marginBottom: '18px',
};

const RANKING_SHEET_SELECT_STYLE = {
  width: '100%',
  minWidth: 0,
  minHeight: '44px',
  padding: '10px 12px',
  borderRadius: '10px',
  border: '1px solid var(--border)',
  fontSize: '15px',
  fontWeight: 600,
  background: 'var(--bg-card)',
  color: 'var(--text-primary)',
  boxSizing: 'border-box',
  cursor: 'pointer',
  outline: 'none',
  fontFamily: 'inherit',
};

function RankingFilterDropdown({ label, value, onChange, options, disabled, ariaLabel, renderOptionLabel, variant = 'hub' }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const labelId = useId();
  const listId = useId();
  const isSheet = variant === 'sheet';

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

  const labelColor = 'var(--text-secondary)';
  const btnBorder = '1px solid var(--border)';
  const btnBg = 'var(--bg-card)';
  const btnColor = 'var(--text-primary)';
  const panelBorder = '1px solid var(--border)';
  const panelBg = 'var(--bg-card)';
  const optColor = 'var(--text-primary)';
  const optActiveBg = 'rgba(225, 27, 34, 0.14)';

  return (
    <div
      ref={rootRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        minWidth: 0,
        width: '100%',
        position: 'relative',
      }}
    >
      <span id={labelId} style={{ fontSize: '12px', fontWeight: 700, color: labelColor }}>
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
          minHeight: '44px',
          padding: '9px 12px',
          borderRadius: '10px',
          border: btnBorder,
          fontSize: isSheet ? '15px' : '13px',
          background: btnBg,
          color: btnColor,
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
            zIndex: 80,
            borderRadius: '10px',
            border: panelBorder,
            background: panelBg,
            backdropFilter: undefined,
            boxShadow: '0 10px 24px rgba(0,0,0,0.18)',
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
              background: !value ? optActiveBg : 'transparent',
              color: optColor,
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '15px',
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
                  background: active ? optActiveBg : 'transparent',
                  color: optColor,
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '15px',
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
  const [searchParams, setSearchParams] = useSearchParams();
  const narrow = useMediaNarrow(520);
  const [activeTab, setActiveTab] = useState('local');
  /** Solo torneos de este deporte; Nacional/Internacional FIPA solo con Padbol en la UI. */
  const [rankingDeporte, setRankingDeporte] = useState(TORNEO_DEPORTE_PADBOL);

  useEffect(() => {
    const raw = searchParams.get('deporte');
    if (raw == null || String(raw).trim() === '') return;
    const d = normalizeTorneoDeporte(raw);
    setRankingDeporte((prev) => (prev === d ? prev : d));
  }, [searchParams]);
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

  const [rankingFilterSheetOpen, setRankingFilterSheetOpen] = useState(false);
  /** Borrador de filtros mientras el panel está abierto; al cerrar sin Aplicar se descarta. */
  const [rankingFilterSheetDraft, setRankingFilterSheetDraft] = useState(null);

  const tabsForDeporte = useMemo(
    () => (rankingDeporte === TORNEO_DEPORTE_PADBOL ? TABS : TABS.filter((t) => t.id === 'local')),
    [rankingDeporte],
  );

  const paisesDesdeSedes = useMemo(
    () =>
      [...new Set(sedes.map((s) => String(s.pais || '').trim()).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, 'es')
      ),
    [sedes]
  );

  const rankingActiveFilterCount = useMemo(() => {
    if (activeTab === 'local') {
      let n = 0;
      if (String(localPais || '').trim()) n += 1;
      if (String(localProvincia || '').trim()) n += 1;
      if (String(localCiudad || '').trim()) n += 1;
      if (String(selectedCategoria || '').trim()) n += 1;
      if (String(selectedGeneroTorneo || '').trim()) n += 1;
      return n;
    }
    if (activeTab === 'nacional') {
      let n = 0;
      if (String(nacionalPais || '').trim()) n += 1;
      if (String(selectedCategoria || '').trim()) n += 1;
      if (String(selectedGeneroTorneo || '').trim()) n += 1;
      return n;
    }
    if (activeTab === 'internacional') {
      let n = 0;
      if (String(selectedCategoria || '').trim()) n += 1;
      if (String(selectedGeneroTorneo || '').trim()) n += 1;
      return n;
    }
    return 0;
  }, [
    activeTab,
    localPais,
    localProvincia,
    localCiudad,
    nacionalPais,
    selectedCategoria,
    selectedGeneroTorneo,
  ]);

  const provinciasSheetOpciones = useMemo(() => {
    const d = rankingFilterSheetDraft;
    if (!d) return [];
    const p = String(d.localPais || '').trim().toLowerCase();
    if (!p) return [];
    const set = new Set();
    for (const s of sedes) {
      if (String(s.pais || '').trim().toLowerCase() !== p) continue;
      const pr = s.provincia != null ? String(s.provincia).trim() : '';
      if (pr) set.add(pr);
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'es'));
  }, [sedes, rankingFilterSheetDraft]);

  const ciudadesSheetOpciones = useMemo(() => {
    const d = rankingFilterSheetDraft;
    if (!d) return [];
    const p = String(d.localPais || '').trim().toLowerCase();
    if (!p) return [];
    const prov = String(d.localProvincia || '').trim();
    const set = new Set();
    for (const s of sedes) {
      if (String(s.pais || '').trim().toLowerCase() !== p) continue;
      if (prov && String(s.provincia || '').trim() !== prov) continue;
      const c = String(s.ciudad || '').trim();
      if (c) set.add(c);
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'es'));
  }, [sedes, rankingFilterSheetDraft]);

  const etiquetaProvinciaSheet = useMemo(
    () => rankingEtiquetaProvinciaSegunPais(rankingFilterSheetDraft?.localPais),
    [rankingFilterSheetDraft?.localPais]
  );

  const openRankingFilterSheet = () => {
    setRankingFilterSheetDraft({
      localPais,
      localProvincia,
      localCiudad,
      nacionalPais,
      selectedCategoria,
      selectedGeneroTorneo,
    });
    setRankingFilterSheetOpen(true);
  };

  const discardRankingFilterSheet = () => {
    setRankingFilterSheetOpen(false);
    setRankingFilterSheetDraft(null);
  };

  const patchRankingFilterSheetDraft = (patch) => {
    setRankingFilterSheetDraft((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      if (Object.prototype.hasOwnProperty.call(patch, 'localPais')) {
        next.localProvincia = '';
        next.localCiudad = '';
      }
      if (Object.prototype.hasOwnProperty.call(patch, 'localProvincia')) {
        next.localCiudad = '';
      }
      return next;
    });
  };

  const applyRankingFilterSheet = () => {
    if (!rankingFilterSheetDraft) return;
    let cat = rankingFilterSheetDraft.selectedCategoria;
    if (activeTab === 'internacional' && cat && !CATEGORIAS_INTERNACIONAL_FIPA.includes(cat)) {
      cat = '';
    }
    setLocalPais(rankingFilterSheetDraft.localPais);
    setLocalProvincia(rankingFilterSheetDraft.localProvincia);
    setLocalCiudad(rankingFilterSheetDraft.localCiudad);
    setNacionalPais(rankingFilterSheetDraft.nacionalPais);
    setSelectedCategoria(cat);
    setSelectedGeneroTorneo(rankingFilterSheetDraft.selectedGeneroTorneo);
    setRankingFilterSheetOpen(false);
    setRankingFilterSheetDraft(null);
  };

  const clearRankingFilterSheetDraft = () => {
    setRankingFilterSheetDraft({
      localPais: '',
      localProvincia: '',
      localCiudad: '',
      nacionalPais: '',
      selectedCategoria: '',
      selectedGeneroTorneo: '',
    });
  };

  useEffect(() => {
    if (!rankingFilterSheetOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setRankingFilterSheetOpen(false);
        setRankingFilterSheetDraft(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rankingFilterSheetOpen]);

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
          deporte: rankingDeporte,
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
  }, [
    activeTab,
    rankingDeporte,
    selectedCategoria,
    selectedGeneroTorneo,
    localPais,
    localProvincia,
    localCiudad,
    nacionalPais,
  ]);

  useEffect(() => {
    if (rankingDeporte !== TORNEO_DEPORTE_PADBOL && activeTab !== 'local') {
      setActiveTab('local');
    }
  }, [rankingDeporte, activeTab]);

  // ── Styles ──────────────────────────────────────────────────────────────────

  const containerStyle = useMemo(
    () => ({
      minHeight: '100dvh',
      background: 'var(--bg-page)',
      color: 'var(--text-primary)',
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
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: narrow ? '0.04em' : '0.06em',
    background: 'var(--pm-color-muted-bg)',
    borderBottom: '2px solid var(--border)',
    whiteSpace: 'nowrap',
  };

  const trStyle = (idx) => ({
    background:
      idx === 0
        ? 'rgba(217, 119, 6, 0.14)'
        : idx === 1
          ? 'var(--pm-color-muted-bg)'
          : idx === 2
            ? 'rgba(217, 119, 6, 0.08)'
            : 'var(--bg-card)',
    borderBottom: '1px solid var(--border)',
    transition: 'background 0.15s',
  });

  const tdStyle = { padding: narrow ? '8px 6px' : '11px 14px', verticalAlign: 'middle' };

  const showPaisCol = activeTab === 'internacional';
  /** En mobile el encabezado "Torneos" se cortaba; el conteo es secundario frente a puntos. */
  const showTorneosCol = !narrow;

  const posStyle = (pos) => {
    if (pos === 1) return { fontSize: '20px', fontWeight: '900', color: '#d97706' };
    if (pos === 2) return { fontSize: '17px', fontWeight: '800', color: 'var(--text-secondary)' };
    if (pos === 3) return { fontSize: '16px', fontWeight: '700', color: '#b45309' };
    return { fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)' };
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={containerStyle}>
      <AppHeader title="Ranking" />
      <div style={innerStyle}>
        {/* Deporte del ranking (encima de Local / Nacional / FIPA) */}
        <div style={{ marginBottom: '12px' }}>
          <label
            htmlFor="ranking-deporte-select"
            style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 700,
              color: 'var(--text-secondary)',
              marginBottom: '6px',
              letterSpacing: '0.02em',
            }}
          >
            Deporte
          </label>
          <select
            id="ranking-deporte-select"
            value={rankingDeporte}
            onChange={(e) => {
              const v = normalizeTorneoDeporte(e.target.value);
              setRankingDeporte(v);
              setSearchParams(
                (prev) => {
                  const next = new URLSearchParams(prev);
                  if (v === TORNEO_DEPORTE_PADBOL) next.delete('deporte');
                  else next.set('deporte', v);
                  return next;
                },
                { replace: true }
              );
              if (v !== TORNEO_DEPORTE_PADBOL) {
                setRankingFilterSheetOpen(false);
                setRankingFilterSheetDraft(null);
                setActiveTab('local');
              }
            }}
            style={{
              ...RANKING_SHEET_SELECT_STYLE,
              width: '100%',
              maxWidth: '420px',
              display: 'block',
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          >
            {TORNEO_DEPORTE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} style={{ color: 'var(--text-primary)' }}>
                {o.label}
              </option>
            ))}
          </select>
          {rankingDeporte !== TORNEO_DEPORTE_PADBOL ? (
            <p style={{ margin: '8px 0 0', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.45, textAlign: 'center' }}>
              Nacional e Internacional FIPA aplican solo a torneos de Padbol; aquí ves el ranking local de{' '}
              {etiquetaDeporteTorneo(rankingDeporte)}.
            </p>
          ) : null}
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: '4px', background: 'var(--pm-color-muted-bg)', borderRadius: '12px', padding: '4px', marginBottom: '12px', border: '1px solid var(--border)' }}>
          {tabsForDeporte.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setRankingFilterSheetOpen(false);
                setRankingFilterSheetDraft(null);
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
                background: activeTab === tab.id ? 'var(--accent)' : 'transparent',
                color: activeTab === tab.id ? '#ffffff' : 'var(--text-secondary)',
                transition: 'all 0.18s',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
          <button
            type="button"
            onClick={openRankingFilterSheet}
            aria-label="Abrir filtros del ranking"
            style={{
              alignSelf: 'flex-start',
              padding: '10px 16px',
              borderRadius: '12px',
              border: rankingActiveFilterCount > 0 ? '2px solid var(--accent)' : '1px solid var(--border)',
              background:
                rankingActiveFilterCount > 0
                  ? 'rgba(225, 27, 34, 0.12)'
                  : 'var(--bg-card)',
              color: 'var(--text-primary)',
              fontSize: '14px',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: rankingActiveFilterCount > 0 ? '0 2px 10px rgba(225, 27, 34, 0.12)' : 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <IconGeroFiltros size={18} style={{ color: 'inherit' }} />
            Filtrar{rankingActiveFilterCount > 0 ? ` (${rankingActiveFilterCount})` : ''}
          </button>
          {activeTab === 'local' && sedesLoadError ? (
            <span style={{ fontSize: '12px', color: 'var(--accent)' }}>{sedesLoadError}</span>
          ) : null}
        </div>

        {/* Scope description */}
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
          {activeTab === 'local' &&
            (localPais || localProvincia || localCiudad
              ? `Ranking local · ${etiquetaDeporteTorneo(rankingDeporte)} · ${[localPais || null, localProvincia || null, localCiudad || null].filter(Boolean).join(' · ')}`
              : `Ranking local · ${etiquetaDeporteTorneo(rankingDeporte)} · torneos de club finalizados (filtra por ubicación o deja Todos)`)}
          {activeTab === 'nacional' &&
            (nacionalPais
              ? `Ranking nacional · ${etiquetaDeporteTorneo(rankingDeporte)} · ${countryLabelWithFlag(nacionalPais)}${selectedCategoria ? ` · ${selectedCategoria}` : ''}`
              : `Ranking nacional · ${etiquetaDeporteTorneo(rankingDeporte)} · todos los países o elige uno para filtrar jugadores por país del perfil`)}
          {activeTab === 'internacional' && (
            <>
              Ranking FIPA · {etiquetaDeporteTorneo(rankingDeporte)} · torneos internacionales y mundiales finalizados
              {selectedCategoria ? ` · Categoría: ${selectedCategoria}` : ''}
            </>
          )}
        </div>

        {/* Table card */}
        <div style={{ background: 'var(--bg-card)', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0, 0, 0, 0.12)', border: '1px solid var(--border)' }}>
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '15px' }}>
              Cargando rankings...
            </div>
          ) : rankings.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>🏆</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '15px', fontWeight: '600' }}>
                {rankingSinDatosDisponibles ? 'Sin datos disponibles' : 'Sin datos de ranking todavía'}
              </div>
              {!rankingSinDatosDisponibles ? (
                <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '6px', opacity: 0.9 }}>
                  No hay jugadores con puntos para esta combinación de filtros, o los puntos aún no se asignaron.
                </div>
              ) : (
                <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '6px', lineHeight: 1.5 }}>
                  Aún no hay torneos finalizados en esta categoría. ¡Jugá un torneo y aparecé en el ranking!
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
                  <th style={{ ...thStyle, textAlign: 'center', color: 'var(--accent)' }}>Puntos</th>
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
                                border: '2px solid var(--border)',
                              }}
                            />
                          ) : (
                            <div style={{ width: `${avatarPx}px`, height: `${avatarPx}px`, borderRadius: '50%', background: 'linear-gradient(135deg, #E11B22, #b91c1c)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: narrow ? '14px' : '17px' }}>
                              👤
                            </div>
                          )}
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: narrow ? '12px' : '14px', fontWeight: '600', color: 'var(--text-primary)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {etiquetaRankingJugador(player)}
                            </div>
                            {String(player.alias || '').trim() ? (
                              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {formatAliasConArroba(String(player.alias).trim())}
                              </div>
                            ) : null}
                          </div>
                        </button>
                      </td>

                      {showPaisCol ? (
                        <td style={{ ...tdStyle, textAlign: 'center', fontSize: narrow ? '18px' : '22px' }}>
                          {flag || <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>—</span>}
                        </td>
                      ) : null}

                      <td style={{ ...tdStyle, fontSize: narrow ? '11px' : '12px', color: 'var(--text-secondary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {player.equipo_nombre || <span style={{ color: 'var(--text-secondary)' }}>—</span>}
                      </td>

                      {showTorneosCol ? (
                        <td style={{ ...tdStyle, textAlign: 'center', fontSize: narrow ? '11px' : '13px', color: 'var(--text-secondary)' }}>
                          {player.torneos_count}
                        </td>
                      ) : null}

                      {/* Points */}
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <span style={{
                          background: pos === 1 ? 'rgba(217, 119, 6, 0.22)' : pos === 2 ? 'var(--pm-color-muted-bg)' : pos === 3 ? 'rgba(217, 119, 6, 0.12)' : 'rgba(139, 92, 246, 0.18)',
                          color:      pos === 1 ? '#92400e' : pos === 2 ? 'var(--text-secondary)' : pos === 3 ? '#92400e' : 'var(--accent)',
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
          <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '11px', color: 'var(--text-secondary)' }}>
            {rankings.length} jugador{rankings.length !== 1 ? 'es' : ''} mostrado{rankings.length !== 1 ? 's' : ''}
            {selectedCategoria && ` · Categoría: ${selectedCategoria}`}
          </div>
        )}
      </div>

      {rankingFilterSheetOpen && rankingFilterSheetDraft ? (
        <div
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(15, 23, 42, 0.5)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            alignItems: 'stretch',
            padding: 0,
            boxSizing: 'border-box',
          }}
          onClick={discardRankingFilterSheet}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ranking-filters-sheet-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-card)',
              borderRadius: '18px 18px 0 0',
              maxHeight: 'min(88vh, 640px)',
              overflowY: 'auto',
              paddingLeft: 'max(18px, env(safe-area-inset-left, 0px))',
              paddingRight: 'max(18px, env(safe-area-inset-right, 0px))',
              paddingTop: '10px',
              paddingBottom: 'max(18px, env(safe-area-inset-bottom, 0px))',
              boxShadow: '0 -8px 32px rgba(0,0,0,0.18)',
            }}
          >
            <div
              aria-hidden
              style={{
                width: '40px',
                height: '4px',
                borderRadius: '2px',
                background: 'var(--border)',
                margin: '0 auto 14px',
              }}
            />
            <h2
              id="ranking-filters-sheet-title"
              style={{ margin: '0 0 18px', fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}
            >
              Filtros
            </h2>

            {activeTab === 'local' ? (
              <>
                <div style={RANKING_SHEET_FILTER_ROW}>
                  <RankingFilterDropdown
                    variant="sheet"
                    label="País"
                    value={rankingFilterSheetDraft.localPais}
                    onChange={(v) => patchRankingFilterSheetDraft({ localPais: v })}
                    options={paisesDesdeSedes}
                    disabled={paisesDesdeSedes.length === 0}
                    ariaLabel="País para ranking local"
                    renderOptionLabel={countryLabelWithFlag}
                  />
                </div>
                {String(rankingFilterSheetDraft.localPais || '').trim() ? (
                  <div style={RANKING_SHEET_FILTER_ROW}>
                    <RankingFilterDropdown
                      variant="sheet"
                      label={etiquetaProvinciaSheet}
                      value={rankingFilterSheetDraft.localProvincia}
                      onChange={(v) => patchRankingFilterSheetDraft({ localProvincia: v })}
                      options={provinciasSheetOpciones}
                      disabled={!String(rankingFilterSheetDraft.localPais || '').trim()}
                      ariaLabel={`${etiquetaProvinciaSheet} para ranking local`}
                    />
                  </div>
                ) : null}
                {String(rankingFilterSheetDraft.localProvincia || '').trim() ? (
                  <div style={RANKING_SHEET_FILTER_ROW}>
                    <label
                      htmlFor="ranking-sheet-local-ciudad"
                      style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}
                    >
                      Ciudad
                    </label>
                    <select
                      id="ranking-sheet-local-ciudad"
                      value={rankingFilterSheetDraft.localCiudad}
                      onChange={(e) => patchRankingFilterSheetDraft({ localCiudad: e.target.value })}
                      aria-label="Ciudad para ranking local"
                      style={RANKING_SHEET_SELECT_STYLE}
                    >
                      <option value="">Todos</option>
                      {ciudadesSheetOpciones.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </>
            ) : null}

            {activeTab === 'nacional' ? (
              <div style={RANKING_SHEET_FILTER_ROW}>
                <RankingFilterDropdown
                  variant="sheet"
                  label="País"
                  value={rankingFilterSheetDraft.nacionalPais}
                  onChange={(v) => patchRankingFilterSheetDraft({ nacionalPais: v })}
                  options={paisesDesdeSedes}
                  disabled={paisesDesdeSedes.length === 0}
                  ariaLabel="País para ranking nacional"
                  renderOptionLabel={countryLabelWithFlag}
                />
              </div>
            ) : null}

            <div style={RANKING_SHEET_FILTER_ROW}>
              <label
                htmlFor="ranking-sheet-categoria"
                style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}
              >
                Categoría
              </label>
              <select
                id="ranking-sheet-categoria"
                value={rankingFilterSheetDraft.selectedCategoria}
                onChange={(e) =>
                  patchRankingFilterSheetDraft({ selectedCategoria: e.target.value })
                }
                aria-label="Filtrar ranking por categoría"
                style={RANKING_SHEET_SELECT_STYLE}
              >
                <option value="">Todos</option>
                {(activeTab === 'internacional' ? CATEGORIAS_INTERNACIONAL_FIPA : CATEGORIAS_NIVEL_TODAS).map(
                  (c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  )
                )}
              </select>
            </div>

            <div style={{ ...RANKING_SHEET_FILTER_ROW, marginBottom: '8px' }}>
              <label
                htmlFor="ranking-sheet-tipo-torneo"
                style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}
              >
                Tipo de torneo
              </label>
              <select
                id="ranking-sheet-tipo-torneo"
                value={rankingFilterSheetDraft.selectedGeneroTorneo}
                onChange={(e) =>
                  patchRankingFilterSheetDraft({ selectedGeneroTorneo: e.target.value })
                }
                aria-label="Filtrar ranking por tipo de torneo (Masculino, Femenino o Mixto)"
                style={RANKING_SHEET_SELECT_STYLE}
              >
                <option value="">Todos</option>
                {TORNEO_GENERO_COMPETENCIA_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                marginTop: '8px',
                paddingTop: '16px',
                borderTop: '1px solid var(--border)',
              }}
            >
              <button
                type="button"
                onClick={applyRankingFilterSheet}
                style={{
                  minHeight: '48px',
                  fontSize: '16px',
                  fontWeight: 800,
                  borderRadius: '12px',
                  border: 'none',
                  background: 'var(--accent)',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                Aplicar
              </button>
              <button
                type="button"
                onClick={clearRankingFilterSheetDraft}
                style={{
                  minHeight: '44px',
                  fontSize: '15px',
                  fontWeight: 700,
                  borderRadius: '12px',
                  border: '1px solid var(--border)',
                  background: 'var(--pm-color-muted-bg)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                Limpiar todo
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ModalJugador
        open={Boolean(modalJugadorRankings)}
        onClose={() => setModalJugadorRankings(null)}
        hint={modalJugadorRankings}
      />
      <BottomNav />
    </div>
  );
}
