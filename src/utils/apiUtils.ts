/**
 * Utility to get the API base URL.
 * In a web browser running from the same server, it can be empty (relative).
 * In Capacitor (Android/iOS), it must be the absolute URL of the hosted backend.
 */
export const getApiUrl = (path: string): string => {
  // Clean the path to ensure it starts with /
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  
  // If we are in a browser and NOT on a localhost/native-app-like host, 
  // relative paths should work fine.
  // However, in Capacitor, window.location.origin is usually capacitor://localhost or http://localhost
  const isCapacitor = (window as any).Capacitor !== undefined || 
                      window.location.origin.includes('localhost') || 
                      window.location.origin.startsWith('capacitor://');

  if (isCapacitor) {
    const baseUrl = import.meta.env.VITE_APP_URL || '';
    if (baseUrl) {
      // Remove trailing slash from baseUrl if exists
      const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      return `${normalizedBase}${cleanPath}`;
    }
  }

  return cleanPath;
};
