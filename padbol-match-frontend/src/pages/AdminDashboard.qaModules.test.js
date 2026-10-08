import fs from 'fs';
import path from 'path';

const readSource = (relativePath) => fs.readFileSync(path.join(__dirname, relativePath), 'utf8');

test('PadCoins ofrece navegación interna y modo de cálculo acotado', () => {
  const source = readSource('./AdminDashboard.jsx');
  expect(source).toContain('admin-padcoins-section-nav');
  expect(source).toContain('value="porcentaje_valor_pagado"');
  expect(source).toContain('value="monto_fijo"');
  expect(source).toContain('id="pc-canjes"');
});

test('Configuración separa puntos y posiciones de sponsors', () => {
  const source = readSource('./AdminDashboard.jsx');
  expect(source).toContain("setConfigSubtab('puntos')");
  expect(source).toContain("setConfigSubtab('sponsors')");
  expect(source).toContain("configSubtab === 'puntos'");
  expect(source).toContain("configSubtab === 'sponsors'");
  expect(source).toContain("pos === 1 ? ' 1°'");
});

test('el panel incorpora la superficie de Next Generation', () => {
  const source = readSource('./AdminDashboard.jsx');
  expect(source).toContain("id: 'next_generation'");
  expect(source).toContain('<AdminNextGenerationSection');
});

test('superadmin conserva Atención / CRM y el compositor completo de notificaciones', () => {
  const dashboard = readSource('./AdminDashboard.jsx');
  const notifications = readSource('../components/AdminNotificacionesSection.jsx');

  expect(dashboard).toContain("isSuperAdmin || puedeVerWhatsapp ? [{ id: 'whatsapp', label: t('admin.tabs.crm'");
  expect(dashboard).toContain("'Support / CRM' : 'Atención / CRM'");
  expect(notifications).toContain('Una noticia publicada');
  expect(notifications).toContain('La sección Padbol Academy');
  expect(notifications).toContain('Una jornada de Next Generation');
  expect(notifications).toContain('Otra sección de la aplicación');
});
