import PartidoAbiertoCard from './PartidoAbiertoCard';

jest.mock('react-router-dom', () => ({ Link: ({ children }) => children }));
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ session: { user: { id: 'jugador' } } }) }));

function elements(node) {
  if (!node || typeof node !== 'object') return [];
  const children = node.props?.children;
  return [node, ...((Array.isArray(children) ? children : [children]).flatMap(elements))];
}

test('un partido suspendido muestra su estado y no admite solicitudes', () => {
  const join = jest.fn();
  const tree = PartidoAbiertoCard({ partido: { id: 1, estado: 'suspendido', fecha: '2026-10-21', jugadores_requeridos: 4, jugadores_confirmados: [] }, onJoin: join });
  const all = elements(tree);
  expect(all.some((node) => node.props?.children === 'PARTIDO SUSPENDIDO')).toBe(true);
  expect(all.some((node) => typeof node.props?.children === 'string' && node.props.children.includes('Fecha anterior:'))).toBe(true);
  const button = all.find((node) => node.type === 'button' && node.props.children === 'Reanudación pendiente');
  expect(button.props.disabled).toBe(true);
});
