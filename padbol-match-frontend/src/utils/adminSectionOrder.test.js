import { orderAdminSectionsAlphabetically } from './adminVisibleTabs';

test('Spanish alphabetical order preserves every section and ignores selection', () => {
  const source = [
    { id: 'roles', label: 'Roles', selected: true },
    { id: 'resumen', label: 'Resumen' },
    { id: 'config', label: 'Configuración' },
    { id: 'crm', label: 'Atención / CRM' },
    { id: 'sedes', label: 'Sedes' },
  ];
  expect(orderAdminSectionsAlphabetically(source).map((tab) => tab.id))
    .toEqual(['crm', 'config', 'resumen', 'roles', 'sedes']);
  expect(source[0].id).toBe('roles');
  source[0].selected = false;
  source[4].selected = true;
  expect(orderAdminSectionsAlphabetically(source).map((tab) => tab.id))
    .toEqual(['crm', 'config', 'resumen', 'roles', 'sedes']);
});
