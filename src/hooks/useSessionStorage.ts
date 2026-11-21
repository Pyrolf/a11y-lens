import { useCallback, useRef, useState } from 'react';

function readSessionStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function useSessionStorage<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => readSessionStorage(key, fallback));
  // Kept in sync synchronously so rapid consecutive writes compose correctly,
  // without performing storage side effects inside a state updater.
  const valueRef = useRef(value);

  const setStoredValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      const resolved = typeof next === 'function' ? (next as (prev: T) => T)(valueRef.current) : next;
      valueRef.current = resolved;
      try {
        window.sessionStorage.setItem(key, JSON.stringify(resolved));
      } catch {
        // Ignore storage failures; app still works in-memory.
      }
      setValue(resolved);
    },
    [key],
  );

  return [value, setStoredValue] as const;
}
