/**
 * Contenido público verificado del Centro de ayuda.
 *
 * Fuente: outputs/help-center (2026-11-07). Se incluye ÚNICAMENTE el artículo
 * `open-registration`, cuyo alcance verificado es abrir el formulario de alta.
 * No se copian fixtures, restringidos ni borradores.
 */
export const HELP_LANGUAGES = Object.freeze(['es', 'en', 'pt']);

export const PUBLIC_ARTICLES = Object.freeze([
  {
    id: 'open-registration',
    visibility: 'public',
    audience: ['player', 'club_admin', 'national_admin', 'chain_admin', 'superadmin'],
    category: 'account',
    status: 'verified',
    fixture: false,
    verification: 'runtime-anonymous-production',
    verifiedScope: 'Sólo abrir el formulario de creación de cuenta; no completar, enviar ni verificar el alta.',
    verifiedScopeText: {
      es: 'Sólo abrir el formulario de creación de cuenta; no completar, enviar ni verificar el alta.',
      en: 'Only opening the account creation form; completing, submitting or verifying registration is not covered.',
      pt: 'Somente abrir o formulário de criação de conta; preencher, enviar ou verificar o cadastro não está coberto.',
    },
    // Corpus de búsqueda: solo la intención verificada (abrir el formulario).
    // No se indexan la nota NO VERIFICADO ni operaciones ajenas (alta, perfil,
    // recuperación de contraseña, eliminación de cuenta, etc.).
    searchText: {
      es: 'abrir formulario crear cuenta registro registrarse acceso correo contrasena repetir contrasena terminos privacidad crear cuenta',
      en: 'open account creation form registration sign up access create account email password repeat password terms privacy',
      pt: 'abrir formulario criar conta registro cadastro registrar acesso e-mail senha repetir senha termos privacidade criar conta',
    },
    source: 'evidence/runtime-public-entry-20261107.txt; production web /static/js/main.d2bfd4b7.js',
    productVersion: 'production web bundle main.d2bfd4b7.js; Git commit not asserted',
    testedAt: '2026-11-07',
    evidence: 'CUA sin sesión: /acceso → ¿No tienes cuenta? Regístrate → Crear cuenta; campos y dos casillas visibles. Sin submit, datos personales, aceptación legal, correo ni ticket.',
    scope: {type: 'global'},
    translations: {
      es: {
        title: 'Abrir el formulario para crear una cuenta',
        purpose: 'Llegar al formulario de registro. El alta completa y el perfil posterior no están verificados.',
        steps: [
          'Abre https://www.padbolmatch.com/acceso.',
          'Pulsa «¿No tienes cuenta? Regístrate».',
          'Comprueba que aparezca «Crear cuenta» con correo, contraseña, repetir contraseña, Términos y Privacidad.',
        ],
        note: 'NO VERIFICADO: completar los campos, aceptar Términos/Privacidad, pulsar «Crear cuenta», recibir correo o completar el perfil.',
      },
      en: {
        title: 'Open the account creation form',
        purpose: 'Reach the registration form. Full account creation and later profile steps are not verified.',
        steps: [
          'Open https://www.padbolmatch.com/acceso.',
          'Select “¿No tienes cuenta? Regístrate”.',
          'Confirm that “Crear cuenta” appears with email, password, repeat password, Terms and Privacy.',
        ],
        note: 'NOT VERIFIED: completing fields, accepting Terms/Privacy, pressing “Crear cuenta”, receiving email or completing the profile.',
      },
      pt: {
        title: 'Abrir o formulário de criação de conta',
        purpose: 'Chegar ao formulário de registro. A criação completa e o perfil posterior não estão verificados.',
        steps: [
          'Abra https://www.padbolmatch.com/acceso.',
          'Selecione “¿No tienes cuenta? Regístrate”.',
          'Confirme que aparece “Crear cuenta” com e-mail, senha, repetir senha, Termos e Privacidade.',
        ],
        note: 'NÃO VERIFICADO: preencher, aceitar Termos/Privacidade, pressionar “Crear cuenta”, receber e-mail ou completar o perfil.',
      },
    },
    module: 'cuenta',
    slug: 'abrir-registro',
    verifiedAt: '2026-11-07',
    requirements: {
      es: ['No necesitas una cuenta para abrir el formulario.'],
      en: [
        'You do not need an account to open the form.',
        'The quoted button names are from the verified Spanish interface; the English interface labels have not been verified.',
      ],
      pt: [
        'Você não precisa de uma conta para abrir o formulário.',
        'Os nomes de botões citados correspondem à interface em espanhol verificada; os rótulos da interface em português não foram verificados.',
      ],
    },
    audienceLabel: {es: 'Visitante', en: 'Visitor', pt: 'Visitante'},
    commonIssues: {
      es: ['No hay problemas frecuentes verificados para este alcance.'],
      en: ['No common issues are verified for this scope.'],
      pt: ['Não há problemas frequentes verificados para este escopo.'],
    },
    visualFields: {
      es: ['Correo', 'Contraseña', 'Repetir contraseña', 'Términos', 'Privacidad', 'Crear cuenta'],
      en: ['Email', 'Password', 'Repeat password', 'Terms', 'Privacy', 'Create account'],
      pt: ['E-mail', 'Senha', 'Repetir senha', 'Termos', 'Privacidade', 'Criar conta'],
    },
  },
]);

