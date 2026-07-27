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

  it('envuelve contenido con corrientes alternadas detrás', () => {
    const { container } = render(
      <BinaryDataStreamZone>
        <section id="ps-what">Qué es</section>
        <section id="ps-players">Jugadores</section>
        <section id="ps-community">Comunidad</section>
      </BinaryDataStreamZone>,
    );
    const zone = container.querySelector('[data-binary-zone="true"]');
    const streams = container.querySelectorAll('[data-binary-stream="true"]');
    const [leftStream, rightStream] = streams;
    expect(zone).toBeTruthy();
    expect(streams).toHaveLength(2);
    expect(zone.contains(leftStream)).toBe(true);
    expect(leftStream.className).toMatch(/is-left/);
    expect(leftStream).toHaveAttribute('data-position', 'left');
    expect(rightStream.className).toMatch(/is-right/);
    expect(rightStream).toHaveAttribute('data-position', 'right');
    expect(leftStream).toHaveAttribute('data-orientation', 'vertical');
    expect(Number(leftStream.getAttribute('data-band-count'))).toBe(6);
    expect(Number(rightStream.getAttribute('data-band-count'))).toBe(6);
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
    container.querySelectorAll('[data-binary-stream="true"]').forEach((stream) => {
      expect(stream).toHaveAttribute('data-motion', 'static');
    });
  });
});
