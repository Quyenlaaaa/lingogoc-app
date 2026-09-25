const VALID_STATES = new Set(['online', 'limited', 'offline']);

function browserFallback() {
  return navigator.onLine ? 'online' : 'offline';
}

function normalizeState(value) {
  return VALID_STATES.has(value) ? value : browserFallback();
}

export function getNetworkState() {
  try {
    const nativeState = window.LingoGocNative?.getNetworkState?.();
    if (nativeState) return normalizeState(nativeState);
  } catch {
    // Fall back to the browser signal when the native bridge is unavailable.
  }
  return browserFallback();
}

export function subscribeToNetworkState(listener) {
  const notify = (state) => listener(normalizeState(state));
  const previousNativeHandler = window.__lingogocNativeNetworkEvent;
  const nativeHandler = (state) => {
    previousNativeHandler?.(state);
    notify(state);
  };
  window.__lingogocNativeNetworkEvent = nativeHandler;
  const handleOnline = () => notify('online');
  const handleOffline = () => notify('offline');
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    if (window.__lingogocNativeNetworkEvent === nativeHandler) {
      window.__lingogocNativeNetworkEvent = previousNativeHandler;
    }
  };
}
