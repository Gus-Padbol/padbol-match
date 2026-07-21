import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import SedeWhatsappPhoneField from './SedeWhatsappPhoneField';

jest.mock('../i18n/tSafe', () => {
  const locale = require('../i18n/locales/es.json');
  const flatten = (value, prefix = '', result = {}) => {
    Object.entries(value).forEach(([key, child]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      if (child && typeof child === 'object' && !Array.isArray(child)) flatten(child, path, result);
      else result[path] = String(child);
    });
    return result;
  };
  const fallbacks = flatten(locale);
  return {
    ES_FALLBACKS: fallbacks,
    useSafeTranslation: () => ({
      t: (key) => fallbacks[key] || key,
    }),
  };
});

function Harness({ initial, paisLabel }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <SedeWhatsappPhoneField
        id="wa-test"
        value={value}
        paisLabel={paisLabel}
        onChange={setValue}
      />
      <output data-testid="stored">{value}</output>
    </>
  );
}

describe('MEJ-04 SedeWhatsappPhoneField', () => {
  it('Argentina: prefijo +54 visible en bloque separado y campo editable sin +54', () => {
    render(<Harness initial="+54 221 555 1234" paisLabel="🇦🇷 Argentina" />);
    expect(screen.getByText('+54')).toBeInTheDocument();
    const input = screen.getByRole('textbox', { name: /número de teléfono sin código de país/i });
    expect(input).toHaveValue('221 555 1234');
    expect(input.value).not.toContain('+54');
  });

  it('otro país: prefijo real según país, sin asumir Argentina', () => {
    render(<Harness initial="+34 612 345 678" paisLabel="España" />);
    expect(screen.getByText('+34')).toBeInTheDocument();
    expect(screen.queryByText('+54')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('612 345 678');
  });

  it('histórico con prefijo en dígitos: separa visualmente y no duplica al editar', () => {
    render(<Harness initial="+5492215551234" paisLabel="Argentina" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('92215551234');
    fireEvent.change(input, { target: { value: '92215551235' } });
    expect(screen.getByTestId('stored')).toHaveTextContent(/^\+54 92215551235$/);
  });

  it('número sin prefijo se conserva como local y se une sin duplicar', () => {
    render(<Harness initial="2215551234" paisLabel="Argentina" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('2215551234');
    fireEvent.change(input, { target: { value: '2215551234 5' } });
    expect(screen.getByTestId('stored')).toHaveTextContent(/^\+54 2215551234 5$/);
  });

  it('campo vacío: prefijo visible, input vacío, sin romper', () => {
    render(<Harness initial="" paisLabel="Argentina" />);
    expect(screen.getByText('+54')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('');
  });

  it('pegar un número completo con código de país no duplica el prefijo', () => {
    render(<Harness initial="" paisLabel="Argentina" />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '+54 221 555 1234' } });
    expect(screen.getByTestId('stored')).toHaveTextContent(/^\+54 221 555 1234$/);
    expect(input).toHaveValue('221 555 1234');
  });

  it('conserva ceros y espacios del número local', () => {
    render(<Harness initial="" paisLabel="Argentina" />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '0' } });
    fireEvent.change(input, { target: { value: '0221 555' } });
    expect(input).toHaveValue('0221 555');
    expect(screen.getByTestId('stored')).toHaveTextContent(/^\+54 0221 555$/);
  });

  it('país sin código en catálogo: campo único sin prefijo separado', () => {
    render(<Harness initial="123456" paisLabel="Atlantis" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('123456');
    expect(document.querySelector('.sede-wa-phone-prefix')).toBeNull();
  });

  it('accesibilidad: label externo asociado, prefijo anunciado y ayuda vinculada', () => {
    render(
      <>
        <label htmlFor="wa-test">WhatsApp del club</label>
        <Harness initial="+54 221 555 1234" paisLabel="Argentina" />
      </>,
    );
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('id', 'wa-test');
    expect(input).toHaveAttribute('aria-describedby', 'wa-test-help');
    expect(screen.getByText('Ingresá el número sin el código de país.')).toHaveAttribute('id', 'wa-test-help');
    expect(screen.getByText(/código de país/i, { selector: '.sede-wa-phone-sr-only' })).toBeInTheDocument();
  });
});