export function normalizeHelpLanguage(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw.startsWith('es')) return 'es';
  if (raw.startsWith('pt')) return 'pt';
  return 'en';
}

/** Filtro único para listado, búsqueda, enlace directo y bundle público. */
export function isPublicVerified(article) {
  return Boolean(
    article
    && article.status === 'verified'
    && article.fixture !== true
    && article.visibility === 'public'
    && article.scope
    && article.scope.type === 'global'
    && article.translations
  );
}

export function publicArticles(articles = PUBLIC_ARTICLES) {
  return (articles || []).filter(isPublicVerified);
}

export function getPublicArticle(module, slug, articles = PUBLIC_ARTICLES) {
  return publicArticles(articles).find(
    (article) => article.module === module && article.slug === slug,
  ) || null;
}

function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const SYNONYMS = {
  registro: ['registrarse', 'registrar', 'registro', 'cuenta', 'crear', 'signup'],
  registrarse: ['registro', 'registro', 'crear', 'cuenta', 'signup'],
  'crear cuenta': ['registro', 'registrarse', 'abrir', 'formulario'],
  account: ['signup', 'register', 'registration', 'form', 'create'],
  signup: ['account', 'register', 'registration', 'form'],
  conta: ['registro', 'cadastro', 'registrar', 'criar', 'formulario'],
  cadastro: ['conta', 'registro', 'registrar', 'criar', 'formulario'],
  abrir: ['abre', 'abrir', 'open', 'formulario', 'form'],
};

/**
 * Búsqueda pública y determinista. No hay fallback al primer artículo: si la
 * consulta no encuentra contenido verificado, la UI debe ofrecer soporte.
 */
export function searchHelp(query, language = 'es', articles = PUBLIC_ARTICLES) {
  const lang = normalizeHelpLanguage(language);
  const terms = normalizeText(query).split(/\s+/).filter(Boolean);
  const available = publicArticles(articles);
  if (!terms.length) {
    return {results: available, fallback: null, reason: 'empty_query'};
  }
  const scored = [];
  for (const article of available) {
    const copy = article.translations?.[lang];
    if (!copy || typeof copy.title !== 'string' || !Array.isArray(copy.steps)) continue;
    const searchText = article.searchText?.[lang] || [copy.title, ...copy.steps].join(' ');
    const haystackWords = normalizeText(searchText).split(/\s+/).filter(Boolean);
    const termMatches = (term) => {
      const expanded = [term, ...(SYNONYMS[term] || [])];
      return expanded.some((candidate) => haystackWords.some((word) => word === candidate || (candidate.length >= 4 && word.startsWith(candidate))));
    };
    if (!terms.every(termMatches)) continue;
    const score = terms.reduce((total, term) => total + (termMatches(term) ? 1 : 0), 0);
    scored.push({...article, score});
  }
  scored.sort((a, b) => b.score - a.score || String(a.id).localeCompare(String(b.id)));
  return scored.length
    ? {results: scored, fallback: null, reason: null}
    : {results: [], fallback: 'support', reason: 'insufficient_verified_content'};
}

/** El contenido reservado no está habilitado sin auth/rol/tenant reales del servidor. */
export function canAccessReserved() {
  return false;
}

export const RESERVED_CONTENT_AVAILABLE = false;
