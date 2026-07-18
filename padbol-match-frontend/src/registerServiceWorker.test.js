import {
  shouldAutoReloadForSwUpdate,
  clearSwReloadGuard,
} from './registerServiceWorker';

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => {
      map.set(k, String(v));
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

describe('shouldAutoReloadForSwUpdate', () => {
  it('recarga una vez ante PM_SW_UPDATED (caso bundle incompatible atrapado)', () => {
    const storage = memoryStorage();
    expect(shouldAutoReloadForSwUpdate({ type: 'PM_SW_UPDATED', forceReload: true }, storage)).toBe(
      true
    );
    expect(shouldAutoReloadForSwUpdate({ type: 'PM_SW_UPDATED', forceReload: true }, storage)).toBe(
      false
    );
  });

  it('no recarga por PM_SW_UPDATE_AVAILABLE solo (banner)', () => {
    const storage = memoryStorage();
    expect(
      shouldAutoReloadForSwUpdate({ type: 'PM_SW_UPDATE_AVAILABLE', phase: 'installed' }, storage)
    ).toBe(false);
  });

  it('clearSwReloadGuard permite un nuevo ciclo', () => {
    const storage = memoryStorage();
    expect(shouldAutoReloadForSwUpdate({ type: 'PM_SW_UPDATED' }, storage)).toBe(true);
    clearSwReloadGuard(storage);
    expect(shouldAutoReloadForSwUpdate({ type: 'PM_SW_UPDATED' }, storage)).toBe(true);
  });
});
