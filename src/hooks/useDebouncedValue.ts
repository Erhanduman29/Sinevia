import { useEffect, useState } from 'react';

/**
 * Değeri gecikmeli (debounced) olarak döndürür — Madde 1: Arama & Filtreleme.
 *
 * Girdi (input) bileşeni her tuş vuruşunda HAM değeri gösterir (anlık geri bildirim);
 * filtre/sıralama tarafı ise debounce sonra güncellenen dönen değeri kullanır.
 * Böylece her tuş vuruşunda tüm kütüphane üzerinde filter()/toLowerCase() çalışmaz.
 *
 * Kullanım:
 *   const [search, setSearch] = useState('');          // input value={search}
 *   const searchDebounced = useDebouncedValue(search, 180);
 *   const list = useFilteredMovies(movies, ..., searchDebounced, ...);
 */
export function useDebouncedValue<T>(value: T, delay = 180): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

export default useDebouncedValue;
