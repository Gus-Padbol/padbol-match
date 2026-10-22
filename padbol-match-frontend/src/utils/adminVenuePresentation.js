function boundary(raw, end = false) {
  const value = String(raw || '').trim();
  if (!value) return null;
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T${end ? '23:59:59' : '00:00:00'}` : value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function membershipPlanVisibleStatus(plan, now = new Date()) {
  const expiry = boundary(plan?.vigencia_hasta || plan?.fecha_vencimiento, true);
  const start = boundary(plan?.vigencia_desde);
  if ((plan?.vigencia_hasta && !expiry) || (plan?.vigencia_desde && !start)) return 'Información incompleta';
  if (expiry && expiry < now) return 'Vencida';
  if (plan?.activo === false) return 'Deshabilitada';
  if (start && start > now) return 'Próximamente';
  return 'Habilitada';
}

export function venueContractBadge(contract, now = new Date()) {
  const start = boundary(contract?.fecha_inicio);
  const expiry = boundary(contract?.fecha_vencimiento, true);
  if (!start || !expiry || !String(contract?.referencia || '').trim() || start > expiry) {
    return { label: 'Información incompleta', bg: 'var(--bg-input)', color: 'var(--text-secondary)' };
  }
  if (start > now) return { label: 'Pendiente de inicio', bg: 'var(--bg-input)', color: 'var(--text-secondary)' };
  if (expiry < now) return { label: 'Vencido', bg: '#dc2626', color: '#fff' };
  const days = Math.ceil((expiry - now) / 86400000);
  if (days <= 30) return { label: 'Por vencer', bg: '#f59e0b', color: 'var(--text-primary)' };
  return { label: 'Vigente', bg: '#16a34a', color: '#fff' };
}
