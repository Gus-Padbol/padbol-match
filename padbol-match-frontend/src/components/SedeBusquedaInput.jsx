import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

function useDebouncedValue(value, ms) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/**
 * Autocompletado de sedes: filtra por nombre (y opcional país) con debounce.
 * @param {{
 *   sedes: { id?: string|number; nombre?: string; pais?: string }[];
 *   minChars?: number;
 *   debounceMs?: number;
 *   placeholder?: string;
 *   inputStyle?: React.CSSProperties;
 *   'aria-label'?: string;
 * } & (
 *   | { mode: 'nombre'; valueNombre: string; onSelectNombre: (nombre: string) => void }
 *   | { mode: 'id'; valueId: string; onSelectId: (id: string) => void; formatOption?: (s: any) => string }
 * )} props
 */
export default function SedeBusquedaInput(props) {
  const {
    sedes,
    minChars = 2,
    debounceMs = 280,
    placeholder = 'Buscar sede…',
    inputStyle = {},
    'aria-label': ariaLabel = 'Buscar sede',
  } = props;

  const [text, setText] = useState('');
  const [listOpen, setListOpen] = useState(false);
  const blurCloseRef = useRef(null);
  const prevExternalRef = useRef(null);

  const formatOption = props.mode === 'id' ? props.formatOption : undefined;

  useEffect(() => {
    const extKey =
      props.mode === 'nombre'
        ? `n:${String(props.valueNombre ?? '')}`
        : `i:${String(props.valueId ?? '')}`;
    if (prevExternalRef.current === extKey) return;
    prevExternalRef.current = extKey;

    if (props.mode === 'nombre') {
      setText(String(props.valueNombre || '').trim());
    } else {
      const id = String(props.valueId || '').trim();
      const s = id ? sedes.find((x) => String(x.id) === id) : null;
      const label = s
        ? formatOption
          ? formatOption(s)
          : `${s.pais ? `${getFlag(s.pais)} ` : ''}${s.nombre || ''}`.trim()
        : '';
      setText(label);
    }
  }, [props.mode, props.valueNombre, props.valueId, sedes, formatOption]);

  const debouncedQ = useDebouncedValue(text.trim(), debounceMs);

  const opciones = useMemo(() => {
    if (debouncedQ.length < minChars) return [];
    const q = debouncedQ.toLowerCase();
    return (sedes || [])
      .filter((s) => {
        const n = String(s.nombre || '').toLowerCase();
        const p = String(s.pais || '').toLowerCase();
        const c = String(s.ciudad || '').toLowerCase();
        return n.includes(q) || p.includes(q) || c.includes(q);
      })
      .slice(0, 80);
  }, [sedes, debouncedQ, minChars]);

  const onPick = useCallback(
    (s) => {
      if (props.mode === 'nombre') {
        props.onSelectNombre(String(s.nombre || '').trim());
        setText(String(s.nombre || '').trim());
      } else {
        props.onSelectId(String(s.id));
        const label = props.formatOption ? props.formatOption(s) : `${s.pais ? `${getFlag(s.pais)} ` : ''}${s.nombre || ''}`.trim();
        setText(label);
      }
      setListOpen(false);
    },
    [props, formatOption]
  );

  const showList = listOpen && debouncedQ.length >= minChars && opciones.length > 0;

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <input
        type="text"
        aria-label={ariaLabel}
        autoComplete="off"
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          const v = e.target.value;
          setText(v);
          setListOpen(true);
          if (props.mode === 'nombre') {
            if (!v.trim()) props.onSelectNombre('');
            else if (v !== String(props.valueNombre || '')) props.onSelectNombre('');
          } else {
            props.onSelectId('');
          }
        }}
        onFocus={() => setListOpen(true)}
        onBlur={() => {
          blurCloseRef.current = window.setTimeout(() => setListOpen(false), 160);
        }}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          ...inputStyle,
        }}
      />
      {debouncedQ.length > 0 && debouncedQ.length < minChars ? (
        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>Escribe al menos {minChars} caracteres</div>
      ) : null}
      {showList ? (
        <ul
          role="listbox"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: '100%',
            margin: '4px 0 0',
            padding: '6px 0',
            maxHeight: '220px',
            overflowY: 'auto',
            background: 'var(--bg-card)',
            borderRadius: '10px',
            boxShadow: '0 12px 28px rgba(0,0,0,0.15)',
            border: '1px solid #e2e8f0',
            zIndex: 50,
            listStyle: 'none',
          }}
        >
          {opciones.map((s) => (
            <li key={String(s.id ?? s.nombre)}>
              <button
                type="button"
                role="option"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  if (blurCloseRef.current) window.clearTimeout(blurCloseRef.current);
                  onPick(s);
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px 12px',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#0f172a',
                }}
              >
                {props.mode === 'id' && props.formatOption ? props.formatOption(s) : `${s.pais ? `${getFlag(s.pais)} ` : ''}${s.nombre || ''}`}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function getFlag(pais) {
  if (!pais) return '';
  const p = String(pais).trim();
  if ([...p][0]?.match(/\p{Emoji_Presentation}/u)) return [...p][0];
  return '';
}
