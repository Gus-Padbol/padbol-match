import React from 'react';
import { render } from '@testing-library/react';
import BinaryDataStreamZone from './BinaryDataStreamZone';

describe('BinaryDataStreamZone', () => {
  beforeEach(() => {
    window.matchMedia = jest.fn().mockReturnValue({
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    });
  });

  it('envuelve contenido con corriente izquierda detrás', () => {
    const { container } = render(
      <BinaryDataStreamZone>
        <section id="ps-what">Qué es</section>
        <section id="ps-players">Jugadores</section>
        <section id="ps-community">Comunidad</section>
      </BinaryDataStreamZone>,
    );
    const zone = container.querySelector('[data-binary-zone="true"]');
    const stream = container.querySelector('[data-binary-stream="true"]');
    expect(zone).toBeTruthy();
    expect(stream).toBeTruthy();
    expect(zone.contains(stream)).toBe(true);
    expect(stream.className).toMatch(/is-left/);
    expect(stream).toHaveAttribute('data-position', 'left');
    expect(stream).toHaveAttribute('data-orientation', 'vertical');
    expect(Number(stream.getAttribute('data-band-count'))).toBe(4);
    expect(container.querySelector('#ps-what')).toBeTruthy();
    expect(container.querySelector('#ps-community')).toBeTruthy();
  });

  it('en reduced motion deja el stream estático', () => {
    window.matchMedia = jest.fn().mockReturnValue({
      matches: true,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    });
    const { container } = render(
      <BinaryDataStreamZone>
        <div>contenido</div>
      </BinaryDataStreamZone>,
    );
    expect(container.querySelector('[data-binary-stream="true"]')).toHaveAttribute(
      'data-motion',
      'static',
    );
  });
});
