const env = typeof process !== 'undefined' ? process.env : {};

// La landing comercial ya forma parte del sitio público. La variable permite
// desactivarla de manera explícita ante una contingencia, sin depender de que
// Vercel tenga una configuración adicional para mostrarla.
export const COMMERCIAL_PRICING_PUBLIC = env.REACT_APP_ENABLE_CLUB_PRICING !== 'false';

export const COMMERCIAL_PRICING_PREVIEW =
  env.REACT_APP_COMMERCIAL_PRICING_PREVIEW === 'true';

export const COMMERCIAL_PRICING_ROUTE_ENABLED =
  COMMERCIAL_PRICING_PUBLIC || COMMERCIAL_PRICING_PREVIEW;

export const COMMERCIAL_PLANS_API_BASE = String(
  env.REACT_APP_API_BASE_URL || 'https://padbol-backend.onrender.com',
).replace(/\/$/, '');

/**
 * Catálogo comercial publicado. Se mantiene en una única fuente para que la
 * página no dependa de un endpoint que todavía no está disponible en producción.
 */
export const COMMERCIAL_PLANS_PREVIEW = Object.freeze([
  {
    slug: 'starter',
    name: 'Starter',
    monthlyAmount: 0,
    annualAmount: 0,
    currency: 'USD',
    commissionPercent: 1,
    courtsLabel: 'Hasta 4 canchas',
    adminsLabel: '1 administrador',
    summary: 'Para clubes de hasta 4 canchas que quieren administrar su operación sin abono mensual.',
    ctaLabel: 'EMPEZAR SIN ABONO',
    ctaPath: '/unirse?plan=starter',
    features: [
      'Padbol, Pádel, Pickleball y Tenis',
      'Jugadores y clientes ilimitados',
      'Perfil público de la sede, canchas, horarios, tarifas y disponibilidad',
      'Reservas online y carga manual de reservas',
      'Partidos, carga de resultados y ranking del club',
      'Torneos administrados por la sede: inscripciones, equipos, partidos y resultados',
      'Marcador digital con control en vivo y salida para pantalla o TV',
      'Panel operativo de reservas, ocupación e ingresos',
      'Consulta de saldos, movimientos y canjes de PadCoins de la sede',
      'Importación de archivos compatibles, sujeta a validación previa',
    ],
  },
  {
    slug: 'pro',
    name: 'Pro',
    monthlyAmount: 69,
    annualAmount: 690,
    currency: 'USD',
    commissionPercent: 0.65,
    courtsLabel: 'Hasta 12 canchas',
    adminsLabel: 'Hasta 5 administradores',
    summary: 'Para clubes que quieren automatizar la operación y hacer crecer su comunidad.',
    ctaLabel: 'ELEGIR PRO',
    ctaPath: '/unirse?plan=pro',
    featured: true,
    features: [
      'Todo lo incluido en Starter',
      'Torneos automatizados: sorteos, zonas, fixture, clasificación, llaves y podios',
      'Reportes y exportaciones de reservas, ingresos y PadCoins',
      'Listas de espera de torneos y avisos de apertura',
      'Creación de campañas, promociones, premios y canjes con PadCoins',
      'Membresías propias del club',
      'Sponsors propios en marcador, torneos y pantallas de la sede',
      'Notificaciones segmentadas a jugadores de la sede',
      'Migración asistida y soporte prioritario',
    ],
  },
  {
    slug: 'business',
    name: 'Business',
    monthlyAmount: 199,
    annualAmount: null,
    currency: 'USD',
    commissionPercent: 0.35,
    pricePrefix: 'Desde',
    commissionPrefix: 'Desde',
    courtsLabel: '13+ canchas',
    adminsLabel: 'Condiciones personalizadas',
    summary: 'Soluciones multisede y personalizadas para cadenas, operadores y licenciatarios.',
    ctaLabel: 'CONSULTAR PLAN BUSINESS',
    ctaPath: '/contacto?tema=business',
    contactOnly: true,
    features: [
      'Todo lo incluido en Pro',
      'Alcance multisede definido con cada organización',
      'Permisos y administración centralizada según proyecto',
      'Reportes consolidados y campañas de red según alcance',
      'Migración personalizada',
      'Integraciones y API sujetas a validación técnica',
      'Soporte dedicado',
    ],
  },
]);

export function normalizeCommercialCatalog(payload) {
  const rows = Array.isArray(payload?.plans) ? payload.plans : Array.isArray(payload) ? payload : [];
  return rows
    .filter((plan) => plan && plan.slug && plan.name)
    .map((plan) => ({
      ...plan,
      features: Array.isArray(plan.features) ? plan.features.filter(Boolean) : [],
    }));
}
