/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');

const templatePath = path.join(__dirname, '../../scripts/pwa-sw.template.js');
const template = fs.readFileSync(templatePath, 'utf8');

describe('pwa-sw.template.js — invalidación entre deploys', () => {
  it('usa network-first para navegaciones / HTML (no cache-first de index)', () => {
    expect(template).toMatch(/function networkFirst\s*\(/);
    expect(template).toMatch(/isNavigationRequest/);
    expect(template).toMatch(/networkFirst\(event\.request\)/);
    // No debe servir documentos con el patrón cache-first antiguo como único camino
    expect(template).not.toMatch(
      /event\.respondWith\(\s*caches\.match\(event\.request\)\.then\(\(cached\) => \{\s*if \(cached\) return cached;/s
    );
  });

  it('no precachea "/" (evita shell HTML stale en install)', () => {
    expect(template).toMatch(/const PRECACHE_URLS = \[/);
    expect(template).not.toMatch(/PRECACHE_URLS = \[[^\]]*['"]\/['"]/);
  });

  it('precachea el isotipo oficial y su variante maskable', () => {
    expect(template).toMatch(/\/brand\/padbol-match-icon\.svg/);
    expect(template).toMatch(/\/brand\/padbol-match-icon-maskable-512\.png/);
  });

  it('no intercepta /sw.js (bypass para updates)', () => {
    expect(template).toMatch(/path === '\/sw\.js'/);
    expect(template).toMatch(/path\.endsWith\('\/sw\.js'\)/);
  });

  it('cache-first solo para /static/ e iconos/manifest', () => {
    expect(template).toMatch(/path\.startsWith\('\/static\/'\)/);
    expect(template).toMatch(/function cacheFirst\s*\(/);
    expect(template).toMatch(/event\.respondWith\(cacheFirst\(event\.request\)\)/);
  });

  it('avisa forceReload al reemplazar cachés anteriores', () => {
    expect(template).toMatch(/forceReload:\s*true/);
    expect(template).toMatch(/PM_SW_UPDATED/);
  });
});
