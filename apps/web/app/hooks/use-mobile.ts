import { useEffect, useState } from "react";

/**
 * Hook to detect if the current device is mobile
 * Uses a media query to check if the screen width is below 768px
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 768px)");
    const onChange = () => {
      setIsMobile(mql.matches);
    };

    // Set initial value
    setIsMobile(mql.matches);

    // Listen for changes
    mql.addEventListener("change", onChange);

    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
