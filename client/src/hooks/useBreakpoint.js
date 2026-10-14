import { useState, useEffect } from 'react';

const QUERY = '(max-width: 767px)';

const supportsMatchMedia = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function';

export default function useBreakpoint() {
  const [isMobile, setIsMobile] = useState(
    () => supportsMatchMedia() && window.matchMedia(QUERY).matches
  );
  useEffect(() => {
    if (!supportsMatchMedia()) return undefined;
    const mql = window.matchMedia(QUERY);
    const handler = (e) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  return { isMobile };
}
