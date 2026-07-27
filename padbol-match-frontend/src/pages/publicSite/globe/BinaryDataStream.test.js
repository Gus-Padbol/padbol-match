import React from 'react';
import { render } from '@testing-library/react';
import BinaryDataStream from './BinaryDataStream';
import {
  BINARY_STREAM_BANDS_DESKTOP,
  BINARY_STREAM_TYPOGRAPHY,
  buildBinarySequence,
  decorateBinaryAccents,
  isBinaryOnly,
  selectBinaryBands,
  selectFrontFragments,
} from './binaryStreamData';
import fs from 'fs';
import path from 'path';

describe('binaryStreamData', () => {
  it('genera secuencias deterministas solo con 0 y 1', () => {
    const a = buildBinarySequence(11027, 64);
    const b = buildBinarySequence(11027, 64);
    expect(a).toBe(b);
    expect(isBinaryOnly(a)).toBe(true);
  });

  it('define exactamente 6 líneas verticales a 0deg en desktop', () => {
    expect(BINARY_STREAM_BANDS_DESKTOP.length).toBe(6);
    expect(BINARY_STREAM_TYPOGRAPHY.orientation).toBe('vertical');
    expect(BINARY_STREAM_TYPOGRAPHY.rotateDeg).toBe(0);
    expect(BINARY_STREAM_TYPOGRAPHY.position).toBe('left');
    expect(BINARY_STREAM_TYPOGRAPHY.motionAxis).toBe('y');
    BINARY_STREAM_BANDS_DESKTOP.forEach((b) => {
      expect(b.rotateDeg).toBe(0);
      expect(b.length).toBeGreaterThanOrEqual(140);
    });
  });

  it('usa duraciones lentas y opacidades de fondo ≤0.22', () => {
    const [l1, l2, l3, l4] = BINARY_STREAM_BANDS_DESKTOP;
    expect(l1.durationSec).toBeGreaterThanOrEqual(30);
    expect(l1.durationSec).toBeLessThanOrEqual(36);
    expect(l2.durationSec).toBeGreaterThanOrEqual(38);
    expect(l2.durationSec).toBeLessThanOrEqual(46);
    expect(l3.durationSec).toBeGreaterThanOrEqual(44);
    expect(l3.durationSec).toBeLessThanOrEqual(54);
    expect(l4.durationSec).toBeGreaterThanOrEqual(34);
    expect(l4.durationSec).toBeLessThanOrEqual(42);

    expect(l1.opacity).toBeGreaterThanOrEqual(0.1);
    expect(l1.opacity).toBeLessThanOrEqual(0.15);
    expect(l2.opacity).toBeGreaterThanOrEqual(0.14);
    expect(l2.opacity).toBeLessThanOrEqual(0.2);
    expect(l3.opacity).toBeGreaterThanOrEqual(0.08);
    expect(l3.opacity).toBeLessThanOrEqual(0.13);
    expect(l4.opacity).toBeGreaterThanOrEqual(0.12);
    expect(l4.opacity).toBeLessThanOrEqual(0.17);

    BINARY_STREAM_BANDS_DESKTOP.forEach((b) => {
      expect(b.opacity).toBeLessThanOrEqual(0.22);
    });
  });

  it('decorateBinaryAccents conserva solo 0/1', () => {
    const text = buildBinarySequence(11027, 80);
    const a = decorateBinaryAccents(text, 11027);
    expect(isBinaryOnly(a.map((s) => s.text).join(''))).toBe(true);
  });

  it('reduce bandas en tablet/móvil con opacidades bajas y más lentas', () => {
    expect(selectBinaryBands({}).length).toBe(6);
    const tablet = selectBinaryBands({ tablet: true });
    expect(tablet.length).toBe(4);
    tablet.forEach((b, i) => {
      expect(b.opacity).toBeLessThanOrEqual(0.22);
      expect(b.durationSec).toBeGreaterThan(BINARY_STREAM_BANDS_DESKTOP[i].durationSec);
    });
    const mobile = selectBinaryBands({ compact: true });
    expect(mobile.length).toBeLessThanOrEqual(3);
    mobile.forEach((b) => {
      expect(b.opacity).toBeLessThanOrEqual(0.12);
      expect(b.durationSec).toBeGreaterThanOrEqual(40);
    });
    expect(selectFrontFragments()).toEqual([]);
  });
});

