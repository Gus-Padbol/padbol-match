import { getApiBaseUrl } from './apiPublicBaseUrl';

export class AdminHelpApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'AdminHelpApiError';
    this.status = status;
    this.code = code;
  }
}

async function request(path, token, signal) {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new AdminHelpApiError(
      data?.error || data?.code || 'No se pudo cargar la guía',
      response.status,
      data?.code || null,
    );
  }
  return data;
}

function query(params) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.set(key, String(value));
  });
  const text = search.toString();
  return text ? `?${text}` : '';
}

export const adminHelpApi = {
  search(token, { q = '', lang = 'es', signal } = {}) {
    return request(`/api/admin/help/search${query({ q, lang })}`, token, signal);
  },
  getArticle(token, module, slug, { lang = 'es', signal } = {}) {
    return request(
      `/api/admin/help/articles/${encodeURIComponent(module)}/${encodeURIComponent(slug)}${query({ lang })}`,
      token,
      signal,
    );
  },
};
