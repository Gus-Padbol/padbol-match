import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { confirmAdminJugadoresImport, previewAdminJugadoresImport } from '../utils/adminJugadoresApi';

const FIELD_ALIASES = {
  nombre: ['nombre', 'name', 'first name', 'nombres'],
  apellido: ['apellido', 'last name', 'surname', 'apellidos'],
  email: ['email', 'e-mail', 'correo', 'correo electrónico', 'mail'],
  telefono: ['telefono', 'teléfono', 'phone', 'celular', 'whatsapp', 'móvil'],
};

function cleanHeader(value) {
  return String(value || '').trim().toLocaleLowerCase('es').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
}

function valueFor(row, field) {
  const aliases = FIELD_ALIASES[field];
  const key = Object.keys(row).find((candidate) => aliases.includes(cleanHeader(candidate)));
  return key ? String(row[key] ?? '').trim() : '';
}

function parseSpreadsheet(file) {
  return file.arrayBuffer().then((buffer) => {
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!firstSheet) throw new Error('El archivo no contiene una hoja para importar.');
    const sourceRows = XLSX.utils.sheet_to_json(firstSheet, { defval: '', raw: false });
    const rows = sourceRows
      .map((row) => ({
        nombre: valueFor(row, 'nombre'),
        apellido: valueFor(row, 'apellido'),
        email: valueFor(row, 'email'),
        telefono: valueFor(row, 'telefono'),
      }))
      .filter((row) => Object.values(row).some(Boolean));
    if (!rows.length) throw new Error('No encontramos filas con datos. Usá las columnas Nombre, Apellido, Email y/o Teléfono.');
    return rows;
  });
}

function downloadTemplate() {
  const sheet = XLSX.utils.json_to_sheet([
    { Nombre: 'Ana', Apellido: 'Pérez', Email: 'ana@ejemplo.com', Teléfono: '+5491112345678' },
  ]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Jugadores');
  XLSX.writeFile(book, 'plantilla-jugadores-padbol-match.xlsx');
}

const buttonStyle = {
  padding: '9px 13px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontWeight: 800, cursor: 'pointer', fontSize: 13,
};

export default function AdminJugadoresImport({ apiBaseUrl, accessToken, sedeId, disabled = false, onImported }) {
  const inputRef = useRef(null);
  const [rows, setRows] = useState([]);
  const [preview, setPreview] = useState(null);
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const pickFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !sedeId) return;
    setLoading(true); setError(''); setPreview(null); setResult(null);
    try {
      const parsed = await parseSpreadsheet(file);
      const nextPreview = await previewAdminJugadoresImport({ apiBaseUrl, accessToken, sedeId, rows: parsed });
      setRows(parsed); setPreview(nextPreview); setFileName(file.name);
    } catch (err) {
      setRows([]); setError(err.message || 'No se pudo leer el archivo.');
    } finally { setLoading(false); }
  };

  const confirm = async () => {
    setLoading(true); setError('');
    try {
      const nextResult = await confirmAdminJugadoresImport({ apiBaseUrl, accessToken, sedeId, rows });
      setResult(nextResult); setPreview(null); setRows([]); onImported?.();
    } catch (err) { setError(err.message || 'No se pudo confirmar la importación.'); }
    finally { setLoading(false); }
  };

  const ready = Number(preview?.summary?.ready || 0);
  const total = Array.isArray(preview?.items) ? preview.items.length : 0;
  return (
    <section style={{ marginBottom: 18, padding: 14, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--bg-page)' }} aria-labelledby="importar-jugadores-title">
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ maxWidth: 660 }}>
          <h3 id="importar-jugadores-title" style={{ margin: '0 0 5px', fontSize: 16 }}>Traer jugadores desde otra aplicación</h3>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.45 }}>
            Tu comunidad y tu trabajo son tuyos. Traé la información que ya tenés en Excel o CSV; primero revisamos cada fila y, al confirmar, solo vinculamos cuentas existentes de Padbol Match. No se crean usuarios ni se envían mensajes sin autorización.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={downloadTemplate} style={buttonStyle}>Descargar plantilla</button>
          <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" onChange={pickFile} hidden />
          <button type="button" disabled={disabled || loading || !sedeId} onClick={() => inputRef.current?.click()} style={{ ...buttonStyle, background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)', opacity: disabled || !sedeId ? .55 : 1 }}>
            {loading ? 'Validando…' : 'Elegir archivo'}
          </button>
        </div>
      </div>
      {fileName ? <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>Archivo: <strong>{fileName}</strong></p> : null}
      {error ? <p role="alert" style={{ margin: '12px 0 0', color: '#b91c1c', fontWeight: 700, fontSize: 13 }}>{error}</p> : null}
      {preview ? (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <p style={{ margin: '0 0 8px', fontWeight: 800 }}>{ready} de {total} jugadores listos para vincular</p>
          <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--text-secondary)' }}>Los repetidos, faltantes o ya vinculados no se modifican.</p>
          <div style={{ maxHeight: 150, overflow: 'auto', fontSize: 12, border: '1px solid var(--border)', borderRadius: 8 }}>
            {preview.items.map((item) => <div key={item.row} style={{ padding: '7px 9px', borderBottom: '1px solid var(--border)' }}><strong>Línea {item.row} · {item.display_name || [item.nombre, item.apellido].filter(Boolean).join(' ') || item.email || item.telefono}</strong><span style={{ color: item.status === 'ready' ? '#15803d' : 'var(--text-secondary)' }}> — {item.status === 'ready' ? 'Lista para vincular' : item.reason}</span></div>)}
          </div>
          <button type="button" onClick={confirm} disabled={loading || ready === 0} style={{ ...buttonStyle, marginTop: 12, background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)', opacity: ready === 0 ? .55 : 1 }}>Confirmar {ready} jugador{ready === 1 ? '' : 'es'}</button>
        </div>
      ) : null}
      {result ? <p role="status" style={{ margin: '12px 0 0', color: '#15803d', fontWeight: 800, fontSize: 13 }}>Importación terminada: {result.summary.imported} vinculados, {result.summary.skipped} sin cambios{result.summary.errors ? ` y ${result.summary.errors} con error` : ''}.</p> : null}
    </section>
  );
}
