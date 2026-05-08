import { useEffect, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';

/** Mismo id de script que antes, para no duplicar tags si ya existía. */
export const GOOGLE_PLACES_SCRIPT_ID = 'padbol-google-places';

const LIBRARIES = ['places'];

function readPlacesApiKey() {
  return String(process.env.REACT_APP_GOOGLE_PLACES_KEY || '').trim();
}

function placesAlreadyReady() {
  return typeof window !== 'undefined' && Boolean(window.google?.maps?.places);
}

/** Una sola promesa de carga para toda la app (evita conflictos de Loader.instance). */
let loadPromise = null;

function startLoad(apiKey) {
  if (placesAlreadyReady()) {
    return Promise.resolve();
  }
  if (!loadPromise) {
    try {
      const loader = new Loader({
        id: GOOGLE_PLACES_SCRIPT_ID,
        apiKey,
        libraries: LIBRARIES,
      });
      loadPromise = loader.load().catch((err) => {
        loadPromise = null;
        throw err;
      });
    } catch (e) {
      if (placesAlreadyReady()) {
        return Promise.resolve();
      }
      return Promise.reject(e instanceof Error ? e : new Error(String(e)));
    }
  }
  return loadPromise;
}

/**
 * Carga única de Maps + Places para toda la app.
 * No llama al Loader si no hay API key (evita competir con otra pantalla que use "disabled").
 *
 * @returns {{ isLoaded: boolean, loadError: Error|undefined, placesEnabled: boolean }}
 */
export function useGooglePlaces() {
  const apiKey = readPlacesApiKey();
  const placesEnabled = Boolean(apiKey);

  const [isLoaded, setIsLoaded] = useState(() => placesEnabled && placesAlreadyReady());
  const [loadError, setLoadError] = useState(undefined);

  useEffect(() => {
    if (!placesEnabled || !apiKey) {
      setIsLoaded(false);
      setLoadError(undefined);
      return undefined;
    }

    if (placesAlreadyReady()) {
      setIsLoaded(true);
      return undefined;
    }

    let cancelled = false;
    startLoad(apiKey)
      .then(() => {
        if (!cancelled) {
          setLoadError(undefined);
          setIsLoaded(true);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e : new Error(String(e)));
          setIsLoaded(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [placesEnabled, apiKey]);

  return {
    /** Listo para usar `Autocomplete` (API key presente y script cargado). */
    isLoaded: Boolean(placesEnabled && isLoaded),
    loadError: placesEnabled ? loadError : undefined,
    placesEnabled,
  };
}
