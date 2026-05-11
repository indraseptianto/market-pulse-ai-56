import { useEffect, useState } from "react";

/**
 * Returns true after first client mount. Use to gate any rendering that may
 * differ between SSR and client (numeric mocks, locale formatting, etc.) to
 * avoid hydration mismatches.
 */
export function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}
