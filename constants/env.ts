const rawUrl = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000";

/** REST base, e.g. `http://host:5000/api/v1` */
export const API_BASE_URL = rawUrl.replace(/\/api\/v1\/?$/, "") + "/api/v1";

/** Socket.IO origin (no `/api/v1`), same host as API */
export const SOCKET_BASE_URL = rawUrl.replace(/\/api\/v1\/?$/, "");

/** Google Maps API key: Android bus preview (Static Maps image) + optional future use; EXPO_PUBLIC_GOOGLE_MAPS_API_KEY */
export const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "";
