export interface WebVitalsSnapshot {
  collectedAt: string;
  fcp?: number;
  lcp?: number;
  cls?: number;
  ttfb?: number;
  inp?: number;
}

const STORAGE_KEY = 'a11y-lens:web-vitals';

let snapshot: WebVitalsSnapshot = { collectedAt: new Date().toISOString() };

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Storage can be unavailable in private mode; metrics are still in memory.
  }
  (window as Window & { __A11Y_LENS_VITALS__?: WebVitalsSnapshot }).__A11Y_LENS_VITALS__ = snapshot;
}

function observe(type: string, callback: (entry: any) => void): void {
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) callback(entry);
    });
    observer.observe({ type, buffered: true } as PerformanceObserverInit);
  } catch {
    // The metric is unsupported in this browser; skip it silently.
  }
}

/** Starts collecting Core Web Vitals. Safe to call multiple times. */
export function startWebVitals(): void {
  if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') return;

  const navigation = performance.getEntriesByType('navigation')[0] as
    | (PerformanceEntry & { responseStart?: number })
    | undefined;
  if (navigation && typeof navigation.responseStart === 'number') {
    snapshot.ttfb = navigation.responseStart;
    persist();
  }

  observe('paint', (entry) => {
    if (entry.name === 'first-contentful-paint') {
      snapshot.fcp = entry.startTime;
      snapshot.collectedAt = new Date().toISOString();
      persist();
    }
  });

  observe('largest-contentful-paint', (entry) => {
    snapshot.lcp = entry.startTime;
    snapshot.collectedAt = new Date().toISOString();
    persist();
  });

  let clsValue = 0;
  observe('layout-shift', (entry) => {
    if (!entry.hadRecentInput) {
      clsValue += entry.value;
      snapshot.cls = clsValue;
      snapshot.collectedAt = new Date().toISOString();
      persist();
    }
  });

  observe('event', (entry) => {
    if (entry.interactionId && typeof entry.duration === 'number') {
      snapshot.inp = Math.max(snapshot.inp ?? 0, entry.duration);
      snapshot.collectedAt = new Date().toISOString();
      persist();
    }
  });
}

export function getWebVitals(): WebVitalsSnapshot {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as WebVitalsSnapshot;
  } catch {
    // Fall back to the in-memory snapshot.
  }
  return snapshot;
}

export function downloadWebVitals(): void {
  const blob = new Blob([JSON.stringify(getWebVitals(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `a11y-lens-web-vitals-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}