import { useCallback, useMemo, useState } from 'react';
import { createWhatsappCrmApiClient } from '../utils/whatsappCrmApi';

/**
 * Fuente de datos del CRM. Usa el backend real del contrato; nunca inventa
 * filas. Expone carga, error y la ficha seleccionada.
 */
export default function useWhatsappCrmDataSource(token) {
  const api = useMemo(() => createWhatsappCrmApiClient({ token }), [token]);
  const [contacts, setContacts] = useState([]);
  const [total, setTotal] = useState(0);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [errorStatus, setErrorStatus] = useState(0);

  const run = useCallback(async (fn) => {
    setLoading(true);
    setError('');
    setErrorStatus(0);
    try {
      return await fn();
    } catch (e) {
      setError(e.message || 'No se pudo consultar el CRM.');
      setErrorStatus(e.status || 0);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const load = useCallback(async (filtros = {}) => {
    const data = await run(() => api.list(filtros));
    if (data) {
      setContacts(data.contacts);
      setTotal(data.total);
    }
    return data;
  }, [api, run]);

  const select = useCallback(async (id) => {
    const data = await run(() => api.detail(id));
    if (data) setDetail(data);
    return data;
  }, [api, run]);

  const act = useCallback(async (id, kind, payload) => {
    const data = await run(() => api.action(id, kind, payload));
    if (data) {
      setDetail(data);
      setContacts((rows) => rows.map((row) => (row.id === id ? { ...row, ...data.contact } : row)));
    }
    return data;
  }, [api, run]);

  return { contacts, total, detail, loading, error, errorStatus, load, select, act, setDetail };
}
