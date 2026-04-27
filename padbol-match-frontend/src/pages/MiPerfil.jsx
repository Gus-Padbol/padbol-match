import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { PAISES_TELEFONO_PRINCIPALES, PAISES_TELEFONO_OTROS } from '../constants/paisesTelefono';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import {
  HUB_CONTENT_PADDING_BOTTOM_PX,
  HUB_CONTENT_PADDING_TOP_PX,
} from '../constants/hubLayout';
import {
  persistJugadorPerfil,
  refreshJugadorPerfilFromSupabase,
  isPerfilTorneoCompleto,
} from '../utils/jugadorPerfil';
import {
  whatsappDigitsValido,
  digitsOnly,
  buildFullWhatsDigits,
  formatWhatsAppE164,
  whatsappNacionalValido,
  splitStoredWhatsapp,
} from '../utils/authIdentidad';
import { mensajeErrorAuthSupabase, mensajeErrorDbSupabase } from '../utils/authErrorsEs';
import { normalizeTorneoPostPerfilPath } from '../utils/torneoPostPerfilNavigation';
import { getOrCreateUsuarioBasico } from '../utils/usuarioBasico';
import { handleAuthOnce } from '../utils/handleAuthOnce';
import { authLoginRedirectPath, authUrlWithRedirect } from '../utils/authLoginRedirect';
import { useAuth } from '../context/AuthContext';
import { nombreDesdeSesionSinEmail, getDisplayName } from '../utils/displayName';
import { nombreCompletoJugadorPerfil } from '../utils/jugadorPerfil';

const API_BASE_URL = 'https://padbol-backend.onrender.com';

const MSG_CUENTA_Y_FICHA_OK = 'Cuenta creada y ficha guardada correctamente';

const CATEGORIAS = ['Principiante', '5ta', '4ta', '3ra', '2da', '1ra', 'Elite'];

const MI_PERFIL_CONTENT_WRAP = {
  maxWidth: '520px',
  width: '100%',
  margin: '0 auto',
  padding: '20px',
  boxSizing: 'border-box',
};

function miPerfilPageOuterStyle(paddingTopPx) {
  return {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    fontFamily: 'Arial',
    paddingTop: `${paddingTopPx}px`,
    paddingBottom: `${HUB_CONTENT_PADDING_BOTTOM_PX}px`,
    overflowX: 'hidden',
    width: '100%',
    maxWidth: '100%',
    boxSizing: 'border-box',
    paddingLeft: 'calc(16px + env(safe-area-inset-left, 0px))',
    paddingRight: 'calc(16px + env(safe-area-inset-right, 0px))',
  };
}

/** Asterisco obligatorio (rojo) para labels del registro. */
const reqAst = <span style={{ color: '#d32f2f', fontWeight: 800 }}>*</span>;

