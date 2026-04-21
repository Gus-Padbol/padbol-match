import { render } from '@testing-library/react';
import App from './App';
import { AuthProvider } from './context/AuthContext';

test('monta la aplicación', () => {
  const { container } = render(
    <AuthProvider>
      <App />
    </AuthProvider>
  );
  expect(container).toBeTruthy();
});
