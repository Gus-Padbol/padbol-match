export function padcoinsMovementDescription(raw) {
  const value = String(raw || '').trim();
  if (!value) return '—';
  const demo = value.match(/^(?:\[?(?:EPHEMERAL|QA|E2E|TEST)\]?)(?:[|:_-]|\s)\s*(.*)$/i);
  if (demo) {
    return demo[1] && !demo[1].includes('|')
      ? `Prueba: ${padcoinsMovementDescription(demo[1])}`
      : 'Movimiento de prueba';
  }
  const clean = value.replace(/\s*\[(?:meta|metadata)\s*:[\s\S]*\]\s*$/i, '').trim();
  if (!clean) return 'Movimiento registrado';
  if (/^[[{]/.test(clean)) {
    try {
      const parsed = JSON.parse(clean);
      const label = parsed?.descripcion || parsed?.description || parsed?.motivo || parsed?.concepto;
      return typeof label === 'string' ? padcoinsMovementDescription(label) : 'Movimiento registrado';
    } catch {
      return 'Movimiento registrado';
    }
  }
  return clean;
}