describe('BinaryDataStream', () => {
  it('renderiza grupo vertical a la izquierda, sin inclinación', () => {
    const { container } = render(<BinaryDataStream />);
    const root = container.querySelector('[data-binary-stream="true"]');
    expect(root).toBeTruthy();
    expect(Number(root.getAttribute('data-band-count'))).toBe(6);
    expect(root.getAttribute('data-position')).toBe('left');
    expect(root.getAttribute('data-position')).not.toBe('right');
    expect(root.className).toMatch(/is-left/);
    expect(root.className).not.toMatch(/is-right/);
    expect(root.getAttribute('data-orientation')).toBe('vertical');
    expect(root.getAttribute('data-rotate')).toBe('0');
    expect(root.getAttribute('data-motion-axis')).toBe('y');
    expect(root.getAttribute('data-flow')).toBe('top-to-bottom');
    expect(root.getAttribute('data-color')).toBe('cyan');
    Array.from(container.querySelectorAll('[data-band-id]')).forEach((el) => {
      expect(Number(el.getAttribute('data-rotate'))).toBe(0);
      expect(Number(el.getAttribute('data-opacity'))).toBeLessThanOrEqual(0.22);
      expect(Number(el.getAttribute('data-duration'))).toBeGreaterThanOrEqual(30);
    });
  });

  it('CSS usa solo translateY, glow reducido y fade prolongado', () => {
    const css = fs.readFileSync(path.join(__dirname, '../publicSite.css'), 'utf8');
    const fallBlock = css.match(/@keyframes ps-binary-fall\s*\{[\s\S]*?\n\}/)?.[0] || '';
    const bandBlock = css.match(/\.ps-binary-stream__band\s*\{[\s\S]*?\n\}/)?.[0] || '';
    const trackBlock = css.match(/\.ps-binary-stream__track\s*\{[\s\S]*?\n\}/)?.[0] || '';
    const maskBlock = css.match(/mask-image:\s*linear-gradient\([\s\S]*?\)/)?.[0] || '';
    expect(css).toMatch(/\.ps-binary-stream\.is-left\s*\{/);
    expect(css).toMatch(/\.ps-binary-zone\s*\{/);
    expect(css).toMatch(/ps-binary-zone__stream/);
    expect(fallBlock).toMatch(/translateY/);
    expect(fallBlock).not.toMatch(/translateX/);
    expect(bandBlock).toMatch(/transform:\s*none/);
    expect(bandBlock).not.toMatch(/rotate\(/);
    expect(bandBlock).not.toMatch(/skew/);
    expect(css).not.toMatch(/ps-bin-rotate/);
    expect(trackBlock).toMatch(/0 0 2px rgba\(88,\s*217,\s*248,\s*0\.1\)/);
    expect(trackBlock).not.toMatch(/0 0 6px/);
    expect(css).toMatch(/#000 14%/);
    expect(css).toMatch(/#000 86%/);
    expect(maskBlock.length).toBeGreaterThan(0);
  });

  it('respeta reduced motion estático a la izquierda con opacidad baja', () => {
    const { container } = render(<BinaryDataStream reducedMotion />);
    const root = container.querySelector('[data-binary-stream="true"]');
    expect(root).toHaveAttribute('data-motion', 'static');
    expect(root).toHaveAttribute('data-position', 'left');
    expect(root).toHaveAttribute('data-rotate', '0');
    Array.from(container.querySelectorAll('[data-band-id]')).forEach((el) => {
      expect(Number(el.getAttribute('data-opacity'))).toBeLessThanOrEqual(0.22);
    });
  });

  it('en móvil muestra como máximo 3 líneas y opacidad ≤0.12', () => {
    const { container } = render(<BinaryDataStream compact />);
    expect(
      Number(container.querySelector('[data-binary-stream="true"]').getAttribute('data-band-count')),
    ).toBeLessThanOrEqual(3);
    Array.from(container.querySelectorAll('[data-band-id]')).forEach((el) => {
      expect(Number(el.getAttribute('data-opacity'))).toBeLessThanOrEqual(0.12);
    });
  });
});
