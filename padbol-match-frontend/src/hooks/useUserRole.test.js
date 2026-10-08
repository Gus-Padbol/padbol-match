import { renderHook, waitFor } from '@testing-library/react';
import useUserRole from './useUserRole';
import { fetchMiRol } from '../utils/fetchMiRol';
import { fetchUserRoleFromSupabase } from '../utils/fetchUserRoleSupabase';
import { supabase } from '../supabaseClient';

jest.mock('../utils/fetchMiRol', () => ({ fetchMiRol: jest.fn() }));
jest.mock('../utils/fetchUserRoleSupabase', () => ({ fetchUserRoleFromSupabase: jest.fn() }));
jest.mock('../supabaseClient', () => ({
  supabase: { auth: { getSession: jest.fn() } },
}));

describe('useUserRole', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    supabase.auth.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'valid-token',
          user: { id: 'user-1', email: 'admin@padbol.test' },
        },
      },
    });
  });

  it('usa el respaldo autenticado cuando el backend de permisos falla', async () => {
    fetchMiRol.mockRejectedValue(new Error('backend temporalmente indisponible'));
    fetchUserRoleFromSupabase.mockResolvedValue({
      email: 'admin@padbol.test',
      rol: 'super_admin',
      sedeId: null,
    });

    const { result } = renderHook(() => useUserRole({
      id: 'user-1',
      email: 'admin@padbol.test',
    }));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(fetchUserRoleFromSupabase).toHaveBeenCalledWith(expect.objectContaining({ id: 'user-1' }));
    expect(result.current.rol).toBe('super_admin');
    expect(result.current.error).toBeNull();
  });
});
