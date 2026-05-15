import React, { useCallback, useEffect, useState } from 'react';

export function ShareIconSvg(props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

export function canUseNavigatorShare() {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

/**
 * Web Share API con fallback a portapapeles. Tras copiar, muestra «¡Link copiado!».
 */
export default function ShareLinkButton({
  children,
  shareTitle,
  shareText,
  url,
  variant = 'outline',
  style: styleProp,
  className,
  ...rest
}) {
  const [copiedMsg, setCopiedMsg] = useState(false);

  useEffect(() => {
    if (!copiedMsg) return undefined;
    const t = window.setTimeout(() => setCopiedMsg(false), 2200);
    return () => window.clearTimeout(t);
  }, [copiedMsg]);

  const copyOnly = useCallback(async (u) => {
    const link = String(u || '').trim();
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedMsg(true);
      return;
    } catch {
      /* legacy */
    }
    try {
      const ta = document.createElement('textarea');
      ta.value = link;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedMsg(true);
    } catch {
      window.prompt('Copia este link:', link);
    }
  }, []);

  const handleClick = useCallback(async () => {
    const u =
      String(url || '').trim() ||
      (typeof window !== 'undefined' ? String(window.location.href || '').trim() : '');
    const title = String(shareTitle || '').trim() || (typeof document !== 'undefined' ? document.title : '');
    const text = String(shareText || '').trim();

    if (canUseNavigatorShare()) {
      try {
        await navigator.share({ title, text, url: u });
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return;
      }
    }
    await copyOnly(u);
  }, [copyOnly, shareTitle, shareText, url]);

  const baseStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '10px 14px',
    fontSize: '14px',
    fontWeight: 700,
    borderRadius: '12px',
    cursor: 'pointer',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    ...(variant === 'solid'
      ? {
          border: 'none',
          background: '#E11B22',
          color: '#fff',
          boxShadow: '0 2px 10px rgba(225, 27, 34, 0.35)',
        }
      : {
          border: '1px solid #cbd5e1',
          background: 'var(--bg-card)',
          color: '#334155',
        }),
    ...styleProp,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '4px', width: '100%' }}>
      <button type="button" className={className} onClick={() => void handleClick()} style={baseStyle} {...rest}>
        <ShareIconSvg style={{ flexShrink: 0 }} />
        {children}
      </button>
      {copiedMsg ? (
        <span
          role="status"
          style={{ fontSize: '12px', fontWeight: 700, color: '#15803d', textAlign: 'center', lineHeight: 1.3 }}
        >
          ¡Link copiado!
        </span>
      ) : null}
    </div>
  );
}
