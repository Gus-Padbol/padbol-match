import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from './supabaseClient';
import {
  nombreCompletoJugadorPerfil,
  formatAliasConArroba,
  esCategoriaPendienteValidacion,
} from './utils/jugadorPerfil';
import { formatNivelTorneo } from './utils/torneoFormatters';
import { fetchTorneosConPuntosParaPerfil, emojiMedallaPosicionCompacta } from './utils/torneoHistorialPuntosJugador';
import {
  sumarPuntosPorAlcanceDesdeFilasTorneo,
  tieneAlgunoPuntosPorAlcance,
  contarTorneosUnicosConPuntos,
} from './utils/perfilPuntosResumen';

function instagramHandleFromStored(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      if (u.hostname.toLowerCase().includes('instagram.com')) {
        const parts = u.pathname.split('/').filter(Boolean);
        return parts[0] ? String(parts[0]).replace(/\/$/, '') : '';
      }
    } catch {
      return '';
    }
  }
  return s.replace(/^@/, '').trim();
}

const CATEGORIA_COLOR = {
  Principiante: '#78909c',
  '5ta': '#43a047',
  '4ta': '#039be5',
  '3ra': '#8e24aa',
  '2da': '#e53935',
  '1ra': '#f57c00',
  Elite: '#212121',
};

const wrap = {
  maxWidth: '520px',
  width: '100%',
  margin: '0 auto',
  padding: '20px',
  boxSizing: 'border-box',
};

