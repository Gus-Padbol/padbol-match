export const TIPO_DOCUMENTO_OPTIONS = [
  { value: 'dni', label: 'DNI' },
  { value: 'pasaporte', label: 'Pasaporte' },
  { value: 'cedula', label: 'Cédula' },
  { value: 'otro', label: 'Otro' },
];

export const GENERO_OPTIONS = [
  { value: 'masculino', label: 'Masculino' },
  { value: 'femenino', label: 'Femenino' },
  { value: 'otro', label: 'Otro' },
  { value: 'prefiero_no_decir', label: 'Prefiero no decir' },
];

export const PAISES_ISO_OPTIONS = [
  { code: 'AR', label: 'Argentina' },
  { code: 'UY', label: 'Uruguay' },
  { code: 'CL', label: 'Chile' },
  { code: 'BR', label: 'Brasil' },
  { code: 'PY', label: 'Paraguay' },
  { code: 'BO', label: 'Bolivia' },
  { code: 'PE', label: 'Perú' },
  { code: 'CO', label: 'Colombia' },
  { code: 'EC', label: 'Ecuador' },
  { code: 'VE', label: 'Venezuela' },
  { code: 'MX', label: 'México' },
  { code: 'US', label: 'Estados Unidos' },
  { code: 'ES', label: 'España' },
  { code: 'IT', label: 'Italia' },
  { code: 'FR', label: 'Francia' },
  { code: 'DE', label: 'Alemania' },
  { code: 'PT', label: 'Portugal' },
  { code: 'GB', label: 'Reino Unido' },
  { code: 'RO', label: 'Rumania' },
  { code: 'AT', label: 'Austria' },
  { code: 'AU', label: 'Australia' },
  { code: 'BE', label: 'Bélgica' },
  { code: 'CA', label: 'Canadá' },
  { code: 'CH', label: 'Suiza' },
  { code: 'NL', label: 'Países Bajos' },
  { code: 'SE', label: 'Suecia' },
  { code: 'NO', label: 'Noruega' },
  { code: 'PL', label: 'Polonia' },
  { code: 'RU', label: 'Rusia' },
  { code: 'UA', label: 'Ucrania' },
  { code: 'TR', label: 'Turquía' },
  { code: 'MA', label: 'Marruecos' },
  { code: 'IL', label: 'Israel' },
  { code: 'JP', label: 'Japón' },
  { code: 'CN', label: 'China' },
  { code: 'GR', label: 'Grecia' },
  { code: 'HR', label: 'Croacia' },
  { code: 'HU', label: 'Hungría' },
  { code: 'RS', label: 'Serbia' },
  { code: 'HN', label: 'Honduras' },
];

const ESTADO_MAP = {
  incompleta: { label: 'Incompleta', color: '#64748b', bg: '#f1f5f9' },
  pendiente: { label: 'Pendiente de revisión', color: '#b45309', bg: '#fffbeb' },
  pendiente_revision: { label: 'Pendiente de revisión', color: '#b45309', bg: '#fffbeb' },
  verificada: { label: 'Verificada', color: '#15803d', bg: '#f0fdf4' },
  rechazada: { label: 'Rechazada', color: '#b91c1c', bg: '#fef2f2' },
};

export function normalizeIdentidadEstado(raw) {
  const key = String(raw || '').trim().toLowerCase();
  if (!key) return 'incompleta';
  if (key === 'pendiente' || key === 'pendiente_revision' || key === 'en_revision') return 'pendiente_revision';
  if (key === 'verificada' || key === 'aprobada') return 'verificada';
  if (key === 'rechazada') return 'rechazada';
  if (key === 'incompleta') return 'incompleta';
  return key;
}

export function identidadEstadoDisplay(estado) {
  const key = normalizeIdentidadEstado(estado);
  return ESTADO_MAP[key] || ESTADO_MAP.incompleta;
}

const PUBLIC_GET_FIELDS = new Set([
  'fecha_nacimiento',
  'tipo_documento',
  'pais_documento',
  'nacionalidad',
  'genero',
  'telefono',
  'contacto_emergencia_nombre',
  'contacto_emergencia_telefono',
  'contacto_emergencia_relacion',
  'estado',
  'estado_verificacion',
  'numero_documento_mascarado',
  'documento_mascarado',
  'tiene_documento',
  'documento_registrado',
]);

export function parseIdentidadFromApi(body) {
  const raw = body?.identidad && typeof body.identidad === 'object'
    ? body.identidad
    : body;
  if (!raw || typeof raw !== 'object') {
    return {
      fecha_nacimiento: '',
      tipo_documento: '',
      pais_documento: '',
      nacionalidad: '',
      genero: '',
      telefono: '',
      contacto_emergencia_nombre: '',
      contacto_emergencia_telefono: '',
      contacto_emergencia_relacion: '',
      estado: 'incompleta',
      numero_documento_mascarado: '',
      tiene_documento: false,
    };
  }

  const estado = normalizeIdentidadEstado(raw.estado || raw.estado_verificacion);
  const masked = String(
    raw.numero_documento_mascarado || raw.documento_mascarado || '',
  ).trim();
  const tieneDocumento = masked.length >= 4;

  return {
    fecha_nacimiento: String(raw.fecha_nacimiento || '').slice(0, 10),
    tipo_documento: String(raw.tipo_documento || '').trim().toLowerCase(),
    pais_documento: String(raw.pais_documento || '').trim().toUpperCase().slice(0, 2),
    nacionalidad: String(raw.nacionalidad || '').trim().toUpperCase().slice(0, 2),
    genero: String(raw.genero || '').trim().toLowerCase(),
    telefono: String(raw.telefono || '').trim(),
    contacto_emergencia_nombre: String(raw.contacto_emergencia_nombre || '').trim(),
    contacto_emergencia_telefono: String(raw.contacto_emergencia_telefono || '').trim(),
    contacto_emergencia_relacion: String(raw.contacto_emergencia_relacion || '').trim(),
    estado,
    numero_documento_mascarado: masked,
    tiene_documento: tieneDocumento,
  };
}

