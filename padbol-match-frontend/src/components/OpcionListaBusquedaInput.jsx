import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

function useDebouncedValue(value, ms) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/**
 * Selector con autocompletado sobre una lista de strings (p. ej. categorías de ranking).
 * @param {{ options: string[]; value: string; onChange: (v: string) => void; placeholder?: string; allLabel?: string; debounceMs?: number; minChars?: number; inputStyle?: React.CSSProperties; 'aria-label'?: string }} props
 */
export default function OpcionListaBusquedaInput({
  options,
  value,
  onChange,
  placeholder = 'Buscar…',
  allLabel = 'Todas',
  debounceMs = 280,
  minChars = 0,
  inputStyle = {},
  'aria-label': ariaLabel = 'Buscar en lista',
}) {
  const [text, setText] = useState('');
  const [listOpen, setListOpen] = useState(false);
  const blurCloseRef = useRef(null);
  const prevValueRef = useRef(null);
  const listboxId = useId();

  useEffect(() => {
    const v = String(value || '').trim();
    if (prevValueRef.current === v) return;
    prevValueRef.current = v;
    setText(v ? v : '');
  }, [value]);

  const debouncedQ = useDebouncedValue(text.trim(), debounceMs);

  const filtradas = useMemo(() => {
    const base = (options || []).filter(Boolean);
    if (debouncedQ.length < minChars) return base.slice(0, 40);
    const q = debouncedQ.toLowerCase();
    return base.filter((o) => String(o).toLowerCase().includes(q)).slice(0, 40);
  }, [options, debouncedQ, minChars]);

  const onPick = useCallback(
    (opt) => {
      const s = String(opt || '').trim();
      onChange(s);
      setText(s);
      setListOpen(false);
    },
    [onChange]
  );

  const showList =
    listOpen &&
    (debouncedQ.length >= minChars || minChars === 0) &&
    (filtradas.length > 0 || (!value && minChars === 0));

  return (
    <div style={{ position: 'relative', minWidth: '160px', flex: '0 1 200px' }}>
      <input
        type="text"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={showList}
        aria-controls={listboxId}
        autoComplete="off"
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          const v = e.target.value;
          setText(v);
          setListOpen(true);
          if (!v.trim()) onChange('');
        }}
        onFocus={() => setListOpen(true)}
        onBlur={() => {
          blurCloseRef.current = window.setTimeout(() => setListOpen(false), 160);
        }}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '8px 12px',
          borderRadius: '8px',
          fontSize: '13px',
          background: 'var(--bg-card)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border)',
          ...inputStyle,
        }}
      />
      {minChars > 0 && text.trim().length > 0 && text.trim().length < minChars ? (
        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px' }}>
          Escribe al menos {minChars} caracteres
        </div>
      ) : null}
      {showList ? (
        <ul
          id={listboxId}
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
            border: '1px solid var(--border)',
            zIndex: 50,
            listStyle: 'none',
          }}
        >
          <li key="__all__">
            <button
              type="button"
              role="option"
              aria-selected={!String(value || '').trim()}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                if (blurCloseRef.current) window.clearTimeout(blurCloseRef.current);
                onChange('');
                setText('');
                setListOpen(false);
              }}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '10px 12px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 700,
                color: 'var(--text-secondary)',
              }}
            >
              {allLabel}
            </button>
          </li>
          {filtradas.map((o) => (
            <li key={o}>
              <button
                type="button"
                role="option"
                aria-selected={String(value || '').trim() === String(o)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  if (blurCloseRef.current) window.clearTimeout(blurCloseRef.current);
                  onPick(o);
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
                  color: 'var(--text-primary)',
                }}
              >
                {o}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