export default function PerfilPublico() {
  const { alias: aliasParam } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [perfil, setPerfil] = useState(null);
  /** `null` = sin ids; `{ kind, row }` con fila del otro jugador (o `row: null` si no se encontró). */
  const [companeroDisplay, setCompaneroDisplay] = useState(null);
  const [torneosConPuntos, setTorneosConPuntos] = useState([]);
  const [mostrarTodosTorneosPublico, setMostrarTodosTorneosPublico] = useState(false);

  const aliasDecoded = useMemo(() => {
    try {
      return decodeURIComponent(String(aliasParam || '').trim());
    } catch {
      return String(aliasParam || '').trim();
    }
  }, [aliasParam]);

  const load = useCallback(async () => {
    const a = aliasDecoded;
    if (!a) {
      setPerfil(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setPerfil(null);
    setCompaneroDisplay(null);
    setTorneosConPuntos([]);

    const { data: rows, error } = await supabase.from('jugadores_perfil').select('*').ilike('alias', a).limit(8);

    console.log('[PerfilPublico] jugadores_perfil respuesta', { error, rows, rowCount: Array.isArray(rows) ? rows.length : 0 });

    if (error) {
      console.error('[PerfilPublico]', error);
      setPerfil(null);
      setLoading(false);
      return;
    }
    const list = Array.isArray(rows) ? rows : [];
    const aLower = a.toLowerCase();
    const match =
      list.find((r) => String(r.alias || '').trim().toLowerCase() === aLower) ||
      (list.length === 1 ? list[0] : null);

    if (!match) {
      setPerfil(null);
      setLoading(false);
      return;
    }

    console.log('[PerfilPublico] jugadores_perfil fila usada', match);

    setPerfil(match);

    const cid = match.companero_id != null ? String(match.companero_id).trim() : '';
    const uid = match.ultimo_companero_id != null ? String(match.ultimo_companero_id).trim() : '';
    if (cid) {
      const { data: comp } = await supabase
        .from('jugadores_perfil')
        .select('user_id, alias, foto_url, nombre')
        .eq('user_id', cid)
        .maybeSingle();
      setCompaneroDisplay({ kind: 'habitual', row: comp || null });
    } else if (uid) {
      const { data: comp } = await supabase
        .from('jugadores_perfil')
        .select('user_id, alias, foto_url, nombre')
        .eq('user_id', uid)
        .maybeSingle();
      setCompaneroDisplay({ kind: 'ultimo', row: comp || null });
    } else {
      setCompaneroDisplay(null);
    }

    try {
      const lista = await fetchTorneosConPuntosParaPerfil(match);
      setTorneosConPuntos(Array.isArray(lista) ? lista : []);
    } catch (e) {
      console.error('[PerfilPublico] torneos con puntos (fetch)', e);
      setTorneosConPuntos([]);
    }

    setLoading(false);
  }, [aliasDecoded]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setMostrarTodosTorneosPublico(false);
  }, [torneosConPuntos]);

  const puntosAlcancePublico = useMemo(() => {
    try {
      const filas = Array.isArray(torneosConPuntos) ? torneosConPuntos : [];
      return sumarPuntosPorAlcanceDesdeFilasTorneo(filas);
    } catch (e) {
      console.error('[PerfilPublico] puntos por alcance', e);
      return { club: 0, nacional: 0, fipa: 0 };
    }
  }, [torneosConPuntos]);

  const torneosUnicosConPuntosPublico = useMemo(() => {
    try {
      return contarTorneosUnicosConPuntos(Array.isArray(torneosConPuntos) ? torneosConPuntos : []);
    } catch (e) {
      console.error('[PerfilPublico] conteo torneos únicos', e);
      return 0;
    }
  }, [torneosConPuntos]);

  useEffect(() => {
    if (loading || !perfil) return;
    const ciudadClub = perfil.ciudad;
    const localidad = perfil.localidad;
    const nivelCat = perfil.nivel;
    const foto = perfil.foto_url;
    const instagram = perfil.instagram_url;
    const federado = perfil.es_federado;
    const pendVal = perfil.pendiente_validacion;
    const ciudadTrim = perfil.ciudad != null ? String(perfil.ciudad).trim() : '';
    const localidadTrimLog = perfil.localidad != null ? String(perfil.localidad).trim() : '';
    const nivelTxt =
      perfil.nivel != null && String(perfil.nivel) !== '' ? String(perfil.nivel) : '';
    const fotoUsable = perfil.foto_url != null && String(perfil.foto_url).trim() !== '';
    const igRaw =
      perfil.instagram_url != null && String(perfil.instagram_url) !== ''
        ? String(perfil.instagram_url)
        : '';
    let igHrefLog = '';
    if (igRaw && /^https?:\/\//i.test(igRaw)) igHrefLog = igRaw;
    else {
      const h = instagramHandleFromStored(igRaw);
      if (h) igHrefLog = `https://www.instagram.com/${encodeURIComponent(h)}/`;
    }
    console.log('[PerfilPublico] mapeo campos (verificación)', {
      'perfil.ciudad': ciudadClub,
      'UI club habitual': ciudadTrim ? `Club habitual: ${ciudadTrim}` : 'Sin definir',
      'perfil.localidad': localidad,
      'UI línea 📍 (si hay)': localidadTrimLog || '(oculta)',
      'perfil.nivel': nivelCat,
      'UI categoría (texto tal cual)': nivelTxt || '(vacío → Sin definir)',
      'perfil.pendiente_validacion': pendVal,
      'UI aviso pendiente': pendVal === true ? '(pendiente de validación)' : '(no)',
      'perfil.foto_url': foto,
      'UI muestra foto': fotoUsable,
      'perfil.instagram_url': instagram,
      'UI instagram href': igHrefLog || '(sin link)',
      'perfil.es_federado': federado,
      'UI federado': federado === true ? 'Sí' : federado === false ? 'No' : 'Sin definir',
    });
  }, [loading, perfil]);

  const pageStyle = {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    fontFamily: 'Arial',
    paddingTop: '16px',
    paddingBottom: '32px',
    overflowX: 'hidden',
    width: '100%',
    maxWidth: '100%',
    boxSizing: 'border-box',
    paddingLeft: 'calc(16px + env(safe-area-inset-left, 0px))',
    paddingRight: 'calc(16px + env(safe-area-inset-right, 0px))',
  };

  const paisParts = (perfil?.pais || '').split(' ');
  const paisFlag = paisParts[0];
  const paisNombre = paisParts.slice(1).join(' ');
  /** Color chip categoría: clave por `nivel` recortado (solo para color, no sustituye el texto). */
  const nivelPerfilTrimKey = String(perfil?.nivel ?? '').trim();
  const categoriaColor = CATEGORIA_COLOR[nivelPerfilTrimKey] || '#999';
  /** Categoría en UI: valor exacto de `perfil.nivel` (string en BD), sin otra fuente. */
  const nivelPerfilTexto =
    perfil?.nivel != null && String(perfil.nivel) !== '' ? String(perfil.nivel) : '';
  const nombreCompleto = nombreCompletoJugadorPerfil(perfil) || String(perfil?.nombre || '').trim();
  const aliasGrande = String(perfil?.alias || '').trim();
  /** Instagram: solo `perfil.instagram_url`. */
  const instagramRaw =
    perfil?.instagram_url != null && String(perfil.instagram_url) !== ''
      ? String(perfil.instagram_url)
      : '';
  const instagramHref =
    instagramRaw && /^https?:\/\//i.test(instagramRaw)
      ? instagramRaw
      : (() => {
          const h = instagramHandleFromStored(instagramRaw);
          return h ? `https://www.instagram.com/${encodeURIComponent(h)}/` : '';
        })();
  /** Foto: solo `perfil.foto_url`; vacío/null → avatar por defecto. */
  const tieneFotoUrl = perfil?.foto_url != null && String(perfil.foto_url).trim() !== '';
  const fotoUrlPerfil = tieneFotoUrl ? String(perfil.foto_url).trim() : '';
  /** Club habitual: solo `perfil.ciudad`. */
  const clubCiudadTrim = perfil?.ciudad != null ? String(perfil.ciudad).trim() : '';
  /** Ciudad/lugar en UI: solo `perfil.localidad`. */
  const localidadTrim = perfil?.localidad != null ? String(perfil.localidad).trim() : '';
  /** Federado: solo `perfil.es_federado`. */
  const esFederadoBool = perfil?.es_federado;

  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={wrap}>
          <p style={{ color: 'rgba(255,255,255,0.9)', textAlign: 'center', padding: '40px 0' }}>Cargando…</p>
        </div>
      </div>
    );
  }

  if (!perfil) {
    return (
      <div style={pageStyle}>
        <div style={wrap}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              marginBottom: '16px',
              padding: '8px 0',
              background: 'transparent',
              border: 'none',
              color: 'rgba(255,255,255,0.95)',
              fontWeight: 700,
              fontSize: '15px',
              cursor: 'pointer',
            }}
          >
            ← Volver
          </button>
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '28px 22px',
              textAlign: 'center',
              boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
              color: '#64748b',
              fontWeight: 600,
            }}
          >
            Jugador no encontrado
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={wrap}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{
            marginBottom: '14px',
            padding: '8px 0',
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.95)',
            fontWeight: 700,
            fontSize: '15px',
            cursor: 'pointer',
          }}
        >
          ← Volver
        </button>

        <div
          style={{
            background: 'white',
            borderRadius: '12px',
            padding: '28px 22px 22px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
            marginBottom: '14px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '120px',
              height: '120px',
              margin: '0 auto 10px',
              borderRadius: '50%',
              overflow: 'hidden',
              boxShadow: 'inset 0 0 0 3px #ef4444',
              boxSizing: 'border-box',
              background: '#e2e8f0',
            }}
          >
            {fotoUrlPerfil ? (
              <img
                src={fotoUrlPerfil}
                alt=""
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: 'center center',
                  display: 'block',
                }}
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#cbd5e1',
                }}
                aria-hidden
              >
                <span style={{ fontSize: '44px', lineHeight: 1, opacity: 0.85 }}>👤</span>
              </div>
            )}
          </div>

          {aliasGrande ? (
            <>
              <h1 style={{ margin: '4px 0 4px', fontSize: '22px', fontWeight: 'bold', color: '#222' }}>{formatAliasConArroba(aliasGrande)}</h1>
              <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#94a3b8', fontWeight: 400 }}>{nombreCompleto || '—'}</p>
            </>
          ) : (
            <h1 style={{ margin: '4px 0 8px', fontSize: '22px', fontWeight: 'bold', color: '#222' }}>
              {nombreCompleto || 'Jugador'}
            </h1>
          )}

          {perfil.pais ? (
            <p style={{ margin: '0 0 3px', color: '#777', fontSize: '13px', textAlign: 'center', lineHeight: 1.35 }}>
              {paisFlag} <span style={{ color: '#777', fontSize: '13px' }}>{paisNombre}</span>
            </p>
          ) : null}
          {localidadTrim ? (
            <p style={{ margin: '0 0 3px', color: '#777', fontSize: '13px', textAlign: 'center', lineHeight: 1.35 }}>
              📍 {localidadTrim}
            </p>
          ) : null}

          <div
            style={{
              marginTop: '14px',
              paddingTop: '14px',
              borderTop: '1px solid #eee',
              textAlign: 'left',
              width: '100%',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 0',
                borderBottom: '1px solid #f1f5f9',
              }}
            >
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Club habitual</span>
              <span style={{ fontSize: '14px', color: '#0f172a', textAlign: 'right' }}>
                {clubCiudadTrim ? clubCiudadTrim : <span style={{ color: '#94a3b8' }}>Sin definir</span>}
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '10px',
                padding: '6px 0',
                borderBottom: '1px solid #f1f5f9',
              }}
            >
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, flexShrink: 0 }}>
                {companeroDisplay?.kind === 'ultimo' ? 'Último compañero: ' : 'Compañero habitual: '}
              </span>
              <span
                style={{
                  fontSize: '14px',
                  color: '#0f172a',
                  textAlign: 'right',
                  display: 'inline-flex',
                  justifyContent: 'flex-end',
                  flex: 1,
                  minWidth: 0,
                }}
              >
                {companeroDisplay?.row ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                    {companeroDisplay.row.foto_url ? (
                      <img
                        src={companeroDisplay.row.foto_url}
                        alt=""
                        style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }}
                      />
                    ) : null}
                    {String(companeroDisplay.row.alias || '').trim() ? (
                      <button
                        type="button"
                        onClick={() =>
                          navigate(`/jugador/${encodeURIComponent(String(companeroDisplay.row.alias).trim())}`)
                        }
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                          color: '#5b21b6',
                          fontWeight: 700,
                          textDecoration: 'underline',
                        }}
                      >
                        {formatAliasConArroba(String(companeroDisplay.row.alias).trim())}
                      </button>
                    ) : (
                      <span style={{ fontWeight: 600 }}>
                        {nombreCompletoJugadorPerfil(companeroDisplay.row) ||
                          companeroDisplay.row.nombre ||
                          'Sin definir'}
                      </span>
                    )}
                  </span>
                ) : (
                  <span style={{ color: '#94a3b8', textAlign: 'right', width: '100%' }}>Sin definir</span>
                )}
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '10px',
                padding: '6px 0',
                borderBottom: '1px solid #f1f5f9',
              }}
            >
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Categoría</span>
              <span
                style={{
                  fontSize: '14px',
                  textAlign: 'right',
                  display: 'inline-flex',
                  alignItems: 'baseline',
                  gap: '6px',
                  flexWrap: 'wrap',
                  justifyContent: 'flex-end',
                }}
              >
                {nivelPerfilTexto ? (
                  <>
                    <span style={{ fontWeight: 'bold', color: categoriaColor }}>{nivelPerfilTexto}</span>
                    {esCategoriaPendienteValidacion(perfil) ? (
                      <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>(pendiente de validación)</span>
                    ) : null}
                  </>
                ) : (
                  <span style={{ color: '#94a3b8' }}>Sin definir</span>
                )}
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '10px',
                padding: '6px 0',
                borderBottom: '1px solid #f1f5f9',
              }}
            >
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Lateralidad</span>
              <span style={{ fontSize: '14px', color: '#0f172a', textAlign: 'right' }}>
                {perfil.lateralidad ? perfil.lateralidad : <span style={{ color: '#94a3b8' }}>Sin definir</span>}
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '10px',
                padding: '6px 0',
                borderBottom: '1px solid #f1f5f9',
              }}
            >
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Federado</span>
              <span style={{ fontSize: '14px', color: '#0f172a', textAlign: 'right' }}>
                {esFederadoBool === true ? (
                  <>
                    Sí
                    {String(perfil.numero_fipa || '').trim() ? (
                      <span style={{ color: '#64748b', fontSize: '13px', marginLeft: '6px' }}>
                        · N° {String(perfil.numero_fipa).trim()}
                      </span>
                    ) : null}
                  </>
                ) : esFederadoBool === false ? (
                  'No'
                ) : (
                  <span style={{ color: '#94a3b8' }}>Sin definir</span>
                )}
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '10px',
                padding: '6px 0 0',
              }}
            >
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Instagram</span>
              <span style={{ fontSize: '14px', textAlign: 'right' }}>
                {instagramHref ? (
                  <a
                    href={instagramHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={instagramRaw}
                    style={{
                      color: '#c026d3',
                      fontWeight: 700,
                      textDecoration: 'none',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="url(#igGrad)">
                      <defs>
                        <linearGradient id="igGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#f09433" />
                          <stop offset="25%" stopColor="#e6683c" />
                          <stop offset="50%" stopColor="#dc2743" />
                          <stop offset="75%" stopColor="#cc2366" />
                          <stop offset="100%" stopColor="#bc1888" />
                        </linearGradient>
                      </defs>
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.366.062 2.633.334 3.608 1.308.975.975 1.246 2.242 1.308 3.608.058 1.266.07 1.646.07 4.85s-.012 3.584-.07 4.85c-.062 1.366-.334 2.633-1.308 3.608-.975.975-2.242 1.246-3.608 1.308-1.266.058-1.646.07-4.85.07s-3.584-.012-4.85-.07c-1.366-.062-2.633-.334-3.608-1.308-.975-.975-1.246-2.242-1.308-3.608C2.175 15.584 2.163 15.204 2.163 12s.012-3.584.07-4.85c.062-1.366.334-2.633 1.308-3.608.975-.975 2.242-1.246 3.608-1.308 1.266-.058 1.646-.07 4.85-.07zm0-2.163c-3.259 0-3.667.014-4.947.072-1.635.074-3.078.46-4.244 1.628C1.641 2.867 1.255 4.31 1.181 5.945 1.123 7.225 1.109 7.633 1.109 12c0 4.367.014 4.775.072 6.055.074 1.635.46 3.078 1.628 4.244 1.166 1.168 2.609 1.554 4.244 1.628 1.28.058 1.688.072 4.947.072s3.667-.014 4.947-.072c1.635-.074 3.078-.46 4.244-1.628 1.168-1.166 1.554-2.609 1.628-4.244.058-1.28.072-1.688.072-4.947s-.014-3.667-.072-4.947c-.074-1.635-.46-3.078-1.628-4.244C19.325 1.641 17.882 1.255 16.247 1.181 14.967 1.123 14.559 1.109 12 1.109zM12 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zm0 10.162a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
                    </svg>
                    <span>Instagram</span>
                  </a>
                ) : (
                  <span style={{ color: '#94a3b8' }}>Sin definir</span>
                )}
              </span>
            </div>
          </div>
        </div>

        {tieneAlgunoPuntosPorAlcance(puntosAlcancePublico) || perfil?.mostrar_torneos_jugados ? (
          <div
            style={{
              background: '#f9f9f9',
              borderRadius: '10px',
              padding: '10px 14px',
              boxShadow: '0 1px 6px rgba(0,0,0,0.07)',
              marginBottom: '12px',
              fontSize: '13px',
              fontWeight: 700,
              color: '#0f172a',
              display: 'flex',
              flexWrap: 'nowrap',
              gap: '12px',
              alignItems: 'center',
              whiteSpace: 'nowrap',
              overflowX: 'auto',
            }}
          >
            {puntosAlcancePublico.club > 0 ? (
              <span>
                📍 Club: <span style={{ color: '#15803d' }}>{puntosAlcancePublico.club} pts</span>
              </span>
            ) : null}
            {puntosAlcancePublico.nacional > 0 ? (
              <span>
                🌎 Nacional: <span style={{ color: '#15803d' }}>{puntosAlcancePublico.nacional} pts</span>
              </span>
            ) : null}
            {puntosAlcancePublico.fipa > 0 ? (
              <span>
                🌐 FIPA: <span style={{ color: '#15803d' }}>{puntosAlcancePublico.fipa} pts</span>
              </span>
            ) : null}
            {perfil?.mostrar_torneos_jugados ? (
              <span>
                🏆 Torneos jugados: <span style={{ color: '#15803d' }}>{torneosUnicosConPuntosPublico}</span>
              </span>
            ) : null}
          </div>
        ) : null}

        <div
          style={{
            background: '#f9f9f9',
            borderRadius: '12px',
            padding: '18px 20px',
            boxShadow: '0 1px 6px rgba(0,0,0,0.07)',
            marginBottom: '12px',
          }}
        >
          <h2
            style={{
              margin: '0 0 12px',
              fontSize: '15px',
              color: '#334155',
              borderBottom: '1px solid #e5e7eb',
              paddingBottom: '8px',
            }}
          >
            🏆 Competencias y puntos
          </h2>
          {Array.isArray(torneosConPuntos) && torneosConPuntos.length > 0 ? (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(mostrarTodosTorneosPublico ? torneosConPuntos : torneosConPuntos.slice(0, 5)).map((row, idx) => {
                  if (!row || typeof row !== 'object') return null;
                  try {
                    const tid = row.torneo_id != null ? row.torneo_id : idx;
                    const eid = row.equipo_id != null ? row.equipo_id : 'x';
                    const med = emojiMedallaPosicionCompacta(row.posicion);
                    const nivelTxt = formatNivelTorneo(row.nivel_torneo);
                    const pts = row.puntos != null ? row.puntos : '—';
                    const nombreT = row.nombreTorneo != null ? String(row.nombreTorneo) : `Torneo #${tid}`;
                    const fechaM = row.fechaMostrar != null ? String(row.fechaMostrar) : '—';
                    return (
                      <button
                        key={`${tid}-${eid}-${idx}`}
                        type="button"
                        onClick={() => navigate(`/torneo/${tid}`)}
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 12px',
                          borderRadius: '10px',
                          border: '1px solid #e2e8f0',
                          background: '#f1f5f9',
                          cursor: 'pointer',
                          fontSize: '14px',
                          color: '#334155',
                          textAlign: 'left',
                          overflow: 'hidden',
                          minHeight: 0,
                        }}
                      >
                        <span style={{ flexShrink: 0, lineHeight: 1.2 }}>{med}</span>
                        <span
                          style={{
                            flexShrink: 0,
                            whiteSpace: 'nowrap',
                            fontWeight: 700,
                            color: '#0f172a',
                          }}
                        >
                          {nombreT}
                        </span>
                        <span
                          style={{
                            minWidth: 0,
                            flex: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            fontWeight: 600,
                            color: '#475569',
                          }}
                        >
                          {` · ${nivelTxt} · ${pts} pts · ${fechaM}`}
                        </span>
                      </button>
                    );
                  } catch (rowErr) {
                    console.error('[PerfilPublico] fila torneo', rowErr);
                    return null;
                  }
                })}
              </div>
              {torneosConPuntos.length > 5 ? (
                <div style={{ marginTop: '12px', textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setMostrarTodosTorneosPublico((v) => !v)}
                    style={{
                      padding: '10px 18px',
                      fontSize: '14px',
                      fontWeight: 700,
                      borderRadius: '10px',
                      border: '1px solid #cbd5e1',
                      background: 'white',
                      color: '#334155',
                      cursor: 'pointer',
                    }}
                  >
                    {mostrarTodosTorneosPublico ? 'Ver menos' : 'Ver todos'}
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px', fontWeight: 600, textAlign: 'center', padding: '12px 8px' }}>
              Sin competencias registradas
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