export function emptyIdentidadForm() {
  return {
    fecha_nacimiento: '',
    tipo_documento: 'dni',
    pais_documento: 'AR',
    numero_documento: '',
    nacionalidad: 'AR',
    genero: '',
    telefono: '',
    contacto_emergencia_nombre: '',
    contacto_emergencia_telefono: '',
    contacto_emergencia_relacion: '',
  };
}

export function identidadToForm(parsed) {
  return {
    fecha_nacimiento: parsed.fecha_nacimiento || '',
    tipo_documento: parsed.tipo_documento || 'dni',
    pais_documento: parsed.pais_documento || 'AR',
    numero_documento: '',
    nacionalidad: parsed.nacionalidad || 'AR',
    genero: parsed.genero || '',
    telefono: parsed.telefono || '',
    contacto_emergencia_nombre: parsed.contacto_emergencia_nombre || '',
    contacto_emergencia_telefono: parsed.contacto_emergencia_telefono || '',
    contacto_emergencia_relacion: parsed.contacto_emergencia_relacion || '',
  };
}

export function formatDocumentoGuardadoDisplay(masked) {
  const s = String(masked || '').trim();
  if (!s) return '';
  if (/[*•]/.test(s)) {
    return s.toLowerCase().startsWith('documento guardado')
      ? s
      : `Documento guardado: ${s}`;
  }
  const digits = s.replace(/\D/g, '');
  if (digits.length >= 4) {
    return `Documento guardado: ****${digits.slice(-4)}`;
  }
  return `Documento guardado: ${s}`;
}

export function maskDocumentoLocal(numero) {
  const digits = String(numero || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length <= 4) return '•'.repeat(digits.length);
  return `${'•'.repeat(Math.max(4, digits.length - 4))}${digits.slice(-4)}`;
}

export function buildIdentidadPutPayload(form, { replaceDocument, hasExistingDocument }) {
  const payload = {
    fecha_nacimiento: String(form.fecha_nacimiento || '').trim(),
    tipo_documento: String(form.tipo_documento || '').trim().toLowerCase(),
    pais_documento: String(form.pais_documento || '').trim().toUpperCase().slice(0, 2),
    nacionalidad: String(form.nacionalidad || '').trim().toUpperCase().slice(0, 2),
    genero: String(form.genero || '').trim().toLowerCase(),
    telefono: String(form.telefono || '').trim(),
    contacto_emergencia_nombre: String(form.contacto_emergencia_nombre || '').trim(),
    contacto_emergencia_telefono: String(form.contacto_emergencia_telefono || '').trim(),
    contacto_emergencia_relacion: String(form.contacto_emergencia_relacion || '').trim(),
  };

  const numero = String(form.numero_documento || '').trim();
  const mustSendDocument = !hasExistingDocument || replaceDocument;
  if (mustSendDocument) {
    payload.numero_documento = numero;
  }

  return payload;
}

export function validateIdentidadForm(form, { hasExistingDocument, replaceDocument }) {
  const errors = [];

  if (!String(form.fecha_nacimiento || '').trim()) {
    errors.push('Ingresá tu fecha de nacimiento.');
  } else {
    const d = new Date(`${form.fecha_nacimiento}T12:00:00`);
    if (Number.isNaN(d.getTime())) {
      errors.push('La fecha de nacimiento no es válida.');
    } else if (d > new Date()) {
      errors.push('La fecha de nacimiento no puede ser futura.');
    }
  }

  if (!TIPO_DOCUMENTO_OPTIONS.some((o) => o.value === form.tipo_documento)) {
    errors.push('Seleccioná un tipo de documento.');
  }

  if (!String(form.pais_documento || '').trim()) {
    errors.push('Seleccioná el país del documento.');
  }

  if (!String(form.nacionalidad || '').trim()) {
    errors.push('Seleccioná tu nacionalidad.');
  }

  if (!GENERO_OPTIONS.some((o) => o.value === form.genero)) {
    errors.push('Seleccioná género.');
  }

  if (!String(form.telefono || '').trim()) {
    errors.push('Ingresá un teléfono de contacto.');
  } else if (String(form.telefono).trim().length < 8) {
    errors.push('El teléfono parece demasiado corto.');
  }

  const needsDocument = !hasExistingDocument || replaceDocument;
  const numero = String(form.numero_documento || '').trim();
  if (needsDocument) {
    if (!numero) {
      errors.push('Ingresá el número de documento.');
    } else if (numero.length < 4) {
      errors.push('El número de documento parece demasiado corto.');
    }
  }

  const emergNombre = String(form.contacto_emergencia_nombre || '').trim();
  const emergTel = String(form.contacto_emergencia_telefono || '').trim();
  if ((emergNombre && !emergTel) || (!emergNombre && emergTel)) {
    errors.push('Completá nombre y teléfono del contacto de emergencia.');
  }

  return errors;
}

export function stripTechnicalIdentidadFields(obj) {
  if (!obj || typeof obj !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (PUBLIC_GET_FIELDS.has(k)) out[k] = v;
  }
  return out;
}