function emailValidoVisible(raw) {
  const s = String(raw || '').trim();
  if (!s) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

const CATEGORIA_COLOR = {
  Principiante: '#78909c',
  '5ta':        '#43a047',
  '4ta':        '#039be5',
  '3ra':        '#8e24aa',
  '2da':        '#e53935',
  '1ra':        '#f57c00',
  Elite:        '#212121',
};

/** Valor del select "país" alineado con opciones (🇦🇷 Argentina). */
const PAIS_ARGENTINA_PERFIL = `${PAISES_TELEFONO_PRINCIPALES[0].bandera} ${PAISES_TELEFONO_PRINCIPALES[0].nombre}`;

function normalizeNivelTorneoScope(raw) {
  return String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_');
}

/** Alcance del torneo: local | nacional | internacional (campo `nivel_torneo` en DB). */
function mostrarCampoPaisSegunTorneo(torneoRow) {
  if (!torneoRow) return true;
  const n = normalizeNivelTorneoScope(torneoRow.nivel_torneo);
  return n === 'nacional' || n === 'internacional';
}

function mensajeValidarPaisTorneo(torneoRow, paisForm) {
  if (!torneoRow) {
    return String(paisForm || '').trim() ? null : 'Selecciona tu país.';
  }
  const n = normalizeNivelTorneoScope(torneoRow.nivel_torneo);
  if (n === 'internacional' && !String(paisForm || '').trim()) {
    return 'Selecciona tu país.';
  }
  return null;
}

function paisPayloadSegunTorneo(torneoRow, paisForm) {
  const p = String(paisForm || '').trim();
  if (!torneoRow) return p;
  const n = normalizeNivelTorneoScope(torneoRow.nivel_torneo);
  if (n === 'local') return PAIS_ARGENTINA_PERFIL;
  if (n === 'nacional') return p || PAIS_ARGENTINA_PERFIL;
  if (n === 'internacional') return p;
  return p || PAIS_ARGENTINA_PERFIL;
}

export default function MiPerfil() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, loading: authLoading, userProfile, refreshSession, signOutAndClear } = useAuth();
  const [searchParams] = useSearchParams();
  const torneoIdPerfil = searchParams.get('id');
  const redirectAfterAuth = searchParams.get('redirect') || '';
  const torneoIdValido = Boolean(torneoIdPerfil && /^\d+$/.test(String(torneoIdPerfil)));
  const [perfil, setPerfil] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reservas, setReservas] = useState([]);
  const [editando, setEditando] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const perfilSubmitLockRef = useRef(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  /** Preview local (blob URL); se muestra hasta que elijas otra o cancels edición del formulario */
  const [fotoPreview, setFotoPreview] = useState(null);
  const fileInputRef = useRef(null);
  const fotoPreviewRef = useRef(null);
  const hintEdicionTorneoRef = useRef(false);
  const [cancelando, setCancelando] = useState(null); // reservaId being cancelled
  const [creditTotal, setCreditTotal] = useState(0);
  const [creditItems, setCreditItems] = useState([]);

  const sessionOwnerEmail = useMemo(() => session?.user?.email?.trim() || null, [session?.user?.email]);

  fotoPreviewRef.current = fotoPreview;
  useEffect(() => () => {
    const u = fotoPreviewRef.current;
    if (u && String(u).startsWith('blob:')) URL.revokeObjectURL(u);
  }, []);

  const cuentaDeSesion = useMemo(() => {
    if (!sessionOwnerEmail) return null;
    return {
      email: sessionOwnerEmail,
      nombre: getDisplayName(userProfile, session),
      whatsapp: String(userProfile?.whatsapp || '').trim(),
      foto: userProfile?.foto ?? null,
    };
  }, [sessionOwnerEmail, userProfile, session]);
  /** Código país (ej. +54) + número local solo dígitos (sin repetir código en el input) */
  const [waCodigoPais, setWaCodigoPais] = useState('+54');
  const [waNumeroLocal, setWaNumeroLocal] = useState('');
  const [waConfirmLocal, setWaConfirmLocal] = useState('');
  const waTorneoFormInitRef = useRef(false);
  const [nombreRegistroTorneo, setNombreRegistroTorneo] = useState('');
  const [emailRegistro, setEmailRegistro] = useState('');
  const [nombreTorneoCompleto, setNombreTorneoCompleto] = useState('');
  const [passRegistroTorneo, setPassRegistroTorneo] = useState('');
  const [passRegistroTorneo2, setPassRegistroTorneo2] = useState('');
  const [torneoPerfil, setTorneoPerfil] = useState(null);
  /** Errores por campo en formulario registro sin sesión */
  const [registroFieldErrors, setRegistroFieldErrors] = useState({});

  /** Sin sesión: pantalla única de alta de cuenta + ficha. */
  const esRegistroSinSesion = Boolean(!authLoading && !sessionOwnerEmail);

  const avisoPerfilTorneoMsg = useMemo(
    () =>
      (location.state && location.state.avisoPerfilTorneo) ||
      (torneoIdValido ? 'Completa tu perfil para participar en torneos' : '') ||
      (redirectAfterAuth ? 'Completa tu perfil (incluido WhatsApp) para continuar.' : ''),
    [location.state, torneoIdValido, redirectAfterAuth]
  );

  const opcionesCodigoWhatsApp = useMemo(
    () => [...PAISES_TELEFONO_PRINCIPALES, ...PAISES_TELEFONO_OTROS],
    []
  );

  const [formData, setFormData] = useState({
    lateralidad: 'Diestro',
    nivel: '5ta',
    pais: '',
    ciudad: '',
    alias: '',

    fecha_nacimiento: '',
    numero_fipa: '',
    es_federado: false,
  });

  const nivelTorneoScope = useMemo(
    () => normalizeNivelTorneoScope(torneoPerfil?.nivel_torneo),
    [torneoPerfil?.nivel_torneo]
  );
  const mostrarCampoPais = useMemo(
    () => mostrarCampoPaisSegunTorneo(torneoPerfil),
    [torneoPerfil]
  );
  const paisHtmlRequired = !torneoPerfil || nivelTorneoScope === 'internacional';

  useEffect(() => {
    if (!torneoIdValido) {
      setTorneoPerfil(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('torneos')
        .select('id, nivel_torneo')
        .eq('id', Number(torneoIdPerfil))
        .maybeSingle();
      if (cancelled) return;
      if (!error && data) setTorneoPerfil(data);
      else setTorneoPerfil(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [torneoIdValido, torneoIdPerfil]);

  /** Torneo nacional: país por defecto Argentina en el formulario. */
  useEffect(() => {
    if (!torneoPerfil || nivelTorneoScope !== 'nacional') return;
    setFormData((prev) => {
      if (String(prev.pais || '').trim()) return prev;
      return { ...prev, pais: PAIS_ARGENTINA_PERFIL };
    });
  }, [torneoPerfil, nivelTorneoScope]);

  useEffect(() => {
    if (sessionOwnerEmail) return;
    getOrCreateUsuarioBasico();
  }, [sessionOwnerEmail]);

  useEffect(() => {
    if (!sessionOwnerEmail) {
      if (!authLoading) setLoading(false);
      return;
    }
    fetchPerfil();
    fetchReservas();
    fetchCreditos();
  }, [sessionOwnerEmail, location.search, authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (loading || !sessionOwnerEmail) return;
    const needHint = torneoIdValido || Boolean(redirectAfterAuth);
    if (!needHint) return;
    if (!isPerfilTorneoCompleto() && !hintEdicionTorneoRef.current) {
      hintEdicionTorneoRef.current = true;
      setEditando(true);
    }
  }, [torneoIdValido, redirectAfterAuth, loading, sessionOwnerEmail, perfil]);

  useEffect(() => {
    if (!editando) {
      waTorneoFormInitRef.current = false;
      return;
    }
    if (!sessionOwnerEmail) return;

    if (!waTorneoFormInitRef.current) {
      waTorneoFormInitRef.current = true;
      const raw = String(perfil?.whatsapp || cuentaDeSesion?.whatsapp || '').trim();
      const { codigo, local } = splitStoredWhatsapp(raw);
      setWaCodigoPais(codigo || '+54');
      setWaNumeroLocal(local);
      setWaConfirmLocal('');
    }

    const base =
      String(perfil?.nombre || '').trim() ||
      String(cuentaDeSesion?.nombre || '').trim() ||
      (session?.user ? nombreDesdeSesionSinEmail(userProfile, session, '') : '');
    setNombreTorneoCompleto((prev) => (prev.trim() ? prev : base));
  }, [
    editando,
    sessionOwnerEmail,
    cuentaDeSesion?.nombre,
    cuentaDeSesion?.whatsapp,
    perfil?.nombre,
    perfil?.whatsapp,
    session,
    userProfile,
  ]);

  const fetchPerfil = async () => {
    const owner = sessionOwnerEmail;
    if (!owner) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout loading profile')), 8000)
      );
      const uid = session?.user?.id ?? null;
      const byUserId = uid
        ? supabase.from('jugadores_perfil').select('*').eq('user_id', uid).maybeSingle()
        : null;
      const byEmail = supabase.from('jugadores_perfil').select('*').eq('email', owner).maybeSingle();

      let data = null;
      if (byUserId) {
        const r1 = await Promise.race([byUserId, timeoutPromise]);
        if (r1?.data) data = r1.data;
      }
      if (!data) {
        const r2 = await Promise.race([byEmail, timeoutPromise]);
        data = r2?.data ?? null;
      }

      if (data) {
        setPerfil(data);
        setFormData({
          lateralidad: data.lateralidad || 'Diestro',
          nivel: data.nivel || '5ta',
          pais: data.pais || '',
          ciudad: data.ciudad || '',
          alias: data.alias != null ? String(data.alias) : '',
          fecha_nacimiento: data.fecha_nacimiento || '',
          numero_fipa: data.numero_fipa || '',
          es_federado: data.es_federado || false,
        });
        {
          const rawNom = String(data.nombre || '').trim();
          const parts = rawNom.split(/\s+/).filter(Boolean);
          const wa =
            (cuentaDeSesion?.email || '').trim().toLowerCase() === owner.toLowerCase()
              ? String(cuentaDeSesion?.whatsapp || '').trim()
              : '';
          persistJugadorPerfil({
            nombre: parts[0] || rawNom,
            apellido: parts.length > 1 ? parts.slice(1).join(' ') : '',
            categoria: String(data.nivel || '').trim(),
            ...(wa ? { whatsapp: wa } : {}),
            email: owner,
          });
        }
      }
    } catch (err) {
      // Profile is optional; silently fail if not found or network error
      console.log('[MiPerfil] fetchPerfil error (expected if no profile yet):', err.message);
    }
    setLoading(false);
  };

  const fetchReservas = async () => {
    if (!sessionOwnerEmail) return;
    try {
      const { data } = await supabase
        .from('reservas')
        .select('id, sede, fecha, hora, cancha, estado, precio, moneda')
        .eq('email', sessionOwnerEmail)
        .order('fecha', { ascending: false })
        .limit(20);
      setReservas(data || []);
    } catch {
      // fail silently
    }
  };

  const fetchCreditos = async () => {
    if (!sessionOwnerEmail) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/creditos/${encodeURIComponent(sessionOwnerEmail)}`);
      if (!res.ok) return;
      const data = await res.json();
      setCreditTotal(data.total || 0);
      setCreditItems(data.creditos || []);
    } catch {
      // fail silently — credits are informational
    }
  };

  const handlePhotoSelected = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFotoPreview((prev) => {
      if (prev && String(prev).startsWith('blob:')) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleRegistroCuenta = async (e) => {
    e.preventDefault();
    if (perfilSubmitLockRef.current || isSubmitting) return;
    perfilSubmitLockRef.current = true;
    setIsSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');
    setRegistroFieldErrors({});

    try {
      const fe = {};
      const nom = nombreRegistroTorneo.trim();
      const partsNom = nom.split(/\s+/).filter(Boolean);
      if (partsNom.length < 2) {
        fe.nombre = 'Completa nombre y apellido.';
      }

      const emRaw = emailRegistro.trim();
      const emailAuth = emRaw.toLowerCase();
      if (!emRaw) {
        fe.email = 'Completa tu email';
      } else if (!emailValidoVisible(emRaw)) {
        fe.email = 'Ingresa un email válido';
      }

      const local = waNumeroLocal.trim();
      const localConf = waConfirmLocal.trim();
      if (!digitsOnly(local)) {
        fe.whatsapp = 'Completa tu WhatsApp';
      } else if (!whatsappNacionalValido(local)) {
        fe.whatsapp = 'Ingresa un WhatsApp válido (mínimo 10 dígitos sin código de país).';
      } else if (digitsOnly(local) !== digitsOnly(localConf)) {
        fe.whatsappConfirma = 'Repite el mismo número en la confirmación de WhatsApp.';
      }
      const waDigits = buildFullWhatsDigits(waCodigoPais, local);
      if (!fe.whatsapp && !whatsappDigitsValido(waDigits)) {
        fe.whatsapp = 'Completa un WhatsApp válido.';
      }
      const wa = formatWhatsAppE164(waCodigoPais, local);

      if (!String(formData.nivel || '').trim()) {
        fe.categoria = 'Selecciona tu categoría.';
      }

      if (!passRegistroTorneo && !passRegistroTorneo2) {
        fe.password = 'Completa la contraseña.';
        fe.password2 = 'Confirma la contraseña.';
      } else if (!passRegistroTorneo) {
        fe.password = 'Completa la contraseña.';
      } else if (!passRegistroTorneo2) {
        fe.password2 = 'Confirma la contraseña.';
      } else if (passRegistroTorneo.length < 6) {
        fe.password = 'La contraseña debe tener al menos 6 caracteres.';
      } else if (passRegistroTorneo !== passRegistroTorneo2) {
        fe.password2 = 'Las contraseñas no coinciden.';
      }

      const errPaisInv = mensajeValidarPaisTorneo(torneoPerfil, formData.pais);
      if (errPaisInv) {
        fe.pais = errPaisInv;
      }

      if (Object.keys(fe).length > 0) {
        setRegistroFieldErrors(fe);
        return;
      }

      if (session?.user?.email) {
        setErrorMsg('Ya tienes una sesión activa. No hace falta registrarte de nuevo.');
        return;
      }

      const { data: authData, error: authErr } = await handleAuthOnce({
        kind: 'signUp',
        email: emailAuth,
        password: passRegistroTorneo,
        options: { data: { nombre: partsNom.join(' '), whatsapp: wa } },
      });
      if (authErr) {
        console.log('ERROR SIGNUP:', authErr);
        setErrorMsg(mensajeErrorAuthSupabase(authErr.message));
        return;
      }
      const user = authData?.user;
      const owner = String(user?.email || emailAuth || '')
        .trim()
        .toLowerCase();
      if (!owner) {
        console.log('ERROR SIGNUP: respuesta sin user.email', authData);
        setErrorMsg(
          'No se recibió el email del usuario tras el registro. Revisa la consola o prueba «Iniciar sesión».'
        );
        return;
      }
      const nombreCli = nom;
      const paisGuardado = paisPayloadSegunTorneo(torneoPerfil, formData.pais);

      const { error: cliErr } = await supabase
        .from('clientes')
        .upsert({ email: owner, nombre: nombreCli, whatsapp: wa }, { onConflict: 'email' });
      if (cliErr) {
        console.error(cliErr);
        setErrorMsg(mensajeErrorDbSupabase(cliErr.message));
        return;
      }

      const aliasTrimReg = String(formData.alias || '').trim();
      const payload = {
        lateralidad: formData.lateralidad,
        nivel: formData.nivel,
        pendiente_validacion: true,
        pais: paisGuardado,
        ciudad: formData.ciudad?.trim() ? formData.ciudad.trim() : null,
        fecha_nacimiento: formData.fecha_nacimiento || null,
        numero_fipa: formData.numero_fipa?.trim() ? formData.numero_fipa.trim() : null,
        es_federado: formData.es_federado,
        whatsapp: wa,
        alias: aliasTrimReg || null,
      };

      const { error: jpErr } = await supabase.from('jugadores_perfil').upsert(
        {
          user_id: user?.id ?? null,
          email: owner,
          nombre: nombreCli,
          ...payload,
        },
        { onConflict: 'email' }
      );

      if (jpErr) {
        setErrorMsg(mensajeErrorDbSupabase(jpErr.message));
        return;
      }

      void refreshSession();
      persistJugadorPerfil({
        nombre: partsNom[0],
        apellido: partsNom.slice(1).join(' '),
        categoria: String(formData.nivel || '').trim(),
        whatsapp: wa,
        email: owner,
      });
      await refreshJugadorPerfilFromSupabase(owner);

      setSuccessMsg(MSG_CUENTA_Y_FICHA_OK);
      setRegistroFieldErrors({});

      if (isPerfilTorneoCompleto()) {
        await new Promise((r) => setTimeout(r, 450));
        const target = normalizeTorneoPostPerfilPath(redirectAfterAuth, torneoIdValido ? torneoIdPerfil : '');
        navigate(target && target !== '/home' && target !== '/' ? target : '/', { replace: true });
      } else {
        setErrorMsg('Faltan datos obligatorios en la ficha (nombre, WhatsApp, categoría o país).');
      }
    } catch (err) {
      console.log('ERROR SIGNUP:', err);
      setErrorMsg(String(err?.message || 'Error al registrar la cuenta.'));
    } finally {
      perfilSubmitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleGuardar = async (e) => {
    e.preventDefault();
    if (perfilSubmitLockRef.current || isSubmitting) return;
    perfilSubmitLockRef.current = true;
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const owner = sessionOwnerEmail;
      if (!owner) {
        setErrorMsg('No hay sesión activa.');
        return;
      }
      const errPais = mensajeValidarPaisTorneo(torneoPerfil, formData.pais);
      if (errPais) {
        setErrorMsg(errPais);
        return;
      }
      if (!String(formData.nivel || '').trim()) {
        setErrorMsg('Selecciona tu categoría.');
        return;
      }

      const np = String(nombreTorneoCompleto).trim().split(/\s+/).filter(Boolean);
      if (np.length < 2) {
        setErrorMsg('Completa nombre y apellido.');
        return;
      }

      const local = waNumeroLocal.trim();
      if (!digitsOnly(local)) {
        setErrorMsg('Completa tu WhatsApp');
        return;
      }
      if (!whatsappNacionalValido(local)) {
        setErrorMsg('Completa tu WhatsApp (al menos 10 dígitos en el número, sin el código de país).');
        return;
      }
      const waBuilt = buildFullWhatsDigits(waCodigoPais, local);
      if (!whatsappDigitsValido(waBuilt)) {
        setErrorMsg('Completa un WhatsApp válido.');
        return;
      }
      const waFinal = formatWhatsAppE164(waCodigoPais, local);

      const nombreGuardar = String(nombreTorneoCompleto).trim();

      setIsSubmitting(true);

      const paisGuardado = paisPayloadSegunTorneo(torneoPerfil, formData.pais);

      const aliasTrim = String(formData.alias || '').trim();
      const payload = {
        lateralidad: formData.lateralidad,
        nivel: formData.nivel,
        pendiente_validacion: true,
        pais: paisGuardado,
        ciudad: formData.ciudad?.trim() ? formData.ciudad.trim() : null,

        fecha_nacimiento: formData.fecha_nacimiento || null,
        numero_fipa: formData.numero_fipa?.trim() ? formData.numero_fipa.trim() : null,
        es_federado: formData.es_federado,
        alias: aliasTrim || null,
      };

      const userId = session?.user?.id ?? null;
      if (!userId) {
        setErrorMsg('No se pudo obtener el usuario de la sesión.');
        return;
      }

      const payloadDb = {
        user_id: userId,
        email: owner,
        nombre: nombreGuardar,
        whatsapp: waFinal,
        ...payload,
      };

      const { error } = await supabase
        .from('jugadores_perfil')
        .upsert(payloadDb, { onConflict: 'email' });

      if (error) {
        console.error('ERROR COMPLETO UPSERT:', JSON.stringify(error));
        setErrorMsg(mensajeErrorDbSupabase(error.message));
        return;
      }

      const { error: errCli } = await supabase
        .from('clientes')
        .update({ whatsapp: waFinal, nombre: nombreGuardar })
        .eq('email', owner);
      if (errCli) {
        console.error(errCli);
      }
      void refreshSession();

      await fetchPerfil();
      {
        const raw = String((nombreGuardar || perfil?.nombre || '')).trim();
        const parts = raw.split(/\s+/).filter(Boolean);
        persistJugadorPerfil({
          nombre: parts[0] || raw,
          apellido: parts.length > 1 ? parts.slice(1).join(' ') : '',
          categoria: String(formData.nivel || '').trim(),
          whatsapp: waFinal,
          email: owner,
        });
      }
      await refreshJugadorPerfilFromSupabase(owner);

      setPassRegistroTorneo('');
      setPassRegistroTorneo2('');

      const target = normalizeTorneoPostPerfilPath(redirectAfterAuth, torneoIdValido ? torneoIdPerfil : '');
      if (isPerfilTorneoCompleto() && target && target !== '/home' && target !== '/') {
        setSuccessMsg(target.startsWith('/torneo/') ? MSG_CUENTA_Y_FICHA_OK : '✅ Perfil guardado');
        setEditando(false);
        await new Promise((r) => setTimeout(r, 450));
        navigate(target, { replace: true });
        return;
      }
      setSuccessMsg('✅ Perfil guardado');
      setEditando(false);
      setTimeout(() => setSuccessMsg(''), 3000);
    } finally {
      perfilSubmitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleCancelar = async (r) => {
    const owner = sessionOwnerEmail;
    if (!owner) return;
    if (!window.confirm('¿Cancelar reserva? Si faltan más de 24hs recibirás un crédito.')) return;
    setCancelando(r.id);
    try {
      const resp = await fetch(`${API_BASE_URL}/api/cancelar-reserva`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservaId: r.id, email: owner }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Error al cancelar');
      if (data.credito) {
        alert(`✅ Reserva cancelada. Se acreditaron $${Number(data.credito.monto).toLocaleString('es-AR')} en tu cuenta (válido 30 días).`);
      } else {
        alert('✅ Reserva cancelada. La cancelación fue realizada con menos de 24hs de anticipación — no genera crédito.');
      }
      await fetchReservas();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setCancelando(null);
    }
  };

  const inputStyle = {
    width: '100%', padding: '10px', marginBottom: '6px',
    border: '1px solid #ddd', borderRadius: '5px',
    boxSizing: 'border-box', fontSize: '14px', background: 'white',
  };
  const labelStyle = {
    display: 'block', fontWeight: 'bold',
    marginBottom: '5px', color: '#333', fontSize: '13px',
  };

  if (authLoading) {
    return (
      <div style={miPerfilPageOuterStyle(HUB_CONTENT_PADDING_TOP_PX)}>
        <AppHeader title="Mi Perfil" />
        <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.8)' }}>
          Verificando sesión...
        </div>
        <BottomNav />
      </div>
    );
  }

  if (esRegistroSinSesion) {
    if (!torneoIdValido) {
      const goAuth = () => navigate(authUrlWithRedirect(authLoginRedirectPath(location)));
      return (
        <div style={miPerfilPageOuterStyle(HUB_CONTENT_PADDING_TOP_PX)}>
          <AppHeader title="Mi Perfil" />
          <div style={MI_PERFIL_CONTENT_WRAP}>
            {avisoPerfilTorneoMsg ? (
              <div
                style={{
                  marginBottom: '14px',
                  padding: '12px 14px',
                  background: '#fef9c3',
                  border: '1px solid #fde047',
                  borderRadius: '10px',
                  color: '#854d0e',
                  fontSize: '14px',
                  fontWeight: 600,
                  lineHeight: 1.45,
                }}
              >
                {avisoPerfilTorneoMsg}
              </div>
            ) : null}
            <div
              style={{
                background: 'white',
                borderRadius: '12px',
                padding: '24px',
                boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
              }}
            >
              <h3 style={{ marginTop: 0, marginBottom: '12px', color: '#222' }}>Mi perfil</h3>
              <p style={{ color: '#666', fontSize: '14px', marginBottom: '20px', lineHeight: 1.5 }}>
                Para ver y editar tu ficha necesitas una cuenta. Puedes explorar el resto de la app sin iniciar sesión.
              </p>
              <button
                type="button"
                onClick={goAuth}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: '#d32f2f',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '15px',
                  marginBottom: '10px',
                }}
              >
                Iniciar sesión o registrarte
              </button>
              <button
                type="button"
                onClick={() => navigate('/')}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'transparent',
                  color: '#444',
                  border: '1px solid #ccc',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '14px',
                }}
              >
                Volver al inicio
              </button>
            </div>
          </div>
          <BottomNav />
        </div>
      );
    }

    const regErr = (k) => registroFieldErrors[k];
    const regBorder = (k) => (regErr(k) ? '1px solid #d32f2f' : '1px solid #ddd');
    const regErrP = (k) =>
      regErr(k) ? (
        <p style={{ color: '#d32f2f', fontSize: '13px', marginTop: '-2px', marginBottom: '10px', lineHeight: 1.35 }}>
          {regErr(k)}
        </p>
      ) : null;
    const guestInputStyle = {
      width: '100%',
      padding: '10px',
      marginBottom: '6px',
      border: '1px solid #ddd',
      borderRadius: '5px',
      boxSizing: 'border-box',
      fontSize: '14px',
      background: 'white',
    };
    const guestLabelStyle = {
      display: 'block',
      fontWeight: 'bold',
      marginBottom: '5px',
      color: '#333',
      fontSize: '13px',
    };
    return (
      <div style={miPerfilPageOuterStyle(HUB_CONTENT_PADDING_TOP_PX)}>
        <AppHeader title="Mi Perfil" />
        <div style={MI_PERFIL_CONTENT_WRAP}>
          {avisoPerfilTorneoMsg ? (
            <div
              style={{
                marginBottom: '14px',
                padding: '12px 14px',
                background: '#fef9c3',
                border: '1px solid #fde047',
                borderRadius: '10px',
                color: '#854d0e',
                fontSize: '14px',
                fontWeight: 600,
                lineHeight: 1.45,
              }}
            >
              {avisoPerfilTorneoMsg}
            </div>
          ) : null}
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: '16px', color: '#222' }}>Crear tu cuenta</h3>
            <p style={{ color: '#666', fontSize: '14px', marginBottom: '18px', lineHeight: 1.45 }}>
              Completa tus datos con un email real: se crea tu usuario en Padbol Match y se guarda tu ficha de jugador.
              {torneoIdValido ? ' Después vuelves al torneo.' : ''}
            </p>
            <form onSubmit={handleRegistroCuenta}>
              <label style={guestLabelStyle}>
                Nombre y apellido {reqAst}
              </label>
              <input
                type="text"
                value={nombreRegistroTorneo}
                onChange={(e) => {
                  setNombreRegistroTorneo(e.target.value);
                  setRegistroFieldErrors((p) => ({ ...p, nombre: '' }));
                }}
                placeholder="Ej: Juan Pérez"
                style={{ ...guestInputStyle, marginBottom: regErr('nombre') ? '6px' : '14px', border: regBorder('nombre') }}
                autoComplete="name"
              />
              {regErrP('nombre')}

              <label style={guestLabelStyle}>
                Email {reqAst}
              </label>
              <input
                type="email"
                value={emailRegistro}
                onChange={(e) => {
                  setEmailRegistro(e.target.value);
                  setRegistroFieldErrors((p) => ({ ...p, email: '' }));
                }}
                placeholder="tu@email.com"
                style={{ ...guestInputStyle, marginBottom: regErr('email') ? '6px' : '14px', border: regBorder('email') }}
                autoComplete="email"
              />
              {regErrP('email')}

              <label style={guestLabelStyle}>Alias</label>
              <input
                type="text"
                name="alias"
                value={formData.alias}
                onChange={handleChange}
                placeholder="Alias (opcional)"
                style={{ ...guestInputStyle, marginBottom: '14px' }}
                autoComplete="nickname"
              />

              <label style={guestLabelStyle}>
                WhatsApp {reqAst}
              </label>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  gap: '8px',
                  alignItems: 'stretch',
                  marginBottom: '6px',
                  width: '100%',
                }}
              >
                <select
                  value={waCodigoPais}
                  onChange={(e) => {
                    setWaCodigoPais(e.target.value);
                    setRegistroFieldErrors((p) => ({ ...p, whatsapp: '', whatsappConfirma: '' }));
                  }}
                  title="País / código"
                  aria-label="Código de país"
                  style={{
                    ...guestInputStyle,
                    flex: '0 0 auto',
                    minWidth: '108px',
                    maxWidth: '132px',
                    marginBottom: 0,
                    cursor: 'pointer',
                    border: regBorder('whatsapp'),
                  }}
                >
                  {opcionesCodigoWhatsApp.map((p) => (
                    <option key={`${p.nombre}-${p.codigo}`} value={p.codigo} title={p.nombre}>
                      {p.bandera} {p.codigo}
                    </option>
                  ))}
                </select>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={waNumeroLocal}
                  onChange={(e) => {
                    setWaNumeroLocal(digitsOnly(e.target.value));
                    setRegistroFieldErrors((p) => ({ ...p, whatsapp: '', whatsappConfirma: '' }));
                  }}
                  placeholder="Ej: 2211234567"
                  aria-label="Número de celular sin código de país"
                  style={{
                    ...guestInputStyle,
                    flex: '1 1 0',
                    minWidth: 0,
                    marginBottom: 0,
                    border: regBorder('whatsapp'),
                  }}
                  autoComplete="tel-national"
                />
              </div>
              <p style={{ color: '#666', fontSize: '12px', marginTop: 0, marginBottom: '6px', lineHeight: 1.4 }}>
                Obligatorio. Por defecto Argentina (+54): solo escribí tu número local (mínimo 10 dígitos), sin +54. Se guarda como +54…
              </p>
              {regErrP('whatsapp')}

              <label style={guestLabelStyle}>
                Confirmar número {reqAst}
              </label>
              <input
                type="tel"
                inputMode="numeric"
                value={waConfirmLocal}
                onChange={(e) => {
                  setWaConfirmLocal(digitsOnly(e.target.value));
                  setRegistroFieldErrors((p) => ({ ...p, whatsappConfirma: '' }));
                }}
                placeholder="Ej: 2211234567"
                style={{ ...guestInputStyle, marginBottom: regErr('whatsappConfirma') ? '6px' : '14px', border: regBorder('whatsappConfirma') }}
                autoComplete="tel-national"
              />
              {regErrP('whatsappConfirma')}

              <label style={guestLabelStyle}>
                Contraseña {reqAst}
              </label>
              <input
                type="password"
                value={passRegistroTorneo}
                onChange={(e) => {
                  setPassRegistroTorneo(e.target.value);
                  setRegistroFieldErrors((p) => ({ ...p, password: '', password2: '' }));
                }}
                placeholder="Mínimo 6 caracteres"
                style={{ ...guestInputStyle, marginBottom: regErr('password') ? '6px' : '14px', border: regBorder('password') }}
                autoComplete="new-password"
              />
              {regErrP('password')}

              <label style={guestLabelStyle}>
                Confirmar contraseña {reqAst}
              </label>
              <input
                type="password"
                value={passRegistroTorneo2}
                onChange={(e) => {
                  setPassRegistroTorneo2(e.target.value);
                  setRegistroFieldErrors((p) => ({ ...p, password2: '', password: '' }));
                }}
                placeholder="Repite la contraseña"
                style={{ ...guestInputStyle, marginBottom: regErr('password2') ? '6px' : '14px', border: regBorder('password2') }}
                autoComplete="new-password"
              />
              {regErrP('password2')}

              <label style={guestLabelStyle}>Lateralidad</label>
              <select
                name="lateralidad"
                value={formData.lateralidad}
                onChange={handleChange}
                style={{ ...guestInputStyle, marginBottom: '14px' }}
              >
                <option value="Diestro">Diestro</option>
                <option value="Zurdo">Zurdo</option>
              </select>

              <label style={guestLabelStyle}>
                Categoría {reqAst}
              </label>
              <select
                name="nivel"
                value={formData.nivel}
                onChange={(e) => {
                  handleChange(e);
                  setRegistroFieldErrors((p) => ({ ...p, categoria: '' }));
                }}
                style={{ ...guestInputStyle, marginBottom: regErr('categoria') ? '6px' : '14px', border: regBorder('categoria') }}
              >
                {CATEGORIAS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <p style={{ color: '#f59e0b', fontSize: '12px', marginTop: '2px', marginBottom: regErr('categoria') ? '6px' : '14px' }}>
                La categoría será validada por un administrador
              </p>
              {regErrP('categoria')}

              {mostrarCampoPais ? (
                <>
                  <label style={guestLabelStyle}>
                    País
                    {paisHtmlRequired ? <> {reqAst}</> : null}
                  </label>
                  {torneoPerfil && nivelTorneoScope === 'nacional' ? (
                    <p style={{ color: '#666', fontSize: '12px', marginTop: 0, marginBottom: '6px', lineHeight: 1.35 }}>
                      Por defecto Argentina; puedes cambiar el país si corresponde.
                    </p>
                  ) : null}
                  <select
                    name="pais"
                    value={formData.pais}
                    onChange={(e) => {
                      handleChange(e);
                      setRegistroFieldErrors((p) => ({ ...p, pais: '' }));
                    }}
                    style={{ ...guestInputStyle, marginBottom: regErr('pais') ? '6px' : '14px', border: regBorder('pais') }}
                    required={paisHtmlRequired}
                  >
                    <option value="">— Seleccionar país —</option>
                    <optgroup label="Principales">
                      {PAISES_TELEFONO_PRINCIPALES.map((p) => (
                        <option key={p.nombre} value={`${p.bandera} ${p.nombre}`}>
                          {p.bandera} {p.nombre}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Otros países">
                      {PAISES_TELEFONO_OTROS.map((p) => (
                        <option key={p.nombre} value={`${p.bandera} ${p.nombre}`}>
                          {p.bandera} {p.nombre}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                  {regErrP('pais')}
                </>
              ) : null}

              <label style={guestLabelStyle}>Ciudad</label>
              <input
                type="text"
                name="ciudad"
                placeholder="Ej: Buenos Aires"
                value={formData.ciudad}
                onChange={handleChange}
                style={{ ...guestInputStyle, marginBottom: '14px' }}
              />

              <label style={guestLabelStyle}>Fecha de nacimiento</label>
              <input
                type="date"
                name="fecha_nacimiento"
                value={formData.fecha_nacimiento}
                onChange={handleChange}
                style={{ ...guestInputStyle, marginBottom: '14px' }}
              />

              <label style={guestLabelStyle}>N° FIPA</label>
              <input
                type="text"
                name="numero_fipa"
                placeholder="Ej: 12345"
                value={formData.numero_fipa}
                onChange={handleChange}
                style={{ ...guestInputStyle, marginBottom: '14px' }}
              />

              <label style={{ ...guestLabelStyle, marginBottom: '8px' }}>¿Sos federado?</label>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '18px' }}>
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, es_federado: true }))}
                  style={{
                    flex: 1,
                    padding: '10px',
                    border: '2px solid',
                    borderColor: formData.es_federado ? '#388e3c' : '#ddd',
                    background: formData.es_federado ? '#e8f5e9' : 'white',
                    color: formData.es_federado ? '#388e3c' : '#666',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                  }}
                >
                  Sí
                </button>
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, es_federado: false }))}
                  style={{
                    flex: 1,
                    padding: '10px',
                    border: '2px solid',
                    borderColor: !formData.es_federado ? '#d32f2f' : '#ddd',
                    background: !formData.es_federado ? '#fff3f3' : 'white',
                    color: !formData.es_federado ? '#d32f2f' : '#666',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                  }}
                >
                  No
                </button>
              </div>

              {successMsg ? (
                <p style={{ color: '#2e7d32', marginBottom: '10px', fontWeight: 600, lineHeight: 1.4 }}>{successMsg}</p>
              ) : null}
              {errorMsg ? <p style={{ color: 'red', marginBottom: '10px' }}>{errorMsg}</p> : null}

              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: '#d32f2f',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  opacity: isSubmitting ? 0.65 : 1,
                }}
              >
                {isSubmitting ? 'Guardando...' : torneoIdValido ? 'Guardar y volver al torneo' : 'Crear cuenta'}
              </button>
            </form>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  if (loading) {
    return (
      <div style={miPerfilPageOuterStyle(HUB_CONTENT_PADDING_TOP_PX)}>
        <AppHeader title="Mi Perfil" />
        <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.8)' }}>
          Cargando perfil...
        </div>
        <BottomNav />
      </div>
    );
  }

  const paisParts = (perfil?.pais || '').split(' ');
  const paisFlag = paisParts[0];
  const paisNombre = paisParts.slice(1).join(' ');
  const categoriaColor = CATEGORIA_COLOR[perfil?.nivel] || '#999';
  const foto = perfil?.foto_url || cuentaDeSesion?.foto || null;

  return (
    <div style={miPerfilPageOuterStyle(HUB_CONTENT_PADDING_TOP_PX)}>

      <AppHeader title="Mi Perfil" />

    <div style={MI_PERFIL_CONTENT_WRAP}>
      {avisoPerfilTorneoMsg ? (
        <div
          style={{
            marginBottom: '14px',
            padding: '12px 14px',
            background: '#fef9c3',
            border: '1px solid #fde047',
            borderRadius: '10px',
            color: '#854d0e',
            fontSize: '14px',
            fontWeight: 600,
            lineHeight: 1.45,
          }}
        >
          {avisoPerfilTorneoMsg}
        </div>
      ) : null}

      <div style={{ background: 'white', borderRadius: '12px', padding: '30px 24px 24px', boxShadow: '0 2px 12px rgba(0,0,0,0.1)', marginBottom: '16px', textAlign: 'center' }}>
        {/* Foto de perfil: avatar + overlay + input file */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handlePhotoSelected}
        />
        <button
          type="button"
          aria-label="Subir foto de perfil"
          onClick={() => fileInputRef.current?.click()}
          style={{
            position: 'relative',
            width: '140px',
            height: '140px',
            margin: '0 auto 14px',
            padding: 0,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            borderRadius: '50%',
            display: 'block',
            overflow: 'hidden',
            boxSizing: 'border-box',
          }}
        >
          <img
            src={fotoPreview || perfil?.foto_url || cuentaDeSesion?.foto || '/default-avatar.svg'}
            alt="Perfil"
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              objectFit: 'cover',
              display: 'block',
              pointerEvents: 'none',
            }}
          />
          {!fotoPreview && !foto && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                background: 'rgba(15, 23, 42, 0.45)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                borderRadius: '50%',
                textAlign: 'center',
                backdropFilter: 'blur(2px)',
                WebkitBackdropFilter: 'blur(2px)',
                pointerEvents: 'none',
              }}
            >
              <span
                style={{
                  fontSize: '28px',
                  marginBottom: '6px',
                }}
                aria-hidden
              >
                📷
              </span>
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: '600',
                }}
              >
                Subir foto
              </span>
            </div>
          )}
          <span
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              boxShadow: 'inset 0 0 0 3px #ef4444',
              pointerEvents: 'none',
            }}
          />
        </button>

        <h2 style={{ margin: '0 0 6px', fontSize: '22px', color: '#222' }}>
          {getDisplayName(userProfile || perfil, session)}
        </h2>

        {perfil?.pais && (
          <p style={{ margin: '0 0 4px', fontSize: '16px' }}>
            {paisFlag} <span style={{ color: '#555', fontSize: '14px' }}>{paisNombre}</span>
          </p>
        )}
        {perfil?.ciudad && (
          <p style={{ margin: '0 0 3px', color: '#777', fontSize: '13px' }}>📍 {perfil.ciudad}</p>
        )}
        {/* Badges */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
          {perfil?.nivel && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', color: 'white', background: categoriaColor }}>
              {perfil.nivel}
              {perfil.pendiente_validacion && (
                <span title="Pendiente de validación por administrador" style={{ fontSize: '11px', background: 'rgba(255,255,255,0.25)', borderRadius: '10px', padding: '1px 6px' }}>
                  ⏳ pendiente
                </span>
              )}
            </span>
          )}
          {perfil?.lateralidad && <Badge text={perfil.lateralidad} color="#555" />}
          {perfil?.es_federado && <Badge text="Federado" color="#388e3c" />}
          {perfil?.numero_fipa && <Badge text={`FIPA ${perfil.numero_fipa}`} color="#7b1fa2" />}
        </div>

        {successMsg && <p style={{ color: '#4caf50', fontWeight: 'bold', marginTop: '14px', marginBottom: 0 }}>{successMsg}</p>}
      </div>

      {/* Ficha detail card */}
      <div style={{ background: '#f9f9f9', borderRadius: '12px', padding: '20px 24px', boxShadow: '0 1px 6px rgba(0,0,0,0.07)', marginBottom: '16px' }}>

        {!perfil && !editando ? (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <p style={{ color: '#666', marginBottom: '16px' }}>Aún no tienes ficha de jugador creada.</p>
            <button
              onClick={() => setEditando(true)}
              style={{ padding: '12px 24px', background: '#d32f2f', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              🏆 Crear ficha de jugador
            </button>
          </div>

        ) : !editando ? (
          <>
            <h4 style={{ margin: '0 0 14px', color: '#333', borderBottom: '1px solid #e0e0e0', paddingBottom: '8px' }}>Datos del jugador</h4>
            <div style={{ display: 'grid', gap: '2px', marginBottom: '18px' }}>
              <Row label="WhatsApp" value={String(perfil?.whatsapp || cuentaDeSesion?.whatsapp || '—').trim() || '—'} />
              <Row label="Alias" value={String(perfil?.alias || '').trim() || '—'} />
              <Row label="Email cuenta" value={cuentaDeSesion?.email || '—'} />
              <Row label="Categoría" value={
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontWeight: 'bold', color: categoriaColor }}>{perfil.nivel}</span>
                  {perfil.pendiente_validacion && (
                    <span title="Pendiente de validación" style={{ fontSize: '11px', background: '#fff3cd', color: '#856404', border: '1px solid #ffc107', borderRadius: '10px', padding: '1px 7px' }}>
                      ⏳ pendiente
                    </span>
                  )}
                </span>
              } />
              <Row label="Lateralidad" value={perfil.lateralidad} />
              {perfil.fecha_nacimiento && (
                <Row
                  label="Fecha de nacimiento"
                  value={new Date(perfil.fecha_nacimiento).toLocaleDateString('es-AR')}
                />
              )}
              <div>
                <strong>Federado:</strong> {perfil.es_federado ? 'Sí' : 'No'}
              </div>
              <div>
                <strong>N° Federado:</strong> {perfil.numero_fipa}
              </div>
            </div>
            <button
              onClick={() => setEditando(true)}
              style={{ width: '100%', padding: '11px', background: '#d32f2f', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              ✏️ Editar perfil
            </button>
          </>

        ) : (
          <form onSubmit={handleGuardar}>
            <h4 style={{ margin: '0 0 16px', color: '#333', borderBottom: '1px solid #e0e0e0', paddingBottom: '8px' }}>Editar datos</h4>

            <label style={labelStyle}>Nombre y apellido *</label>
            <input
              type="text"
              value={nombreTorneoCompleto}
              onChange={(e) => setNombreTorneoCompleto(e.target.value)}
              placeholder="Ej: Juan Pérez"
              style={{ ...inputStyle, marginBottom: '14px' }}
              autoComplete="name"
            />

            <label style={labelStyle}>Alias</label>
            <input
              type="text"
              name="alias"
              value={formData.alias}
              onChange={handleChange}
              placeholder="Alias (opcional)"
              style={{ ...inputStyle, marginBottom: '14px' }}
              autoComplete="nickname"
            />

            <label style={labelStyle}>WhatsApp</label>
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                gap: '8px',
                alignItems: 'stretch',
                marginBottom: '6px',
                width: '100%',
              }}
            >
              <select
                value={waCodigoPais}
                onChange={(e) => setWaCodigoPais(e.target.value)}
                title="País / código"
                aria-label="Código de país"
                style={{
                  ...inputStyle,
                  flex: '0 0 auto',
                  minWidth: '108px',
                  maxWidth: '132px',
                  marginBottom: 0,
                  cursor: 'pointer',
                }}
              >
                {opcionesCodigoWhatsApp.map((p) => (
                  <option key={`${p.nombre}-${p.codigo}`} value={p.codigo} title={p.nombre}>
                    {p.bandera} {p.codigo}
                  </option>
                ))}
              </select>
              <input
                type="tel"
                inputMode="numeric"
                value={waNumeroLocal}
                onChange={(e) => setWaNumeroLocal(digitsOnly(e.target.value))}
                placeholder="Ej: 91123456789"
                aria-label="Número local sin código de país"
                style={{
                  ...inputStyle,
                  flex: '1 1 0',
                  minWidth: 0,
                  marginBottom: 0,
                }}
                autoComplete="tel-national"
              />
            </div>
            <p style={{ color: '#666', fontSize: '12px', marginTop: 0, marginBottom: '14px', lineHeight: 1.4 }}>
              Obligatorio. Por defecto Argentina (+54): solo el número local (mínimo 10 dígitos), sin repetir +54. Se guarda como +54…
            </p>

            <label style={labelStyle}>Lateralidad</label>
            <select name="lateralidad" value={formData.lateralidad} onChange={handleChange} style={{ ...inputStyle, marginBottom: '14px' }}>
              <option value="Diestro">🤜 Diestro</option>
              <option value="Zurdo">🤛 Zurdo</option>
            </select>

            <label style={labelStyle}>Categoría *</label>
            <select name="nivel" value={formData.nivel} onChange={handleChange} style={inputStyle}>
              {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <p style={{ color: '#f59e0b', fontSize: '12px', marginTop: '2px', marginBottom: '14px' }}>
              ⏳ La categoría será validada por un administrador
            </p>

            {mostrarCampoPais ? (
              <>
                <label style={labelStyle}>
                  País
                  {!torneoPerfil || nivelTorneoScope === 'internacional' ? ' *' : ''}
                </label>
                {torneoPerfil && nivelTorneoScope === 'nacional' ? (
                  <p style={{ color: '#666', fontSize: '12px', marginTop: 0, marginBottom: '6px', lineHeight: 1.35 }}>
                    Por defecto Argentina; puedes cambiar el país si corresponde.
                  </p>
                ) : null}
                <select
                  name="pais"
                  value={formData.pais}
                  onChange={handleChange}
                  style={{ ...inputStyle, marginBottom: '14px' }}
                  required={paisHtmlRequired}
                >
                  <option value="">— Seleccionar país —</option>
                  <optgroup label="Principales">
                    {PAISES_TELEFONO_PRINCIPALES.map((p) => (
                      <option key={p.nombre} value={`${p.bandera} ${p.nombre}`}>
                        {p.bandera} {p.nombre}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Otros países">
                    {PAISES_TELEFONO_OTROS.map((p) => (
                      <option key={p.nombre} value={`${p.bandera} ${p.nombre}`}>
                        {p.bandera} {p.nombre}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </>
            ) : null}

            <label style={labelStyle}>Ciudad</label>
            <input type="text" name="ciudad" placeholder="Ej: Buenos Aires" value={formData.ciudad} onChange={handleChange} style={{ ...inputStyle, marginBottom: '14px' }} />

            <label style={labelStyle}>Fecha de nacimiento</label>
            <input type="date" name="fecha_nacimiento" value={formData.fecha_nacimiento} onChange={handleChange} style={{ ...inputStyle, marginBottom: '14px' }} />

            <label style={labelStyle}>N° FIPA (número de federación)</label>
            <input type="text" name="numero_fipa" placeholder="Ej: 12345" value={formData.numero_fipa} onChange={handleChange} style={{ ...inputStyle, marginBottom: '14px' }} />

            <label style={{ ...labelStyle, marginBottom: '8px' }}>¿Sos federado?</label>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '18px' }}>
              <button type="button" onClick={() => setFormData(prev => ({ ...prev, es_federado: true }))}
                style={{ flex: 1, padding: '10px', border: '2px solid', borderColor: formData.es_federado ? '#388e3c' : '#ddd', background: formData.es_federado ? '#e8f5e9' : 'white', color: formData.es_federado ? '#388e3c' : '#666', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
                ✅ Sí
              </button>
              <button type="button" onClick={() => setFormData(prev => ({ ...prev, es_federado: false }))}
                style={{ flex: 1, padding: '10px', border: '2px solid', borderColor: !formData.es_federado ? '#d32f2f' : '#ddd', background: !formData.es_federado ? '#fff3f3' : 'white', color: !formData.es_federado ? '#d32f2f' : '#666', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
                ❌ No
              </button>
            </div>

            {errorMsg && <p style={{ color: 'red', marginBottom: '10px' }}>{errorMsg}</p>}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit" disabled={isSubmitting}
                style={{ flex: 1, padding: '11px', background: '#d32f2f', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', opacity: isSubmitting ? 0.6 : 1 }}>
                {isSubmitting
                  ? 'Guardando...'
                  : torneoIdValido
                    ? 'Guardar y volver al torneo'
                    : '✅ Guardar'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditando(false);
                  setErrorMsg('');
                  setFotoPreview(null);
                  setWaConfirmLocal('');
                  setWaNumeroLocal('');
                  setWaCodigoPais('+54');
                  waTorneoFormInitRef.current = false;
                  setNombreTorneoCompleto('');
                  setPassRegistroTorneo('');
                  setPassRegistroTorneo2('');
                }}
                style={{ flex: 1, padding: '11px', background: 'transparent', color: '#666', border: '1px solid #ccc', borderRadius: '5px', cursor: 'pointer' }}
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Credit balance */}
      {creditTotal > 0 && (
        <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '12px', padding: '20px 24px', boxShadow: '0 1px 6px rgba(0,0,0,0.07)', marginBottom: '16px' }}>
          <h4 style={{ margin: '0 0 14px', color: '#15803d', borderBottom: '1px solid #bbf7d0', paddingBottom: '8px' }}>💰 Créditos disponibles</h4>
          <div style={{ fontSize: '28px', fontWeight: 900, color: '#16a34a', marginBottom: creditItems.length ? '14px' : 0 }}>
            ${creditTotal.toLocaleString('es-AR')} <span style={{ fontSize: '14px', fontWeight: 600, color: '#4ade80' }}>ARS</span>
          </div>
          {creditItems.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {creditItems.map(c => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#166534', background: 'white', borderRadius: '6px', padding: '6px 10px' }}>
                  <span>📅 {new Date(c.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                  <span style={{ fontWeight: 700 }}>+${Number(c.monto).toLocaleString('es-AR')}</span>
                  <span style={{ color: '#86efac' }}>vence {new Date(c.vence_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      {reservas.length > 0 && (() => {
        const sedeFav = (() => {
          const counts = {};
          reservas.forEach(r => { counts[r.sede] = (counts[r.sede] || 0) + 1; });
          return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
        })();
        return (
          <div style={{ background: '#f9f9f9', borderRadius: '12px', padding: '20px 24px', boxShadow: '0 1px 6px rgba(0,0,0,0.07)', marginBottom: '16px' }}>
            <h4 style={{ margin: '0 0 14px', color: '#333', borderBottom: '1px solid #e0e0e0', paddingBottom: '8px' }}>📊 Estadísticas</h4>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '120px', background: 'white', borderRadius: '10px', padding: '14px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: '28px', fontWeight: 900, color: '#d32f2f' }}>{reservas.length}</div>
                <div style={{ fontSize: '12px', color: '#777', marginTop: '2px' }}>Reservas totales</div>
              </div>
              {sedeFav && (
                <div style={{ flex: 2, minWidth: '160px', background: 'white', borderRadius: '10px', padding: '14px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: '#1e1b4b', lineHeight: 1.3 }}>{sedeFav}</div>
                  <div style={{ fontSize: '12px', color: '#777', marginTop: '2px' }}>Sede favorita</div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Historial de Reservas */}
      <div style={{ background: '#f9f9f9', borderRadius: '12px', padding: '20px 24px', boxShadow: '0 1px 6px rgba(0,0,0,0.07)', marginBottom: '16px' }}>
        <h4 style={{ margin: '0 0 14px', color: '#333', borderBottom: '1px solid #e0e0e0', paddingBottom: '8px' }}>🗓️ Mis Reservas</h4>
        {reservas.length === 0 ? (
          <p style={{ color: '#aaa', textAlign: 'center', margin: '20px 0', fontSize: '14px' }}>Aún no tienes reservas registradas.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {reservas.map(r => {
              const horasHasta = (new Date(`${r.fecha}T${r.hora}:00-03:00`) - Date.now()) / (1000 * 60 * 60);
              const canCancel = horasHasta > 2 && r.estado !== 'cancelada';
              return (
                <div key={r.id} style={{ background: 'white', borderRadius: '8px', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '13px', color: '#1e1b4b' }}>{r.sede}</div>
                    <div style={{ fontSize: '12px', color: '#777', marginTop: '2px' }}>📅 {r.fecha} &nbsp;⏰ {r.hora} &nbsp;🎾 Cancha {r.cancha}</div>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    {r.precio > 0 && (
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#d32f2f' }}>
                        {Number(r.precio).toLocaleString('es-AR')} {r.moneda || 'ARS'}
                      </div>
                    )}
                    <span style={{
                      fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px',
                      background: r.estado === 'confirmada' ? '#dcfce7' : r.estado === 'cancelada' ? '#fee2e2' : r.estado === 'test' ? '#f3f4f6' : '#fef9c3',
                      color: r.estado === 'confirmada' ? '#16a34a' : r.estado === 'cancelada' ? '#dc2626' : r.estado === 'test' ? '#6b7280' : '#854d0e',
                    }}>{r.estado || 'reservada'}</span>
                    {canCancel && (
                      <button
                        onClick={() => handleCancelar(r)}
                        disabled={cancelando === r.id}
                        style={{ fontSize: '11px', padding: '3px 8px', border: '1px solid #fca5a5', borderRadius: '6px', background: '#fff', color: '#dc2626', cursor: 'pointer', fontWeight: 600, opacity: cancelando === r.id ? 0.6 : 1 }}
                      >
                        {cancelando === r.id ? 'Cancelando...' : 'Cancelar'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Historial de Torneos */}
      <div style={{ background: '#f9f9f9', borderRadius: '12px', padding: '20px 24px', boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}>
        <h4 style={{ margin: '0 0 14px', color: '#333', borderBottom: '1px solid #e0e0e0', paddingBottom: '8px' }}>
          🏆 Historial de Torneos
        </h4>
        <p style={{ color: '#aaa', textAlign: 'center', margin: '20px 0', fontSize: '14px' }}>
          Aún no participaste en ningún torneo registrado.
        </p>
      </div>

      {sessionOwnerEmail ? (
        <div style={{ marginTop: '20px', marginBottom: '12px' }}>
          <button
            type="button"
            onClick={async () => {
              try {
                await signOutAndClear();
                navigate('/', { replace: true });
              } catch (e) {
                console.error(e);
              }
            }}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: '10px',
              border: '2px solid rgba(148, 163, 184, 0.85)',
              background: 'transparent',
              color: 'rgba(248, 250, 252, 0.95)',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              boxSizing: 'border-box',
            }}
          >
            Cerrar sesión
          </button>
        </div>
      ) : null}

      </div>
      <BottomNav />
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid #eee' }}>
      <span style={{ color: '#777', fontSize: '13px' }}>{label}</span>
      <span style={{ fontSize: '14px', color: '#333' }}>{value}</span>
    </div>
  );
}

function Badge({ text, color }) {
  return (
    <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', color: 'white', background: color }}>
      {text}
    </span>
  );
}
