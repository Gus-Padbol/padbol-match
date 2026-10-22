import React from 'react';
import { render, waitFor } from '@testing-library/react';
import AdminModuloClasesSection from './AdminModuloClasesSection';
jest.mock('./AdminClasesClubSection', () => () => <div>Clases</div>);
jest.mock('./AdminProfesoresClubSection', () => () => <div>Profesores</div>);
jest.mock('../i18n/adminTranslation', () => { const t = key => key; return { useSafeTranslation: () => ({ t }) }; });
afterEach(() => { delete global.fetch; });
test('omitted courts do not trigger a fetch/render loop; a new venue loads once', async () => {
 global.fetch = jest.fn().mockResolvedValue({ ok:true, json:async()=>({canchas:[]}) });
 const props={apiBaseUrl:'https://example.test',accessToken:'mock',sedeId:1,hideProfesores:true};
 const view=render(<AdminModuloClasesSection {...props} />);
 await waitFor(()=>expect(fetch).toHaveBeenCalledTimes(1));
 view.rerender(<AdminModuloClasesSection {...props} />);
 await waitFor(()=>expect(fetch).toHaveBeenCalledTimes(1));
 view.rerender(<AdminModuloClasesSection {...props} sedeId={2} />);
 await waitFor(()=>expect(fetch).toHaveBeenCalledTimes(2));
 expect(fetch.mock.calls[1][0]).toBe('https://example.test/api/sedes/2/canchas');
});
