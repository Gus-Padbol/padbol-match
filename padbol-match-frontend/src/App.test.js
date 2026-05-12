import { render } from '@testing-library/react';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

test('monta la aplicación', () => {
  const { container } = render(
    <ThemeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  );
  expect(container).toBeTruthy();
});
