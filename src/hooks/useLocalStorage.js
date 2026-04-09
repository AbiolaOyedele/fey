import { useState, useEffect, useCallback } from 'react';

export function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    } catch {
      // Storage full or unavailable
    }
  }, [key, storedValue]);

  const setValue = useCallback((value) => {
    setStoredValue((prev) => {
      const nextValue = typeof value === 'function' ? value(prev) : value;
      return nextValue;
    });
  }, []);

  return [storedValue, setValue];
}
